import { WASocket, proto } from '@whiskeysockets/baileys'
import { MemoryStore } from '../core/memory'
import { AgentBus } from '../core/agent-bus'
import { PromptEngine } from '../core/prompt-engine'
import { SunoClient } from '../suno/client'
import { logger } from '../utils/logger'

interface HandlerOptions {
  sock: WASocket
  memory: MemoryStore
  bus: AgentBus
}

export class MessageHandler {
  private sock: WASocket
  private memory: MemoryStore
  private bus: AgentBus
  private promptEngine: PromptEngine
  private sunoClients: Map<string, SunoClient> = new Map()

  constructor({ sock, memory, bus }: HandlerOptions) {
    this.sock = sock
    this.memory = memory
    this.bus = bus
    this.promptEngine = new PromptEngine()
  }

  async handle(msg: proto.IWebMessageInfo) {
    const waId = msg.key.remoteJid!
    const text = this.extractText(msg)
    if (!text) return

    logger.info(`[${waId}] → ${text.slice(0, 80)}`)

    await this.memory.updateContext(waId, { role: 'user', content: text })

    // LINK command — onboard Suno account
    if (text.toUpperCase().startsWith('LINK ')) {
      await this.handleLink(waId, text)
      return
    }

    // UNLINK command
    if (text.toUpperCase() === 'UNLINK') {
      await this.handleUnlink(waId)
      return
    }

    // STATUS command
    if (text.toUpperCase() === 'STATUS') {
      await this.handleStatus(waId)
      return
    }

    // HELP command
    if (text.toUpperCase() === 'HELP' || text === '?') {
      await this.sendHelp(waId)
      return
    }

    // Main flow — generate a song
    const user = await this.memory.getUser(waId)
    if (!user?.suno_account_linked) {
      await this.send(waId, `🎵 *Welcome to Melao's Studio!*\n\nBefore I can make songs, I need access to your Suno account.\n\nSend me:\n*LINK your@email.com yourpassword*\n\nYour credentials are AES-256 encrypted 🔐`)
      return
    }

    await this.generateSong(waId, text)
  }

  private async handleLink(waId: string, text: string) {
    const parts = text.trim().split(/\s+/)
    if (parts.length < 3) {
      await this.send(waId, '❌ Format: *LINK your@email.com yourpassword*')
      return
    }

    const [, email, password] = parts
    await this.send(waId, '🔐 Linking your Suno account...')

    try {
      const sunoClient = new SunoClient({ email, password, waId })
      await sunoClient.login()

      await this.memory.linkSunoAccount(waId, email, password)
      this.sunoClients.set(waId, sunoClient)

      await this.send(waId, `✅ Suno account linked!\n\nNow just tell me what song you want:\n• Genre\n• Mood\n• Topic or lyrics idea\n\nExample: _"Make me a hype trap song about grinding in Miami"_`)
    } catch (err: any) {
      logger.error(`Suno login failed for ${waId}:`, err.message)
      await this.send(waId, `❌ Couldn't log into Suno. Check your credentials and try again.\n\nError: ${err.message}`)
    }
  }

  private async handleUnlink(waId: string) {
    await this.memory.unlinkSunoAccount(waId)
    this.sunoClients.delete(waId)
    await this.send(waId, '🔓 Suno account unlinked. Send *LINK* to reconnect.')
  }

  private async handleStatus(waId: string) {
    const user = await this.memory.getUser(waId)
    const linked = user?.suno_account_linked ? '✅ Linked' : '❌ Not linked'
    const songs = user?.song_count ?? 0
    await this.send(waId, `*Melao's Studio — Your Status*\n\n🎵 Songs made: ${songs}\n🔗 Suno account: ${linked}\n⚡ Agent: Online\n👁 Managed by FEDGE 2.O`)
  }

  private async sendHelp(waId: string) {
    await this.send(waId, `🎵 *Melao's Studio — Commands*\n\n*LINK email password* — Connect your Suno account\n*UNLINK* — Disconnect Suno\n*STATUS* — See your stats\n*HELP* — This menu\n\n_Or just tell me what song you want!_\n\nExample: _"Sad lo-fi beat about missing home, Spanish vibes"_`)
  }

  private async generateSong(waId: string, userIdea: string) {
    await this.send(waId, `🎧 Got it. Cooking your song now...`)

    try {
      // Enhance the prompt with AI
      await this.send(waId, `🧠 Enhancing your idea for Suno...`)
      const context = await this.memory.getContext(waId)
      const enhanced = await this.promptEngine.enhance(userIdea, context)

      logger.info(`[${waId}] Enhanced prompt: ${enhanced.prompt}`)
      await this.send(waId, `✨ *Style:* ${enhanced.style}\n_Generating on Suno..._`)

      // Get or create Suno client for this user
      let sunoClient = this.sunoClients.get(waId)
      if (!sunoClient) {
        const user = await this.memory.getUser(waId)
        const creds = await this.memory.getSunoCreds(waId)
        sunoClient = new SunoClient({ email: creds.email, password: creds.password, waId })
        await sunoClient.login()
        this.sunoClients.set(waId, sunoClient)
      }

      const song = await sunoClient.createSong({
        prompt: enhanced.prompt,
        style: enhanced.style,
        title: enhanced.title,
      })

      await this.memory.logSong({
        waId,
        promptRaw: userIdea,
        promptEnhanced: enhanced.prompt,
        genre: enhanced.style,
        sunoUrl: song.url,
        title: song.title,
      })

      await this.send(
        waId,
        `🎵 *Your song is ready!*\n\n*"${song.title}"*\n\n🔗 ${song.url}\n\n_Like the vibe? Tell me what to change or ask for another one!_`
      )
    } catch (err: any) {
      logger.error(`Song generation failed for ${waId}:`, err.message)
      await this.send(waId, `❌ Something went wrong: ${err.message}\n\nTry again or type *HELP*`)
      this.bus.emit('AGENT_ERROR', { waId, error: err.message })
    }
  }

  private extractText(msg: proto.IWebMessageInfo): string | null {
    return (
      msg.message?.conversation ||
      msg.message?.extendedTextMessage?.text ||
      null
    )
  }

  private async send(waId: string, text: string) {
    await this.sock.sendMessage(waId, { text })
  }
}
