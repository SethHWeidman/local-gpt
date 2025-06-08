# Local GPT

Local GPT is a way to access ChatGPT and other LLMs for a much lower cost than accessing
them via their web UIs.

**Features:**

* Engage in a conversation with ChatGPT and Claude
* Modify the system message to change the model behavior
* Access your prior interactions via a sidebar

## Setup

1. Install Python and React. Python 3.12 and React 18 work; previous Python and React
   versions may work as well.
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

## Still to build

1. Delete mode fixes:
    1. Move toggle to the top right of ConversationPanel
2. Make the ConversationPanel a scrollable element
3. ConversationPanel UI fixes:
    1. Highlight each element on hover