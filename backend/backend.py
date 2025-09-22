"""
Flask backend for Local-GPT.

Provides endpoints for:
- managing conversations and messages.
- streaming LLM responses via Server-Sent Events (SSE).
- database connection pooling and CORS preflight handling.
"""

import datetime as dt
from datetime import datetime
import dotenv
import functools
import json
import pathlib
import os
from os import environ

import anthropic
import bcrypt
import flask
from flask import request as flask_request
from flask.wrappers import Response as flaskResponse
import flask_cors
import jwt
import openai
import psycopg2.extensions, psycopg2.extras, psycopg2.pool

dotenv.load_dotenv()

## Connection pool for PostgreSQL database.
DATABASE_URL = os.getenv('DATABASE_URL')
postgreSQL_pool = psycopg2.pool.SimpleConnectionPool(1, 20, dsn=DATABASE_URL)

ROOT_DIR = pathlib.Path(__file__).resolve().parent
APP = flask.Flask(__name__, static_folder=ROOT_DIR.parent / "dist", static_url_path="")
flask_cors.CORS(APP)

# JWT configuration
JWT_SECRET_KEY = environ.get('JWT_SECRET_KEY')
JWT_ALGORITHM = 'HS256'

# Fail fast if JWT secret not configured
if not JWT_SECRET_KEY:
    raise RuntimeError("JWT_SECRET_KEY environment variable must be set")

OPENAI = openai.OpenAI()
OPEN_AI_CHAT_COMPLETIONS_CLIENT = OPENAI.chat.completions

current_filepath = pathlib.Path(__file__).resolve()
config_filepath = current_filepath.parent.parent / "shared" / "models.json"
MODEL_CONFIG = json.loads(config_filepath.read_text())

ANTHROPIC_CLIENT = anthropic.Anthropic()
MAX_ANTHROPIC_TOKENS = 8192
ANTHROPIC_MODELS = set(MODEL_CONFIG["anthropic_models"])
OPENAI_MODELS = set(MODEL_CONFIG["openai_models"])
REASONING_MODELS = set(MODEL_CONFIG["reasoning_models"])


# Authentication helper functions
def hash_password(password: str) -> str:
    """Hash a password using bcrypt."""
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')


def verify_password(password: str, hashed: str) -> bool:
    """Verify a password against its hash."""
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))


def generate_token(user_id: int, email: str, is_admin: bool) -> str:
    """
    Generate a JWT token for a user.

    JWT tokens are used instead of sessions because:
    - They're stateless (no server-side storage needed)
    - They contain user info (id, email, admin status) for quick access
    - They have built-in expiration (7 days) for security
    - They can be easily verified without database lookups
    """
    payload = {
        'user_id': user_id,
        'email': email,
        'is_admin': is_admin,
        # Token expires in 7 days
        'exp': datetime.now(dt.UTC) + dt.timedelta(days=7),
    }
    return jwt.encode(payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)


def verify_token(token: str) -> dict | None:
    """
    Verify and decode a JWT token.

    This function is called on every protected route and during app startup to ensure
    tokens are still valid and haven't expired.
    Returns None for expired or invalid tokens, triggering re-authentication.
    """
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None


def require_auth(f):
    """
    Decorator to enforce that a valid JWT is present on protected endpoints. This wraps
    the view function, extracting a token (from the Authorization header or a 'token'
    query param), verifies it, and populates flask_request.current_user. If the token is
    missing or invalid, returns a 401 error response before calling the endpoint.
    Example usage:

        @APP.route('/some-protected')
        @require_auth
        def some_protected_view():
            # flask_request.current_user is guaranteed to be set here
            return jsonify(...)
    """

    @functools.wraps(f)
    def decorated_function(*args, **kwargs):
        # Look for token in header first, then fallback to query string
        auth_header = flask_request.headers.get('Authorization')
        if auth_header and auth_header.startswith('Bearer '):
            token = auth_header.split(' ', 1)[1]
        else:
            token = flask_request.args.get('token')
        if not token:
            return flask.jsonify({'error': 'No token provided'}), 401

        payload = verify_token(token)
        if not payload:
            return flask.jsonify({'error': 'Invalid or expired token'}), 401

        flask_request.current_user = payload
        return f(*args, **kwargs)

    return decorated_function


