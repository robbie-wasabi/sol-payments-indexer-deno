import { Connection, PublicKey } from 'npm:@solana/web3.js@1.87.6'
import { MongoClient, ObjectId } from 'https://deno.land/x/mongo@v0.32.0/mod.ts'
import 'https://deno.land/std@0.220.1/dotenv/load.ts'
import {
  ALCHEMY_URI,
  MONGODB_URI,
  SOL_PAY_RECEIVER_PUB_KEY,
} from '../config.ts'

interface Transaction {
  _id: ObjectId
  transactionId: string
  sender: string
  amount: number
  status: string
  meta?: unknown
}

interface ServiceState {
  _id: ObjectId
  lastProcessedSignature: string
}

// TODO: Remove this once the type is added to the library
type ConfirmedSignatureInfo = {
  signature: string
  slot: number
  err: any | null
  memo: string | null
  blockTime?: number | null
  confirmationStatus?: any
}

export class SolanaPaymentTracker {
  private connection: Connection
  private walletPublicKey: PublicKey
  private pollIntervalMs: number
  private retryCount: number
  private maxRetries: number
  private backoffFactor: number
  private db: MongoClient
  private transactions
  private serviceState

  constructor(
    rpcEndpoint: string,
    walletAddress: string,
    mongoClient: MongoClient,
    pollIntervalMs = 5000,
  ) {
    this.connection = new Connection(rpcEndpoint, 'confirmed')
    this.walletPublicKey = new PublicKey(walletAddress)
    this.pollIntervalMs = pollIntervalMs
    this.retryCount = 0
    this.maxRetries = 5
    this.backoffFactor = 2
    this.db = mongoClient

    const database = this.db.database()
    this.transactions = database.collection<Transaction>('transactions')
    this.serviceState = database.collection<ServiceState>('serviceState')

    this.log(`Using wallet address: ${this.walletPublicKey.toBase58()}`)

    const address = this.walletPublicKey.toBase58()
    if (address.length !== 44) {
      this.error(`Invalid wallet address length: ${address.length}`)
      throw new Error('Invalid wallet address')
    }
  }

  private log(...messages: unknown[]) {
    console.log(`[${new Date().toISOString()}]`, ...messages)
  }

  private error(...messages: unknown[]) {
    console.error(`[${new Date().toISOString()}]`, ...messages)
  }

  private sleep(ms: number) {
    return new Promise<void>((resolve) => setTimeout(resolve, ms))
  }

  private handleRetry() {
    if (this.retryCount < this.maxRetries) {
      this.retryCount++
      const delay = this.pollIntervalMs *
        Math.pow(this.backoffFactor, this.retryCount)
      this.log(`Retrying in ${delay}ms...`)
      this.pollIntervalMs = delay
    } else {
      this.error('Max retries reached. Service will continue attempts...')
      this.retryCount = 0
      this.pollIntervalMs = 5000
    }
  }

  private async getOrCreateState(): Promise<ServiceState> {
    let state = await this.serviceState.findOne({})
    if (!state) {
      state = {
        _id: new ObjectId(),
        lastProcessedSignature: '',
      }
      await this.serviceState.insertOne(state)
    }
    return state
  }

  private async getSignatures(
    lastSignature?: string,
  ): Promise<ConfirmedSignatureInfo[]> {
    return await this.connection.getSignaturesForAddress(this.walletPublicKey, {
      ...(lastSignature && { until: lastSignature }),
      limit: 1000,
    })
  }

  public async start(): Promise<void> {
    this.log('Starting Solana Payment Tracker...')
    // const state = await this.getOrCreateState()

    await this.sync().then(() => {
      this.log('Historical transactions synced')
    })

    while (true) {
      try {
        const state = await this.getOrCreateState()
        await this.poll(state)
        this.retryCount = 0
      } catch (error) {
        this.error('Error in polling:', error)
        this.handleRetry()
      }
      await this.sleep(this.pollIntervalMs)
    }
  }

  private async sync() {
    const allSignatures = []
    let lastSignature: string | undefined = undefined

    // how do we know when to stop?
    while (true) {
      const signatures = await this.getSignatures(lastSignature)
      if (!signatures.length) break
      this.log(`found ${signatures.length} new txns to sync`)

      allSignatures.push(...signatures)
      lastSignature = signatures[0].signature
      this.log(`syncing txns up to signature: ${lastSignature}`)
    }
    this.log(`found ${allSignatures.length} total txns to sync`)

    // Sorts signatures by blockTime in descending order (newest first)
    allSignatures.sort((a, b) => (b.blockTime ?? 0) - (a.blockTime ?? 0))
    const sigs = allSignatures.map((sig) => sig.signature)

    // for (const sig of sigs) {
    //   await this.process(sig)
    // }

    const numNewTxns = await this.processBatch(sigs)
    if (numNewTxns < 1) {
      this.log('No new txns found')
      return
    }

    if (allSignatures.length > 0) {
      const state = await this.getOrCreateState()
      state.lastProcessedSignature = allSignatures[0].signature // last processed signature is the newest
      await this.serviceState.updateOne(
        { _id: state._id },
        { $set: { lastProcessedSignature: state.lastProcessedSignature } },
      )
    }
  }

