# Local GPT

1. Five minute demo of the core functionality of this app, which having a conversation
   with branches with an LLM, all in a single conversation view:
   https://www.loom.com/share/97620e12283146a28fdb5900d4199ba3
2. Additional functionality includes: the ability to chat with ChatGPT and Anthropic
   mmodels in the same conversation, auth and login functionality, an d a "Collapse All"
   button.

## Setup

1. Install Python and Node.js. Python 3.12 and Node.js 14+ work; previous versions may
   work as well.
2. Install PostGRES and start it. The following two commands should work assuming you 
   have Homebrew installed:
    1. `brew install postgresql`
    2. `brew services start postgresql`
3. `cd` into the `db` directory and run:
   1. `createdb local-gpt`
   2. `psql -d local-gpt -U <your_username> -a -f db/db.sql`
4. Set your OpenAI and Anthropic API keys:
   ```bash
   export OPENAI_API_KEY="your_openai_api_key"
   export ANTHROPIC_API_KEY="your_anthropic_api_key"
   ```

## Start

`./start-local-gpt.sh`