def optional_auth(f):
    """
    Decorator for endpoints that accept both authenticated and anonymous users.

    Attempts to parse a JWT from the Authorization header; on success, sets
    flask_request.current_user but does not reject if no or invalid token is present.
    Use this for endpoints like /api/conversations that should work for both cases.
    """

    @functools.wraps(f)
    def decorated_function(*args, **kwargs):
        auth_header = flask_request.headers.get('Authorization')
        if auth_header and auth_header.startswith('Bearer '):
            token = auth_header.split(' ')[1]
            payload = verify_token(token)
            if payload:
                flask_request.current_user = payload
            else:
                flask_request.current_user = None
        else:
            flask_request.current_user = None

        return f(*args, **kwargs)

    return decorated_function


def _anthropic_call(
    *,
    model: str = "claude-sonnet-4-0",
    messages: list[dict],
    system_prompt: str | None,
    max_tokens: int,
    stream: bool = False,
):
    """
    Call the Anthropic API for chat completions with optional system prompt and
    streaming.
    """
    params = {"model": model, "max_tokens": max_tokens, "messages": messages}
    if system_prompt:
        params["system"] = system_prompt
    if stream:
        params["stream"] = True
    return ANTHROPIC_CLIENT.messages.create(**params)


@APP.route("/stream", methods=["GET"])
@require_auth
def stream_interaction() -> flaskResponse:
    """
    Stream an OpenAI or Anthropic LLM response via Server-Sent Events (SSE).

    Steps:
    1. Create or continue a conversation record in the database.
    2. Save user and optional system messages.
    3. Stream tokens from the chosen LLM to the client in real time.
    4. Persist the final assistant message after streaming completes.
    """
    user_text = flask_request.args.get("userText", "")
    system_message = flask_request.args.get("systemMessage", "")
    conversation_id_str = flask_request.args.get("conversationId")
    llm_choice = flask_request.args.get("llm", "gpt-4.1-2025-04-14")
    parent_message_id_str = flask_request.args.get("parentMessageId")
    try:
        parent_message_id = (
            int(parent_message_id_str) if parent_message_id_str is not None else None
        )
    except (ValueError, TypeError):
        parent_message_id = None

    conn = None
    cur = None
    conversation_id = None
    is_new_conversation = True
    messages_for_llm = []
    user_message_id = None

    conversation_topic = _get_current_date_and_time_string()

    conn = None
    cur = None
    conversation_id = None

    try:
        conn = get_db_connection()
        cur = conn.cursor()

        if conversation_id_str:
            try:
                conversation_id = int(conversation_id_str)
                is_new_conversation = False
                print(f"Continuing conversation ID: {conversation_id}")

                cur.execute(
                    """
                    SELECT id, parent_message_id, sender_name, message_text, sent_at
                    FROM messages
                    WHERE conversation_id = %s
                    ORDER BY sent_at ASC
                    """,
                    (conversation_id,),
                )
                existing_messages = cur.fetchall()

                if parent_message_id is not None:
                    # Filter to only include the selected branch path and system messages
                    id_map = {m[0]: m for m in existing_messages}
                    path_ids = set()
                    curr = parent_message_id
                    while curr is not None and curr in id_map:
                        path_ids.add(curr)
                        curr = id_map[curr][1]
                    existing_messages = [
                        m
                        for m in existing_messages
                        if m[0] in path_ids or m[2] == "system"
                    ]

                for m in existing_messages:
                    sender = m[2]
                    text = m[3]
                    if sender == "system" and system_message == "":
                        system_message = text
                    else:
                        messages_for_llm.append({"role": sender, "content": text})

            except (ValueError, TypeError):
                print(
                    f"Invalid conversationId received: {conversation_id_str}."
                    "Starting new conversation."
                )
                is_new_conversation = True
                conversation_id = None

        if is_new_conversation:
            conversation_topic = _get_current_date_and_time_string()
            cur.execute(
                """
            INSERT INTO conversations (conversation_topic, user_id)
            VALUES (%s, %s) RETURNING id
            """,
                (conversation_topic, flask_request.current_user['user_id']),
            )
            conversation_id_row = cur.fetchone()
            if not conversation_id_row:
                raise Exception(
                    "Failed to create new conversation and retrieve ID after INSERT."
                )
            conversation_id = conversation_id_row[0]

            if system_message:
                cur.execute(
                    """
                    INSERT INTO messages (conversation_id, message_text, sender_name)
                    VALUES (%s, %s, %s)
                    """,
                    (conversation_id, system_message, "system"),
                )

        messages_for_llm.append({"role": "user", "content": user_text})

        cur.execute(
            """
            INSERT INTO messages 
                (conversation_id, message_text, sender_name, parent_message_id)
            VALUES (%s, %s, %s, %s)
            RETURNING id
            """,
            (conversation_id, user_text, "user", parent_message_id),
        )
        user_message_id = cur.fetchone()[0]
        conn.commit()

    except Exception as e:
        print(f"Error preparing conversation (ID: {conversation_id}): {e}")
        if conn:
            conn.rollback()
        error_data = json.dumps({"error": "Failed to prepare conversation"})
        return flask.Response(f"data: {error_data}\n\n", mimetype="text/event-stream")
    finally:
        if cur:
            cur.close()
        if conn:
            release_db_connection(conn)

    def generate(conv_id, chosen_llm):
        assistant_message_accumulator = []
        print(f"Starting generation for conversation ID: {conv_id}")

        if is_new_conversation:
            new_convo_data = json.dumps({"new_conversation_id": conv_id})
            yield f"data: {new_convo_data}\n\n"

        # Inform client of the user message ID for branching
        if user_message_id is not None:
            user_msg_data = json.dumps({"user_message_id": user_message_id})
            yield f"data: {user_msg_data}\n\n"

        model_to_use = chosen_llm

        try:
            if model_to_use in ANTHROPIC_MODELS:
                anthro_messages = messages_for_llm[:]
                anthro_messages = [m for m in messages_for_llm if m["role"] != "system"]
                with _anthropic_call(
                    model=model_to_use,
                    messages=anthro_messages,
                    system_prompt=system_message or None,
                    max_tokens=MAX_ANTHROPIC_TOKENS,
                    stream=True,
                ) as stream:
                    for chunk in stream:
                        if chunk.type == "content_block_delta":
                            tok = chunk.delta.text
                            assistant_message_accumulator.append(tok)
                            yield f"data: {json.dumps({'token': tok})}\n\n"
            else:
                openai_messages = (
                    [{"role": "system", "content": system_message}]
                    if system_message
                    else []
                ) + messages_for_llm
                params = {
                    "model": model_to_use,
                    "messages": openai_messages,
                    "max_completion_tokens": 1024,
                    "stream": True,
                }
                if model_to_use not in REASONING_MODELS:
                    params["temperature"] = 0.8
                response = OPEN_AI_CHAT_COMPLETIONS_CLIENT.create(**params)

                for chunk in response:
                    if chunk.choices:
                        choice = chunk.choices[0]
                        if choice.delta and choice.delta.content:
                            raw_token = choice.delta.content
                            assistant_message_accumulator.append(raw_token)
                            data_str = json.dumps({"token": raw_token})
                            yield f"data: {data_str}\n\n"

        except Exception as e:
            print(f"Error during streaming from OpenAI for conv {conv_id}: {e}")
            error_data = json.dumps({"error": "Streaming failed"})
            yield f"data: {error_data}\n\n"

        finally:
            final_assistant_text = "".join(assistant_message_accumulator)
            print(
                f"Finished streaming for conv {conv_id}. Final text length: "
                f"{len(final_assistant_text)}"
            )

            if conv_id is not None and final_assistant_text:
                conn2 = None
                cur2 = None
                try:
                    print(f"Attempting to save final message for conv {conv_id}")
                    conn2 = get_db_connection()
                    cur2 = conn2.cursor()
                    provider = (
                        "anthropic" if chosen_llm in ANTHROPIC_MODELS else "openai"
                    )
                    cur2.execute(
                        """
                        INSERT INTO messages (
                            conversation_id,
                            message_text,
                            sender_name,
                            llm_model,
                            llm_provider,
                            parent_message_id
                        )
                        VALUES (%s, %s, %s, %s, %s, %s)
                        RETURNING id
                        """,
                        (
                            conv_id,
                            final_assistant_text,
                            "assistant",
                            chosen_llm,
                            provider,
                            user_message_id,
                        ),
                    )
                    assistant_msg_row = cur2.fetchone()
                    conn2.commit()
                    if assistant_msg_row:
                        assistant_msg_id = assistant_msg_row[0]
                        # Inform client of the assistant message ID for branching
                        assistant_id_data = json.dumps(
                            {"assistant_message_id": assistant_msg_id}
                        )
                        yield f"data: {assistant_id_data}\n\n"
                    print(f"Successfully saved final message for conv {conv_id}")
                except Exception as e:
                    print(
                        "Error saving final assistant message to DB for conv "
                        "{0}: {1}".format(conversation_id, e)
                    )
                    if conn2:
                        conn2.rollback()
                finally:
                    if cur2:
                        cur2.close()
                    if conn2:
                        release_db_connection(conn2)
            elif conv_id is None:
                print("Skipping final save: conversation_id is None.")
            else:
                print(
                    f"Skipping final save for conv {conv_id}: No assistant text generated."
                )

        # Send completion signal to frontend
        completion_data = json.dumps({"stream_complete": True})
        yield f"data: {completion_data}\n\n"

    return flask.Response(
        generate(conversation_id, llm_choice), mimetype="text/event-stream"
    )


