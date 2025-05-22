from datetime import datetime
import json

import flask
from flask import request as flask_request
from flask.wrappers import Response as flaskResponse
import flask_cors
import openai
import psycopg2.extensions, psycopg2.extras, psycopg2.pool

# Setup connection pool
postgreSQL_pool = psycopg2.pool.SimpleConnectionPool(
    1,  # minconn
    20,  # maxconn
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


@FLASK_APP.route('/submit-interaction', methods=['POST', 'OPTIONS'])
def submit_text() -> flaskResponse:
    if flask_request.method == 'OPTIONS':
        return _build_cors_preflight_response()
    flask_request_json = flask_request.json

    user_text = flask_request_json.get('userText', '')
    system_message = flask_request_json.get('systemMessage', '')

    conversation_topic = _get_current_date_and_time_string()

    # initialize DB connection
    conn = None
    try:
        conn = get_db_connection()
    except:
        print("An error occurred:", e)

    cur = None
    try:
        cur = conn.cursor()
        cur.execute(
            "INSERT INTO conversations (conversation_topic) "
            "VALUES (%s) "
            "RETURNING id",
            (conversation_topic,),
        )
        conversation_id = cur.fetchone()[0]

        # Insert the user message
        cur.execute(
            "INSERT INTO messages (conversation_id, message_text, sender_name) "
            "VALUES (%s, %s, %s)",
            (conversation_id, user_text, "user"),
        )

        # Insert the system message
        cur.execute(
            "INSERT INTO messages (conversation_id, message_text, sender_name) "
            "VALUES (%s, %s, %s)",
            (conversation_id, system_message, "system"),
        )

        # Send request to OpenAI
        chat_completion = OPEN_AI_CHAT_COMPLETIONS_CLIENT.create(
            model="gpt-4.1-2025-04-14",
            messages=[
                {"role": "system", "content": system_message},
                {"role": "user", "content": user_text},
            ],
            max_tokens=1024,
            temperature=1,
        )

        chat_completions_message_content = chat_completion.choices[0].message.content

        # Insert the assistant message
        cur.execute(
            "INSERT INTO messages (conversation_id, message_text, sender_name) "
            "VALUES (%s, %s, %s, %s)",
            # For this non-streaming endpoint, default to 'chatgpt' or pass if available
            (conversation_id, chat_completions_message_content, "assistant", "chatgpt"),
        )

        # Commit transaction
        conn.commit()
    except Exception as e:
        print("An error occurred:", e)
        conn.rollback()

    finally:
        if conn:
            release_db_connection(conn)

    return flask.jsonify({'GPT-4 Response': chat_completions_message_content})


@FLASK_APP.route("/stream", methods=["GET"])
def stream_interaction() -> flaskResponse:
    """
    1. Creates a new conversation in the DB.
    2. Saves user/system messages.
    3. Streams partial tokens from OpenAI.
    4. Once streaming is done, saves the assistant's final message to DB.
    """
    user_text = flask_request.args.get("userText", "")
    # Still useful for the *start* of a convo
    system_message = flask_request.args.get("systemMessage", "")
    # Optional ID from frontend
    conversation_id_str = flask_request.args.get("conversationId")
    # <<< Get LLM choice, default to 'chatgpt'
    llm_choice = flask_request.args.get("llm", "chatgpt")

    conn = None
    cur = None
    conversation_id = None
    is_new_conversation = True
    messages_for_llm = []

    # We'll create a new conversation topic from the date/time:
    conversation_topic = _get_current_date_and_time_string()

    # Insert the conversation and user/system messages in DB
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

                # Fetch existing messages for the context
                cur.execute(
                    """SELECT sender_name, message_text
                       FROM messages
                       WHERE conversation_id = %s
                       ORDER BY sent_at ASC""",  # Important: maintain order
                    (conversation_id,),
                )
                existing_messages = cur.fetchall()

                # Format for OpenAI API
                for msg in existing_messages:
                    # Map sender_name ('user', 'assistant', 'system') to OpenAI 'role'
                    role = msg[0]  # sender_name is at index 0
                    content = msg[1]  # message_text is at index 1
                    # 'system' message should only be sent once usually,
                    # or handle how you want context managed.
                    # Simple approach: Include all for now.
                    messages_for_llm.append({"role": role, "content": content})

            except (ValueError, TypeError):
                print(
                    f"Invalid conversationId received: {conversation_id_str}."
                    "Starting new conversation."
                )
                is_new_conversation = True
                conversation_id = None  # Reset ID

        # If it's a new conversation, create it
        if is_new_conversation:
            conversation_topic = _get_current_date_and_time_string()
            cur.execute(
                "INSERT INTO conversations (conversation_topic) "
                "VALUES (%s) RETURNING id",
                (conversation_topic,),
            )
            conversation_id_row = cur.fetchone()
            # Good practice to check if anything was returned
            if not conversation_id_row:
                raise Exception(
                    "Failed to create new conversation and retrieve ID after INSERT."
                )
            # Access the first element of the tuple
            conversation_id = conversation_id_row[0]

            # Add system message to DB and LLM context (if provided)
            if system_message:
                cur.execute(
                    "INSERT INTO messages (conversation_id, message_text, sender_name) "
                    "VALUES (%s, %s, %s)",
                    (conversation_id, system_message, "system"),
                )
                messages_for_llm.append({"role": "system", "content": system_message})
            # Commit conversation creation and system message

        # --- Always add the *current* user message ---
        messages_for_llm.append({"role": "user", "content": user_text})

        # --- Always save the *current* user message to DB ---
        cur.execute(
            "INSERT INTO messages "
            "(conversation_id, message_text, sender_name) VALUES (%s, %s, %s)",
            (conversation_id, user_text, "user"),
        )
        conn.commit()  # Commit user message *before* streaming starts

    except Exception as e:
        print(f"Error preparing conversation (ID: {conversation_id}): {e}")
        if conn:
            conn.rollback()
        # How to handle error response here? Maybe yield an error event.
        error_data = json.dumps({"error": "Failed to prepare conversation"})
        return flask.Response(f"data: {error_data}\n\n", mimetype="text/event-stream")
    finally:
        # Close cursor early, keep connection for generator if needed for saving later
        if cur:
            cur.close()
        # Don't release connection yet if needed in `generate` for saving the assistant
        # message

    # SSE generator
    # Pass conversation_id explicitly
    def generate(conv_id, chosen_llm):
        assistant_message_accumulator = []
        print(f"Starting generation for conversation ID: {conv_id}")  # Add log

        # Send initial message indicating new conversation ID if needed
        if is_new_conversation:
            new_convo_data = json.dumps({"newConversationId": conv_id})
            yield f"data: {new_convo_data}\n\n"

            # TODO: Add logic here to choose the correct model/API client based on chosen_llm
            # For now, we'll still use OpenAI but will save `chosen_llm`
            model_to_use = "gpt-4o"  # Default or map from chosen_llm
            if chosen_llm == "claude":  # Example for future
                # model_to_use = "claude-model-name"
                # Use Claude client instead of OPEN_AI_CHAT_COMPLETIONS_CLIENT
                pass

        try:
            # --- Send accumulated history to OpenAI ---
            response = OPEN_AI_CHAT_COMPLETIONS_CLIENT.create(
                model="gpt-4.1-2025-04-14",
                messages=messages_for_llm,  # Use the prepared history
                temperature=0.8,
                max_tokens=1024,
                stream=True,
            )

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
            # Once the stream is complete, store the final assistant text in DB
            final_assistant_text = "".join(assistant_message_accumulator)
            # Add log
            print(
                f"Finished streaming for conv {conv_id}. Final text length: {len(final_assistant_text)}"
            )

            # Check we have ID and text
            if conv_id is not None and final_assistant_text:
                conn2 = None
                cur2 = None  # Define cur2 before try block
                try:
                    # Add log
                    print(f"Attempting to save final message for conv {conv_id}")
                    conn2 = get_db_connection()
                    cur2 = conn2.cursor()
                    cur2.execute(
                        "INSERT INTO messages "
                        "(conversation_id, message_text, sender_name) "
                        "VALUES (%s, %s, %s)",
                        (conv_id, final_assistant_text, "assistant"),
                    )
                    conn2.commit()
                    # Add log
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

    # Return an EventStream (SSE) response
    # Pass the conversation_id obtained earlier to the generator
    return flask.Response(
        generate(conversation_id, llm_choice), mimetype="text/event-stream"
    )


@FLASK_APP.route("/api/conversations", methods=['GET'])
def get_conversations() -> flaskResponse:
    conn = None
    cur = None  # Initialize cur to None
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute(
            '''
            SELECT id, conversation_topic 
            FROM conversations 
            ORDER BY created_at DESC
            '''
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
    conn = None
    cur = None  # Initialize cur to None
    try:
        conn = get_db_connection()
        # Use RealDictCursor for dict-like rows
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute(
            """SELECT id, message_text, sender_name, sent_at, llm_model
               FROM messages
               WHERE conversation_id = %s
               ORDER BY sent_at ASC""",
            (conversation_id,),
        )
        messages_raw = cur.fetchall()
        # Map to frontend expected structure if needed, or ensure frontend adapts
        messages_processed = []
        for msg in messages_raw:
            messages_processed.append(
                {
                    'id': msg['id'],  # Good to have message ID on frontend
                    'text': msg['message_text'],
                    'sender': msg['sender_name'],
                    # Send timestamp as ISO string
                    'sent_at': msg['sent_at'].isoformat(),
                    'llm_model': msg['llm_model'],  # Include llm_model
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
    conn = None
    cur = None  # Initialize cur to None
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        # Delete messages first due to foreign key constraint
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


def _build_cors_preflight_response() -> flaskResponse:
    response = flask.jsonify({})
    response_headers = response.headers
    response_headers.add('Access-Control-Allow-Origin', '*')
    response_headers.add(
        'Access-Control-Allow-Headers',
        "Origin, X-Requested-With, Content-Type, Accept, Authorization",
    )
    response_headers.add('Access-Control-Allow-Methods', "GET, POST, PATCH, DELETE")
    return response


def _get_current_date_and_time_string() -> str:
    # Get the current date and time
    now = datetime.now()

    # Format the date and time
    return now.strftime("%B %d, %Y, %-I:%M %p")


def get_db_connection() -> psycopg2.extensions.connection:
    return postgreSQL_pool.getconn()


def release_db_connection(conn: psycopg2.extensions.connection) -> None:
    postgreSQL_pool.putconn(conn)


if __name__ == '__main__':
    FLASK_APP.run(port=5005, debug=True)