  public async poll(state: ServiceState): Promise<void> {
    this.log(`polling txns... newer than ${state.lastProcessedSignature}`)
    const confirmedSignatures = await this.getSignatures(
      state.lastProcessedSignature,
    )
    if (!confirmedSignatures.length) {
      this.log('No new txns found')
      return
    }
    this.log(`Found ${confirmedSignatures.length} new txns`)

    // Sorts signatures by blockTime in descending order (newest first)
    confirmedSignatures.sort((a, b) => (b.blockTime ?? 0) - (a.blockTime ?? 0))
    const sigs = confirmedSignatures.map((sigInfo) => sigInfo.signature)

    // const existingSigDocs = await this.transactions
    //   .find({ transactionId: { $in: sigs } })
    //   .toArray()
    // const existingSigs = new Set<string>(
    //   existingSigDocs.map((doc) => doc.transactionId),
    // )

    // for (const sig of sigs) {
    //   if (existingSigs.has(sig)) continue
    //   await this.process(sig)
    // }

    const numNewTxns = await this.processBatch(sigs)
    if (numNewTxns < 1) {
      this.log('No new txns found')
      return
    }

    const lastProcessedSignature = sigs[0]
    await this.serviceState.updateOne(
      { _id: state._id },
      { $set: { lastProcessedSignature } },
    )
    this.log(`Last signature updated: ${lastProcessedSignature}`)
  }

  private async process(signature: string) {
    const existingTx = await this.transactions.findOne({
      transactionId: signature,
    })
    if (existingTx) return

    const transaction = await this.connection.getParsedTransaction(
      signature,
      {
        maxSupportedTransactionVersion: 0,
      },
    )
    if (!transaction || !transaction.meta) return

    for (const ix of transaction.transaction.message.instructions) {
      if (
        'parsed' in ix &&
        ix.program === 'system' &&
        ix.parsed.type === 'transfer' &&
        ix.parsed.info.destination === this.walletPublicKey.toBase58()
      ) {
        const senderAddress = transaction.transaction.message.accountKeys[0]
          .pubkey.toBase58()
        const lamports = Number(ix.parsed.info.lamports)
        const sol = lamports / 1_000_000_000

        await this.transactions.insertOne({
          _id: new ObjectId(),
          transactionId: signature,
          sender: senderAddress,
          amount: sol,
          status: transaction.meta.err ? 'Failure' : 'Success',
          meta: transaction.meta,
        })

        this.log(
          `Processed historical transaction ${signature} for ${sol} SOL from ${senderAddress}`,
        )
      }
    }
  }

  public async processBatch(signatures: string[]): Promise<number> {
    // Skip signatures we already have
    const existingTxDocs = await this.transactions.find({
      transactionId: { $in: signatures },
    }).toArray()
    const existingSet = new Set(existingTxDocs.map((doc) => doc.transactionId))
    const newSignatures = signatures.filter((sig) => !existingSet.has(sig))

    // Fetch all parsed transactions at once
    const parsedTxs = await this.connection.getParsedTransactions(
      newSignatures,
      {
        maxSupportedTransactionVersion: 0,
      },
    )

    // Build an array of documents to insert in a single batch
    const docsToInsert = []
    for (let i = 0; i < parsedTxs.length; i++) {
      const transaction = parsedTxs[i]
      if (!transaction || !transaction.meta) continue

      const signature = newSignatures[i]
      for (const ix of transaction.transaction.message.instructions) {
        if (
          'parsed' in ix &&
          ix.program === 'system' &&
          ix.parsed.type === 'transfer' &&
          ix.parsed.info.destination === this.walletPublicKey.toBase58()
        ) {
          const senderAddress = transaction.transaction.message.accountKeys[0]
            .pubkey.toBase58()
          const lamports = Number(ix.parsed.info.lamports)
          const sol = lamports / 1_000_000_000

          docsToInsert.push({
            _id: new ObjectId(),
            transactionId: signature,
            sender: senderAddress,
            amount: sol,
            status: transaction.meta.err ? 'Failure' : 'Success',
            meta: transaction.meta,
          })
        }
      }
    }

    if (docsToInsert.length < 1) {
      return 0
    }

    await this.transactions.insertMany(docsToInsert)
    return docsToInsert.length
  }
}