@APP.route("/api/conversations", methods=['GET'])
@optional_auth
def get_conversations() -> flaskResponse:
    """
    GET /api/conversations

    Return a list of all conversations with their IDs and topics.
    If user is not authenticated, return empty list.
    """
    # If no user is authenticated, return empty list
    if not flask_request.current_user:
        return flask.jsonify([])

    conn = None
    cur = None
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute(
            """
            SELECT id, conversation_topic
            FROM conversations
            WHERE user_id = %s
            ORDER BY created_at DESC
            """,
            (flask_request.current_user['user_id'],),
        )
        conversations = cur.fetchall()
        return flask.jsonify(
            [{'id': conv[0], 'topic': conv[1]} for conv in conversations]
        )
    except Exception as e:
        print("An error occurred", e)
        return flask.jsonify({'error': 'Internal Server Error'}), 500
    finally:
        if conn:
            cur.close()
            release_db_connection(conn)


@APP.route("/api/messages/<int:conversation_id>", methods=['GET'])
@require_auth
def get_messages(conversation_id: int) -> flaskResponse:
    """
    GET /api/messages/<conversation_id>

    Return all messages for a given conversation in chronological order.
    """
    conn = None
    cur = None
    try:
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        # Ensure conversation belongs to current user
        cur.execute(
            "SELECT 1 FROM conversations WHERE id = %s AND user_id = %s",
            (conversation_id, flask_request.current_user['user_id']),
        )
        if cur.fetchone() is None:
            return flask.jsonify({'error': 'Not found'}), 404
        cur.execute(
            """
            SELECT 
                id, 
                message_text, 
                sender_name, 
                sent_at, 
                llm_model, 
                llm_provider, 
                parent_message_id
            FROM messages
            WHERE conversation_id = %s
            ORDER BY sent_at ASC
            """,
            (conversation_id,),
        )
        messages_raw = cur.fetchall()
        messages_processed = []
        for msg in messages_raw:
            messages_processed.append(
                {
                    'id': msg['id'],
                    'text': msg['message_text'],
                    'sender': msg['sender_name'],
                    'sent_at': msg['sent_at'].isoformat(),
                    'llm_model': msg['llm_model'],
                    'llm_provider': msg['llm_provider'],
                    'parent_message_id': msg.get('parent_message_id'),
                }
            )
        return flask.jsonify(messages_processed)
    except Exception as e:
        print("An error occurred retrieving messages:", e)
        return flask.jsonify({'error': 'Internal Server Error'}), 500
    finally:
        if conn:
            cur.close()
            release_db_connection(conn)


