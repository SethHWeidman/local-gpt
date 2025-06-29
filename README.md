# Local GPT

Demo coming soon :)

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
