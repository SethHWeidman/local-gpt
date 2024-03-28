import flask
from flask import request as flask_request

import flask_cors
import openai


app = flask.Flask(__name__)
flask_cors.CORS(app)

OPENAI = openai.OpenAI()
OPENAI_CHAT_RESOURCE = OPENAI.chat
OPEN_AI_CHAT_COMPLETIONS_CLIENT = OPENAI_CHAT_RESOURCE.completions


@app.route('/submit-interaction', methods=['POST', 'OPTIONS'])
def submit_text():
    if flask_request.method == 'OPTIONS':
        return _build_cors_preflight_response()
    flask_request_json = flask_request.json

    user_text = flask_request_json.get('userText', '')
    system_message = flask_request_json.get('systemMessage', '')

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

    # Respond back with the OpenAI response
    chat_completions_choice = chat_completion.choices[0]
    chat_completions_message = chat_completions_choice.message
    return flask.jsonify({'GPT-4 Response': chat_completions_message.content})


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


if __name__ == '__main__':
    app.run(port=5005, debug=True)
