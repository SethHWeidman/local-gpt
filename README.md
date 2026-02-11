# Local GPT

1. Five minute demo of the core functionality of this app, which having a conversation
   with branches with an LLM, all in a single conversation view:
   https://www.loom.com/share/97620e12283146a28fdb5900d4199ba3
2. Additional functionality includes: the ability to chat with ChatGPT and Anthropic
   models in the same conversation, auth and login functionality, and a "Collapse All"
   button.

## Setup

1. Install Python and Node.js. Python 3.12 and Node.js 14+ work; previous versions may
   work as well.
2. Install PostGRES and start it. The following two commands should work assuming you
   have Homebrew installed:
   1. `brew install postgresql`
   2. `brew services start postgresql`
3. From the repo root, run:
   1. `createdb local-gpt`
   2. `python scripts/migrate.py`
4. Set your OpenAI and Anthropic API keys:
   ```bash
   export OPENAI_API_KEY="your_openai_api_key"
   export ANTHROPIC_API_KEY="your_anthropic_api_key"
   ```

## Start

`./start-local-gpt.sh`

## Database schema + password reset

### Load environment

```sh
cd /Users/seth/repos/local-gpt
set -a && source .env && set +a
```

### Initialize or migrate schema

```sh
python scripts/migrate.py
```

This script is safe to re-run; it tracks applied migrations.

### Reset a user's password

```sh
scripts/reset-user-password.sh seth@sethweidman.com cibQip-tiqdez-9jinno
```

Replace the email and password arguments as needed.

## Heroku

Heroku app name: `blooming-depths-55073`.

### Connect to the production database

```sh
heroku pg:psql -a blooming-depths-55073
```

### View and update environment variables

View all config vars:

```sh
heroku config -a blooming-depths-55073
```

Get a single config var:

```sh
heroku config:get DATABASE_URL -a blooming-depths-55073
```

Set a config var:

```sh
heroku config:set KEY=value -a blooming-depths-55073
```

Unset a config var:

```sh
heroku config:unset KEY -a blooming-depths-55073
```
