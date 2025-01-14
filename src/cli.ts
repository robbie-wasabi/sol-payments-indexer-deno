import { MongoClient } from 'https://deno.land/x/mongo@v0.32.0/mod.ts'
import { Connection, Keypair, PublicKey } from 'npm:@solana/web3.js@1.87.6'
import {
    MONGODB_URI,
    SOL_PAY_RECEIVER_PUB_KEY,
    SOL_PAY_SENDER_PRIV_KEY,
    SOLANA_RPC_URL,
} from '../config.ts'
import {
    collectionsHandler,
    getConfirmedTransactionsHandler,
    getSignaturesBeforeHandler,
    getSignaturesUntilHandler,
    sendHandler,
} from './handlers.ts'
import bs58 from 'npm:bs58'

const verb = Deno.args[0]
const a = Deno.args[1]
const b = Deno.args[2]

const client = new MongoClient()
await client.connect(MONGODB_URI)
const db = client.database()

// alchemy devnet url doesn't work with deno for some reason
const connection = new Connection(SOLANA_RPC_URL, 'confirmed')

// testing
const recipientPubKey = new PublicKey(SOL_PAY_RECEIVER_PUB_KEY)
const senderKeypair = Keypair.fromSecretKey(
    bs58.decode(SOL_PAY_SENDER_PRIV_KEY),
)

if (verb === 'collections') {
    const collections = await collectionsHandler(db, a)
    console.log(collections)
} else if (verb === 'txns') {
    const txns = await getConfirmedTransactionsHandler(
        connection,
        recipientPubKey,
    )
    console.log(txns)
} else if (verb === 'send') {
    const amountToSend = Number(a ?? 0.0001)
    const txns = await sendHandler(
        connection,
        senderKeypair,
        recipientPubKey,
        amountToSend,
    )
    console.log(txns)
} else if (verb === 'sigs') {
    if (a == 'before') {
        const sigs = await getSignaturesBeforeHandler(
            connection,
            recipientPubKey,
            b,
        )
        console.log(sigs)
    } else if (a == 'until') {
        const sigs = await getSignaturesUntilHandler(
            connection,
            recipientPubKey,
            b,
        )
        console.log(sigs)
    } else {
        console.error('Invalid verb')
    }
} else {
    console.error('Invalid verb')
}

await client.close()
