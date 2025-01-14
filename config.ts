import 'https://deno.land/std@0.220.1/dotenv/load.ts'

const ALCHEMY_URL: string = Deno.env.get('ALCHEMY_URL') ?? ''
if (ALCHEMY_URL === '') throw new Error('ALCHEMY_URL not found')

const ALCHEMY_API_KEY: string = Deno.env.get('ALCHEMY_API_KEY') ?? ''
if (ALCHEMY_API_KEY === '') throw new Error('ALCHEMY_API_KEY not found')

const SOL_PAY_RECEIVER_PUB_KEY: string =
    Deno.env.get('SOL_PAY_RECEIVER_PUB_KEY') ?? ''
if (SOL_PAY_RECEIVER_PUB_KEY === '') {
    throw new Error('SOL_PAY_RECEIVER_PUB_KEY not found')
}

const MONGODB_URI: string = Deno.env.get('MONGODB_URI') ?? ''
if (MONGODB_URI === '') throw new Error('MONGODB_URI not found')

const SOL_PAY_SENDER_PRIV_KEY: string = Deno.env.get(
    'SOL_PAY_SENDER_PRIV_KEY',
) ?? ''
if (SOL_PAY_SENDER_PRIV_KEY === '') {
    throw new Error('SOL_PAY_SENDER_PRIV_KEY not found')
}

const SOLANA_RPC_URL: string = Deno.env.get('SOLANA_RPC_URL') ?? ''
if (SOLANA_RPC_URL === '') throw new Error('SOLANA_RPC_URL not found')

const ALCHEMY_URI = `${ALCHEMY_URL}/${ALCHEMY_API_KEY}`

export {
    ALCHEMY_API_KEY,
    ALCHEMY_URI,
    MONGODB_URI,
    SOL_PAY_RECEIVER_PUB_KEY,
    SOL_PAY_SENDER_PRIV_KEY,
    SOLANA_RPC_URL,
}