@APP.route("/api/conversations/<int:id>", methods=['PUT'])
@require_auth
def update_conversation(id: int) -> flaskResponse:
    """
    PUT /api/conversations/<id>

    Update the topic of the specified conversation. Expects JSON body with 'topic'.
    """
    data = flask_request.json
    topic = data.get('topic')
    conn = None
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        # Ensure conversation belongs to current user
        cur.execute(
            "SELECT 1 FROM conversations WHERE id = %s AND user_id = %s",
            (id, flask_request.current_user['user_id']),
        )
        if cur.fetchone() is None:
            return flask.jsonify({'error': 'Not found'}), 404
        cur.execute(
            'UPDATE conversations SET conversation_topic = %s WHERE id = %s',
            (topic, id),
        )
        conn.commit()
        return flask.jsonify({'success': True})
    except Exception as e:
        print("An error occurred:", e)
        if conn:
            conn.rollback()
        return flask.jsonify({'error': 'Internal server error'}), 500
    finally:
        if conn:
            cur.close()
            release_db_connection(conn)


@APP.route("/api/conversations/<int:id>", methods=['DELETE'])
@require_auth
def delete_conversation(id: int) -> flaskResponse:
    """
    DELETE /api/conversations/<id>

    Delete the specified conversation and all associated messages.
    """
    conn = None
    cur = None
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        # Ensure conversation belongs to current user
        cur.execute(
            "SELECT 1 FROM conversations WHERE id = %s AND user_id = %s",
            (id, flask_request.current_user['user_id']),
        )
        if cur.fetchone() is None:
            return flask.jsonify({'error': 'Not found'}), 404
        cur.execute("DELETE FROM messages WHERE conversation_id = %s", (id,))
        cur.execute("DELETE FROM conversations WHERE id = %s", (id,))
        conn.commit()
        return flask.jsonify({'success': True})
    except Exception as e:
        print("Error deleting conversation:", e)
        if conn:
            conn.rollback()
        return flask.jsonify({'error': 'Internal Server Error'}), 500
    finally:
        if conn:
            cur.close()
            release_db_connection(conn)


