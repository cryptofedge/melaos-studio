import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
} from '@whiskeysockets/baileys'
import { Boom } from '@hapi/boom'
import { MessageHandler } from './message-handler'
import { MemoryStore } from '../core/memory'
import { AgentBus } from '../core/agent-bus'
import { logger } from '../utils/logger'
import path from 'path'

interface WAOptions {
  memory: MemoryStore
  bus: AgentBus
}

export async function startWhatsApp({ memory, bus }: WAOptions) {
  const { state, saveCreds } = await useMultiFileAuthState(
    path.join(process.cwd(), 'sessions/whatsapp')
  )

  const { version } = await fetchLatestBaileysVersion()
  logger.info(`Baileys version: ${version.join('.')}`)

  const sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: true,
    logger: logger as any,
  })

  const handler = new MessageHandler({ sock, memory, bus })

  sock.ev.on('creds.update', saveCreds)

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update

    if (qr) {
      logger.info('📱 Scan QR code above to connect WhatsApp')
    }

    if (connection === 'close') {
      const shouldReconnect =
        (lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut
      logger.warn('Connection closed. Reconnecting:', shouldReconnect)
      if (shouldReconnect) startWhatsApp({ memory, bus })
    }

    if (connection === 'open') {
      logger.info('✅ WhatsApp connected — Melao\'s Studio is live')
      bus.emit('WA_CONNECTED')
    }
  })

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return
    for (const msg of messages) {
      if (msg.key.fromMe) continue
      await handler.handle(msg)
    }
  })

  return sock
}
