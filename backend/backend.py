from datetime import datetime

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
    user="sethweidman",
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
            model="gpt-4-0125-preview",
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