@APP.route("/api/auth/register", methods=['POST'])
def register() -> flaskResponse:
    """
    POST /api/auth/register

    Register a new user with email and password.
    """
    data = flask_request.get_json()
    if not data or not data.get('email') or not data.get('password'):
        return flask.jsonify({'error': 'Email and password are required'}), 400

    email = data['email'].lower().strip()
    password = data['password']

    if len(password) < 6:
        return (
            flask.jsonify({'error': 'Password must be at least 6 characters long'}),
            400,
        )

    conn = None
    cur = None
    try:
        conn = get_db_connection()
        cur = conn.cursor()

        # Check if user already exists
        cur.execute("SELECT id FROM users WHERE email = %s", (email,))
        if cur.fetchone():
            return flask.jsonify({'error': 'User with this email already exists'}), 400

        # Create new user
        password_hash = hash_password(password)
        cur.execute(
            "INSERT INTO users (email, password_hash) VALUES (%s, %s) "
            "RETURNING id, is_admin",
            (email, password_hash),
        )
        user_id, is_admin = cur.fetchone()
        conn.commit()

        # Generate token
        token = generate_token(user_id, email, is_admin)

        return flask.jsonify(
            {
                'token': token,
                'user': {'id': user_id, 'email': email, 'is_admin': is_admin},
            }
        )

    except Exception as e:
        print("Error registering user:", e)
        if conn:
            conn.rollback()
        return flask.jsonify({'error': 'Internal Server Error'}), 500
    finally:
        if conn:
            cur.close()
            release_db_connection(conn)


