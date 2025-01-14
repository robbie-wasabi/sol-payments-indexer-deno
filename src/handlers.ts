import {
    Connection,
    Keypair,
    LAMPORTS_PER_SOL,
    PublicKey,
    SystemProgram,
    Transaction,
} from 'npm:@solana/web3.js@1.87.6'
import 'https://deno.land/std@0.220.1/dotenv/load.ts'
import { Database } from 'https://deno.land/x/mongo@v0.32.0/mod.ts'

export const collectionsHandler = async (
    db: Database,
    collection?: string,
): Promise<any[] | string[]> => {
    try {
        if (collection) {
            return await db.collection(collection).find().toArray()
        }
        const collections = await db.listCollections().toArray()
        return collections.map((col) => col.name)
    } catch (error) {
        console.error('Failed to fetch collections:', error)
        throw error
    }
}

export async function getConfirmedTransactionsHandler(
    connection: Connection,
    pubKey: PublicKey,
): Promise<any[]> {
    try {
        const confirmedSignatures = await connection.getSignaturesForAddress(
            pubKey,
            { limit: 100 },
        )

        if (!confirmedSignatures.length) {
            console.log('No confirmed transactions found.')
            return []
        }

        console.log(
            `Found ${confirmedSignatures.length} confirmed transactions`,
        )

        return confirmedSignatures.map(({ signature }) => signature)
    } catch (error) {
        console.error('Failed to fetch confirmed transactions:', error)
        throw error
    }
}

export async function sendHandler(
    connection: Connection,
    senderKeypair: Keypair,
    pubKey: PublicKey,
    amountToSend: number,
) {
    const transaction = new Transaction().add(
        SystemProgram.transfer({
            fromPubkey: senderKeypair.publicKey,
            toPubkey: pubKey,
            lamports: amountToSend * LAMPORTS_PER_SOL,
        }),
    )

    const { blockhash, lastValidBlockHeight } = await connection
        .getLatestBlockhash()
    transaction.recentBlockhash = blockhash
    transaction.feePayer = senderKeypair.publicKey
    transaction.sign(senderKeypair)

    try {
        const signature = await connection.sendEncodedTransaction(
            transaction.serialize().toString('base64'),
        )

        console.log(`Sending ${amountToSend} SOL to ${pubKey.toBase58()}`)
        console.log(`Transaction signature: ${signature}`)

        const confirmation = await connection.confirmTransaction({
            signature,
            blockhash,
            lastValidBlockHeight,
        })

        if (confirmation.value.err) {
            throw new Error(`Transaction failed: ${confirmation.value.err}`)
        }

        console.log('Transaction confirmed!')
        return signature
    } catch (err) {
        console.error('Transaction failed:', err)
        throw err
    }
}

export async function getSignaturesBeforeHandler(
    connection: Connection,
    pubKey: PublicKey,
    beforeSignature: string,
): Promise<any[]> {
    return await connection.getSignaturesForAddress(pubKey, {
        before: beforeSignature,
    })
}

export async function getSignaturesUntilHandler(
    connection: Connection,
    pubKey: PublicKey,
    untilSignature: string,
): Promise<any[]> {
    return await connection.getSignaturesForAddress(pubKey, {
        until: untilSignature,
    })
}
