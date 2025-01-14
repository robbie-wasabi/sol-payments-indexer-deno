import { SolanaPaymentTracker } from './src/indexer.ts'
import { ALCHEMY_URI, MONGODB_URI, SOL_PAY_RECEIVER_PUB_KEY } from './config.ts'
import { MongoClient } from 'https://deno.land/x/mongo@v0.32.0/mod.ts'

try {
  const mongoClient = new MongoClient()
  await mongoClient.connect(MONGODB_URI)

  const tracker = new SolanaPaymentTracker(
    ALCHEMY_URI,
    SOL_PAY_RECEIVER_PUB_KEY,
    mongoClient,
    3_000,
  )

  await tracker.start()
} catch (error) {
  console.error(error)
}