@APP.route("/api/auth/login", methods=['POST'])
def login() -> flaskResponse:
    """
    POST /api/auth/login

    Login with email and password.
    """
    data = flask_request.get_json()
    if not data or not data.get('email') or not data.get('password'):
        return flask.jsonify({'error': 'Email and password are required'}), 400

    email = data['email'].lower().strip()
    password = data['password']

    conn = None
    cur = None
    try:
        conn = get_db_connection()
        cur = conn.cursor()

        # Find user
        cur.execute(
            "SELECT id, password_hash, is_admin FROM users WHERE email = %s", (email,)
        )
        user = cur.fetchone()

        if not user or not verify_password(password, user[1]):
            return flask.jsonify({'error': 'Invalid email or password'}), 401

        user_id, _, is_admin = user

        # Generate token
        token = generate_token(user_id, email, is_admin)

        return flask.jsonify(
            {
                'token': token,
                'user': {'id': user_id, 'email': email, 'is_admin': is_admin},
            }
        )

    except Exception as e:
        print("Error logging in user:", e)
        return flask.jsonify({'error': 'Internal Server Error'}), 500
    finally:
        if conn:
            cur.close()
            release_db_connection(conn)


@APP.route("/api/auth/me", methods=['GET'])
@require_auth
def get_current_user() -> flaskResponse:
    """
    GET /api/auth/me

    Get current user information from token.
    """
    # Retrieve up-to-date API keys from the database (token payload does not include them)
    user = flask_request.current_user
    conn = None
    cur = None
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute(
            "SELECT openai_api_key, anthropic_api_key FROM users WHERE id = %s",
            (user['user_id'],),
        )
        row = cur.fetchone() or (None, None)
        openai_key, anthropic_key = row
    except Exception as e:
        print(f"Error loading user API keys for user_id={user['user_id']}: {e}")
        openai_key = None
        anthropic_key = None
    finally:
        if conn:
            cur.close()
            release_db_connection(conn)

    return flask.jsonify(
        {
            'user': {
                'id': user['user_id'],
                'email': user['email'],
                'is_admin': user['is_admin'],
                'openai_api_key': openai_key,
                'anthropic_api_key': anthropic_key,
            }
        }
    )


@APP.route("/api/auth/keys", methods=['PUT'])
@require_auth
def update_user_keys() -> flaskResponse:
    """
    PUT /api/auth/keys
    Update the current user's API keys.
    """
    data = flask_request.get_json() or {}
    openai_key = data.get('openai_api_key')
    anthropic_key = data.get('anthropic_api_key')
    conn = None
    cur = None
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute(
            "UPDATE users "
            "SET openai_api_key = %s, anthropic_api_key = %s "
            "WHERE id = %s",
            (openai_key, anthropic_key, flask_request.current_user['user_id']),
        )
        conn.commit()
        return flask.jsonify({'success': True})
    except Exception as e:
        print("Error updating user keys:", e)
        if conn:
            conn.rollback()
        return flask.jsonify({'error': 'Internal Server Error'}), 500
    finally:
        if conn:
            cur.close()
            release_db_connection(conn)


@APP.route("/", defaults={"requested_path": ""})
@APP.route("/<path:requested_path>")
def serve_spa(requested_path: str):
    """
    Serve static files built by Vite or fall back to index.html so React Router deep
    links work in production.
    """
    full_path = pathlib.Path(APP.static_folder) / requested_path

    if requested_path and full_path.exists():
        # Path points to an actual file inside frontend/dist `flask.send_from_directory`
        # still needs string paths.
        return flask.send_from_directory(APP.static_folder, requested_path)

    # Otherwise send index.html for SPA routing
    return flask.send_from_directory(APP.static_folder, "index.html")


def _get_current_date_and_time_string() -> str:
    """Return the current date and time as a human-readable string."""
    now = datetime.now()
    return now.strftime("%B %d, %Y, %-I:%M %p")


def get_db_connection() -> psycopg2.extensions.connection:
    """Get a database connection from the PostgreSQL pool."""
    return postgreSQL_pool.getconn()


def release_db_connection(conn: psycopg2.extensions.connection) -> None:
    """Release a database connection back to the PostgreSQL pool."""
    postgreSQL_pool.putconn(conn)


if __name__ == '__main__':
    APP.run(port=5005, debug=True)
