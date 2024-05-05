from datetime import datetime

import flask
from flask import request as flask_request
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


@app.route('/submit-interaction', methods=['POST', 'OPTIONS'])
def submit_text():
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


def _build_cors_preflight_response():
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
