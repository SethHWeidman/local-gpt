"""
Flask backend for Local-GPT.

Provides endpoints for:
- managing conversations and messages.
- streaming LLM responses via Server-Sent Events (SSE).
- database connection pooling and CORS preflight handling.
"""

from datetime import datetime
import json
import pathlib

import flask
from flask import request as flask_request
from flask.wrappers import Response as flaskResponse
import flask_cors
import openai
import anthropic
import psycopg2.extensions, psycopg2.extras, psycopg2.pool

## Connection pool for PostgreSQL database.
postgreSQL_pool = psycopg2.pool.SimpleConnectionPool(
    1,
    20,
    user="seth",
    password="newpassword",
    host="localhost",
    port="5432",
    database="local-gpt",
)


FLASK_APP = flask.Flask(__name__)
flask_cors.CORS(FLASK_APP)


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


@FLASK_APP.route("/stream", methods=["GET"])
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
                INSERT INTO conversations (conversation_topic)
                VALUES (%s) RETURNING id
                """,
                (conversation_topic,),
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

    return flask.Response(
        generate(conversation_id, llm_choice), mimetype="text/event-stream"
    )


@FLASK_APP.route("/api/conversations", methods=['GET'])
def get_conversations() -> flaskResponse:
    """
    GET /api/conversations

    Return a list of all conversations with their IDs and topics.
    """
    conn = None
    cur = None
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute(
            """
            SELECT id, conversation_topic
            FROM conversations
            ORDER BY created_at DESC
            """
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


@FLASK_APP.route("/api/messages/<int:conversation_id>", methods=['GET'])
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


@FLASK_APP.route("/api/conversations/<int:id>", methods=['PUT'])
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


@FLASK_APP.route("/api/conversations/<int:id>", methods=['DELETE'])
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
    FLASK_APP.run(port=5005, debug=True)
