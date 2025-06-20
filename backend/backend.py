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
import psycopg2.extensions, psycopg2.pool
from tree_utils import (
    get_conversation_path,
    get_conversation_tree,
    get_message_children,
    get_next_branch_order,
    messages_to_llm_format,
    set_active_message,
)

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
    Now supports tree-based conversations with branching.

    Steps:
    1. Create or continue a conversation record in the database.
    2. Save user message as a child of the specified parent message.
    3. Get the conversation path for context.
    4. Stream tokens from the chosen LLM to the client in real time.
    5. Persist the final assistant message and update active message.
    """
    user_text = flask_request.args.get("userText", "")
    system_message = flask_request.args.get("systemMessage", "")
    conversation_id_str = flask_request.args.get("conversationId")
    parent_message_id_str = flask_request.args.get("parentMessageId")
    llm_choice = flask_request.args.get("llm", "gpt-4.1-2025-04-14")

    conn = None
    cur = None
    conversation_id = None
    parent_message_id = None
    is_new_conversation = True
    messages_for_llm = []

    try:
        conn = get_db_connection()
        cur = conn.cursor()

        if conversation_id_str:
            try:
                conversation_id = int(conversation_id_str)
                is_new_conversation = False
                print(f"Continuing conversation ID: {conversation_id}")

                # Get the conversation path for context
                if parent_message_id_str:
                    parent_message_id = int(parent_message_id_str)
                    # Get path from root to parent message
                    path_messages = get_conversation_path(
                        cur, conversation_id, parent_message_id
                    )
                else:
                    # Get current active path
                    path_messages = get_conversation_path(cur, conversation_id)

                # Extract system message and convert to LLM format
                for msg in path_messages:
                    if msg['sender'] == "system" and system_message == "":
                        system_message = msg['text']

                messages_for_llm = messages_to_llm_format(path_messages, system_message)

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
                    INSERT INTO messages (conversation_id, message_text, sender_name, parent_message_id, branch_order)
                    VALUES (%s, %s, %s, %s, %s) RETURNING id
                    """,
                    (conversation_id, system_message, "system", None, 0),
                )
                system_msg_result = cur.fetchone()
                if system_msg_result:
                    parent_message_id = system_msg_result[0]

        # Get the next branch order for the new user message
        branch_order = get_next_branch_order(cur, parent_message_id)

        # Insert the user message
        cur.execute(
            """
            INSERT INTO messages (conversation_id, message_text, sender_name, parent_message_id, branch_order)
            VALUES (%s, %s, %s, %s, %s) RETURNING id
            """,
            (conversation_id, user_text, "user", parent_message_id, branch_order),
        )
        user_message_result = cur.fetchone()
        if not user_message_result:
            raise Exception("Failed to insert user message")

        user_message_id = user_message_result[0]
        messages_for_llm.append({"role": "user", "content": user_text})

        set_active_message(cur, conversation_id, user_message_id)

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

    def generate(conv_id, chosen_llm, user_msg_id):
        assistant_message_accumulator = []
        print(f"Starting generation for conversation ID: {conv_id}")

        if is_new_conversation:
            new_convo_data = json.dumps({"new_conversation_id": conv_id})
            yield f"data: {new_convo_data}\n\n"

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
            print(f"Error during streaming from LLM for conv {conv_id}: {e}")
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

                    # Get the next branch order for the assistant message
                    assistant_branch_order = get_next_branch_order(cur2, user_msg_id)

                    cur2.execute(
                        """
                        INSERT INTO messages (
                            conversation_id, 
                            message_text, 
                            sender_name, 
                            llm_model, 
                            llm_provider,
                            parent_message_id,
                            branch_order
                        )
                        VALUES (%s, %s, %s, %s, %s, %s, %s) RETURNING id
                        """,
                        (
                            conv_id,
                            final_assistant_text,
                            "assistant",
                            chosen_llm,
                            provider,
                            user_msg_id,
                            assistant_branch_order,
                        ),
                    )
                    assistant_msg_result = cur2.fetchone()
                    if assistant_msg_result:
                        assistant_msg_id = assistant_msg_result[0]
                        # Set this as the active message for the conversation
                        set_active_message(cur2, conv_id, assistant_msg_id)

                    conn2.commit()
                    print(f"Successfully saved final message for conv {conv_id}")
                except Exception as e:
                    print(
                        "Error saving final assistant message to DB for conv "
                        "{0}: {1}".format(conv_id, e)
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
                    f"Skipping final save for conv {conv_id}: No assistant text "
                    "generated."
                )

    return flask.Response(
        generate(conversation_id, llm_choice, user_message_id),
        mimetype="text/event-stream",
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

    Return the active path of messages for a given conversation.
    """
    conn = None
    cur = None
    try:
        conn = get_db_connection()
        cur = conn.cursor()

        # Optionally override active message via query param for UI navigation
        active_id_param = flask_request.args.get('activeMessageId')
        try:
            active_id = int(active_id_param) if active_id_param is not None else None
        except (ValueError, TypeError):
            active_id = None
        # Get the active path for this conversation (uses provided or stored active_message_id)
        path_messages = get_conversation_path(cur, conversation_id, active_id)

        return flask.jsonify(path_messages)
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


@FLASK_APP.route("/api/conversations/<int:conversation_id>/tree", methods=['GET'])
def get_conversation_tree_endpoint(conversation_id: int) -> flaskResponse:
    """
    GET /api/conversations/<conversation_id>/tree

    Return the complete tree structure for a conversation.
    """
    conn = None
    cur = None
    try:
        conn = get_db_connection()
        cur = conn.cursor()

        tree = get_conversation_tree(cur, conversation_id)

        # Also get the active message ID
        cur.execute(
            "SELECT active_message_id FROM conversations WHERE id = %s",
            (conversation_id,),
        )
        result = cur.fetchone()
        active_message_id = result[0] if result else None

        return flask.jsonify({'tree': tree, 'active_message_id': active_message_id})
    except Exception as e:
        print("An error occurred retrieving conversation tree:", e)
        return flask.jsonify({'error': 'Internal Server Error'}), 500
    finally:
        if conn:
            cur.close()
            release_db_connection(conn)


@FLASK_APP.route(
    "/api/conversations/<int:conversation_id>/active-message", methods=['PUT']
)
def set_active_message_endpoint(conversation_id: int) -> flaskResponse:
    """
    PUT /api/conversations/<conversation_id>/active-message

    Set the active message for a conversation. Expects JSON body with 'message_id'.
    """
    data = flask_request.json
    message_id = data.get('message_id')

    if not message_id:
        return flask.jsonify({'error': 'message_id is required'}), 400

    conn = None
    cur = None
    try:
        conn = get_db_connection()
        cur = conn.cursor()

        # Verify the message belongs to this conversation
        cur.execute(
            "SELECT id FROM messages WHERE id = %s AND conversation_id = %s",
            (message_id, conversation_id),
        )
        if not cur.fetchone():
            return flask.jsonify({'error': 'Message not found in conversation'}), 404

        set_active_message(cur, conversation_id, message_id)
        conn.commit()

        return flask.jsonify({'success': True})
    except Exception as e:
        print("An error occurred setting active message:", e)
        if conn:
            conn.rollback()
        return flask.jsonify({'error': 'Internal Server Error'}), 500
    finally:
        if conn:
            cur.close()
            release_db_connection(conn)


@FLASK_APP.route("/api/messages/<int:message_id>/children", methods=['GET'])
def get_message_children_endpoint(message_id: int) -> flaskResponse:
    """
    GET /api/messages/<message_id>/children

    Get all direct children of a message.
    """
    conn = None
    cur = None
    try:
        conn = get_db_connection()
        cur = conn.cursor()

        children = get_message_children(cur, message_id)

        return flask.jsonify(children)
    except Exception as e:
        print("An error occurred retrieving message children:", e)
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
