# Solana Payment Tracker

Tracks incoming SOL transfers to a specified public key on the Solana Devnet,
using Deno and MongoDB.

## Prerequisites

- Deno v1.36+
- Docker and Docker Compose (for local MongoDB)

## Setup

1. Create a .env file with these variables:
   - ALCHEMY_URL
   - ALCHEMY_API_KEY
   - SOL_PAY_RECEIVER_PUB_KEY
   - SOL_PAY_SENDER_PRIV_KEY
   - MONGODB_URI
   - SOLANA_RPC_URL

2. Start MongoDB locally: make mongo-up

3. Deno automatically handles dependencies. If needed, install them manually:
   deno cache main.ts

## Usage

- Start the main indexer: make dev or deno run -A main.ts

- Run CLI commands: deno run -A src/cli.ts [verb] [args]

  Available verbs:
  - collections
  - txns
  - send
  - sigs

### Examples

- List all DB collections: deno run -A src/cli.ts collections

- Fetch recent transactions: deno run -A src/cli.ts txns

- Send 0.001 SOL: deno run -A src/cli.ts send 0.001

## Stopping Services

- Stop Mongo: make mongo-down

## Notes

- Check config.ts for environment variable handling.
- The tracker automatically retries on failure with exponential backoff.

## License

MIT
