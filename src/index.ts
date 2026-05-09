import { startWhatsApp } from './whatsapp/client'
import { AgentBus } from './core/agent-bus'
import { MemoryStore } from './core/memory'
import { logger } from './utils/logger'

async function boot() {
  logger.info('🎵 Melao\'s Studio — booting...')
  logger.info('👁  Managed by FEDGE 2.O')

  const memory = new MemoryStore()
  await memory.init()

  const bus = new AgentBus({ memory })
  await bus.init()

  await startWhatsApp({ memory, bus })

  logger.info('✅ Melao\'s Studio is live — waiting for WhatsApp messages')

  process.on('SIGINT', async () => {
    logger.info('🛑 Melao\'s Studio shutting down...')
    await bus.shutdown()
    process.exit(0)
  })
}

boot().catch((err) => {
  logger.error('Fatal boot error:', err)
  process.exit(1)
})
