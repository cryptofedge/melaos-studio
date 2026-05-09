import { EventEmitter } from 'events'
import { MemoryStore } from './memory'
import { logger } from '../utils/logger'
import fs from 'fs/promises'
import path from 'path'

const AGENT_ID = 'melaos-studio'
const STATUS_FILE = path.join(process.cwd(), 'memory', 'agent-status.json')

interface BusOptions {
  memory: MemoryStore
}

export class AgentBus extends EventEmitter {
  private memory: MemoryStore
  private startTime = Date.now()
  private status = 'initializing'

  constructor({ memory }: BusOptions) {
    super()
    this.memory = memory
  }

  async init() {
    await this.writeStatus('booting')
    logger.info('[AgentBus] Initialized — FEDGE 2.O bus ready')

    // Listen for FEDGE 2.O commands (via status file polling or IPC)
    setInterval(() => this.pollFedgeCommands(), 5000)

    this.on('WA_CONNECTED', () => this.writeStatus('active'))
    this.on('AGENT_ERROR', (data) => this.logError(data))
  }

  async shutdown() {
    await this.writeStatus('offline')
  }

  private async writeStatus(status: string) {
    this.status = status
    const payload = {
      agent_id: AGENT_ID,
      managed_by: 'fedge-2.0',
      status,
      uptime_seconds: Math.round((Date.now() - this.startTime) / 1000),
      timestamp: new Date().toISOString(),
    }
    await fs.mkdir(path.dirname(STATUS_FILE), { recursive: true })
    await fs.writeFile(STATUS_FILE, JSON.stringify(payload, null, 2))
  }

  private async pollFedgeCommands() {
    // FEDGE 2.O drops commands into memory/fedge-commands.json
    const cmdFile = path.join(process.cwd(), 'memory', 'fedge-commands.json')
    try {
      const raw = await fs.readFile(cmdFile, 'utf8')
      const cmds: any[] = JSON.parse(raw)
      if (!cmds.length) return

      for (const cmd of cmds) {
        await this.handleFedgeCommand(cmd)
      }

      // Clear processed commands
      await fs.writeFile(cmdFile, '[]')
    } catch {
      // No commands file yet — normal
    }
  }

  private async handleFedgeCommand(cmd: any) {
    logger.info(`[AgentBus] FEDGE 2.O command: ${cmd.type}`)

    switch (cmd.type) {
      case 'AGENT:STATUS':
        await this.writeStatus(this.status)
        break

      case 'AGENT:USERS': {
        const users = await this.memory.getAllUsers()
        const outFile = path.join(process.cwd(), 'memory', 'fedge-response.json')
        await fs.writeFile(outFile, JSON.stringify({ type: 'USERS', data: users }, null, 2))
        break
      }

      case 'AGENT:SONG_LOG': {
        const songs = await this.memory.getSongs()
        const outFile = path.join(process.cwd(), 'memory', 'fedge-response.json')
        await fs.writeFile(outFile, JSON.stringify({ type: 'SONG_LOG', data: songs.slice(-50) }, null, 2))
        break
      }

      case 'AGENT:STOP':
        logger.info('[AgentBus] FEDGE 2.O ordered shutdown')
        await this.shutdown()
        process.exit(0)

      default:
        logger.warn(`[AgentBus] Unknown FEDGE command: ${cmd.type}`)
    }
  }

  private async logError(data: any) {
    logger.error('[AgentBus] Error event:', data)
    const errFile = path.join(process.cwd(), 'memory', 'errors.json')
    let errors: any[] = []
    try {
      errors = JSON.parse(await fs.readFile(errFile, 'utf8'))
    } catch {}
    errors.push({ ...data, timestamp: new Date().toISOString(), escalated_to_fedge: true })
    await fs.writeFile(errFile, JSON.stringify(errors, null, 2))
  }
}
