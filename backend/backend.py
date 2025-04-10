from datetime import datetime
import json

import flask
from flask import request as flask_request
from flask.wrappers import Response as flaskResponse
import flask_cors
import openai
import psycopg2.extensions, psycopg2.pool

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
            model="chatgpt-4o-latest",
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
            "VALUES (%s, %s, %s)",
            (conversation_id, chat_completions_message_content, "assistant"),
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
    system_message = flask_request.args.get("systemMessage", "")

    # We'll create a new conversation topic from the date/time:
    conversation_topic = _get_current_date_and_time_string()

    # Insert the conversation and user/system messages in DB
    conn = None
    cur = None
    conversation_id = None

    try:
        conn = get_db_connection()
        cur = conn.cursor()

        # Insert new conversation
        cur.execute(
            "INSERT INTO conversations (conversation_topic) VALUES (%s) RETURNING id",
            (conversation_topic,),
        )
        conversation_id = cur.fetchone()[0]

        # Insert user message
        cur.execute(
            "INSERT INTO messages (conversation_id, message_text, sender_name) "
            "VALUES (%s, %s, %s)",
            (conversation_id, user_text, "user"),
        )

        # Insert system message
        cur.execute(
            "INSERT INTO messages (conversation_id, message_text, sender_name) "
            "VALUES (%s, %s, %s)",
            (conversation_id, system_message, "system"),
        )

        conn.commit()

    except Exception as e:
        print("Error creating conversation/messages:", e)
        if conn:
            conn.rollback()
    finally:
        if conn:
            cur.close()
            release_db_connection(conn)

    # SSE generator
    def generate(conv_id):  # Pass conversation_id explicitly
        assistant_message_accumulator = []
        print(f"Starting generation for conversation ID: {conv_id}")  # Add log

        try:
            messages = [
                {"role": "system", "content": system_message},
                {"role": "user", "content": user_text},
            ]

            response = OPEN_AI_CHAT_COMPLETIONS_CLIENT.create(
                model="chatgpt-4o-latest",
                messages=messages,
                temperature=0.8,
                max_tokens=1024,
                stream=True,
            )

            # --- CORRECTED CHUNK PROCESSING ---
            for chunk in response:
                if chunk.choices:
                    choice = chunk.choices[0]  # Get the first choice
                    if choice.delta and choice.delta.content:  # Check delta and content
                        raw_token = choice.delta.content  # Get token content
                        assistant_message_accumulator.append(raw_token)

                        # SSE needs lines with "data: ..."
                        data_str = json.dumps({"token": raw_token})
                        # print(f"Yielding: {data_str}")
                        yield f"data: {data_str}\n\n"
            # --- END CORRECTION ---

        except Exception as e:
            print(f"Error during streaming from OpenAI for conv {conv_id}: {e}")
            # yield an error event to the frontend
            error_data = json.dumps({"error": "Streaming failed"})
            yield f"data: {error_data}\n\n"
        finally:
            # Once the stream is complete, store the final assistant text in DB
            final_assistant_text = "".join(assistant_message_accumulator)
            print(
                f"Finished streaming for conv {conv_id}. Final text length: {len(final_assistant_text)}"
            )  # Add log

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
                        "INSERT INTO messages (conversation_id, message_text, sender_name) "
                        "VALUES (%s, %s, %s)",
                        (conv_id, final_assistant_text, "assistant"),
                    )
                    conn2.commit()
                    # Add log
                    print(f"Successfully saved final message for conv {conv_id}")
                except Exception as e:
                    print(
                        f"Error saving final assistant message to DB for conv {conv_id}: {e}"
                    )
                    if conn2:
                        conn2.rollback()
                finally:
                    if cur2:  # Close cursor if it was opened
                        cur2.close()
                    if conn2:
                        release_db_connection(conn2)
                        # Add log
                        print(f"Released final save connection for conv {conv_id}")
            elif conv_id is None:
                print("Skipping final save: conversation_id is None.")
            else:
                print(
                    f"Skipping final save for conv {conv_id}: No assistant text generated."
                )

    # Return an EventStream (SSE) response
    # Pass the conversation_id obtained earlier to the generator
    return flask.Response(generate(conversation_id), mimetype="text/event-stream")


@FLASK_APP.route("/api/conversations", methods=['GET'])
def get_conversations() -> flaskResponse:
    conn = None
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
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute(
            "SELECT message_text, sender_name "
            "FROM messages "
            "WHERE conversation_id = %s",
            (conversation_id,),
        )
        messages = cur.fetchall()
        return flask.jsonify([{'text': msg[0], 'sender': msg[1]} for msg in messages])
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
