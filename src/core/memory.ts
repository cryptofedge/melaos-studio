import fs from 'fs/promises'
import path from 'path'
import crypto from 'crypto'
import { logger } from '../utils/logger'

const MEMORY_DIR = path.join(process.cwd(), 'memory')
const USERS_FILE = path.join(MEMORY_DIR, 'users.json')
const SONGS_FILE = path.join(MEMORY_DIR, 'songs.json')

const ENCRYPTION_KEY = process.env.MEMORY_ENCRYPTION_KEY || 'fedge2o-melaos-default-key-32b!!'

function encrypt(text: string): string {
  const iv = crypto.randomBytes(16)
  const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32)
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv)
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()])
  return `encrypted::${iv.toString('hex')}:${encrypted.toString('hex')}`
}

function decrypt(data: string): string {
  const raw = data.replace('encrypted::', '')
  const [ivHex, encHex] = raw.split(':')
  const iv = Buffer.from(ivHex, 'hex')
  const encrypted = Buffer.from(encHex, 'hex')
  const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32)
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv)
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8')
}

export class MemoryStore {
  private users: Record<string, any> = {}
  private songs: any[] = []
  private contextStore: Record<string, any[]> = {}

  async init() {
    await fs.mkdir(MEMORY_DIR, { recursive: true })
    await fs.mkdir(path.join(MEMORY_DIR, 'context'), { recursive: true })

    try {
      this.users = JSON.parse(await fs.readFile(USERS_FILE, 'utf8'))
    } catch {
      this.users = {}
    }

    try {
      this.songs = JSON.parse(await fs.readFile(SONGS_FILE, 'utf8'))
    } catch {
      this.songs = []
    }

    logger.info(`[Memory] Loaded ${Object.keys(this.users).length} users, ${this.songs.length} songs`)
  }

  async getUser(waId: string): Promise<any | null> {
    return this.users[waId] || null
  }

  async linkSunoAccount(waId: string, email: string, password: string) {
    this.users[waId] = {
      ...(this.users[waId] || {}),
      wa_id: waId,
      suno_account_linked: true,
      suno_email: encrypt(email),
      suno_password: encrypt(password),
      song_count: this.users[waId]?.song_count || 0,
      joined_at: this.users[waId]?.joined_at || new Date().toISOString(),
      last_active: new Date().toISOString(),
    }
    await this.saveUsers()
    logger.info(`[Memory] Suno account linked for ${waId}`)
  }

  async unlinkSunoAccount(waId: string) {
    if (this.users[waId]) {
      this.users[waId].suno_account_linked = false
      delete this.users[waId].suno_email
      delete this.users[waId].suno_password
      await this.saveUsers()
    }
  }

  async getSunoCreds(waId: string): Promise<{ email: string; password: string }> {
    const user = this.users[waId]
    if (!user?.suno_email) throw new Error('No Suno account linked')
    return {
      email: decrypt(user.suno_email),
      password: decrypt(user.suno_password),
    }
  }

  async updateContext(waId: string, message: { role: string; content: string }) {
    if (!this.contextStore[waId]) this.contextStore[waId] = []
    this.contextStore[waId].push({ ...message, ts: Date.now() })
    if (this.contextStore[waId].length > 10) {
      this.contextStore[waId] = this.contextStore[waId].slice(-10)
    }
  }

  async getContext(waId: string): Promise<any[]> {
    return this.contextStore[waId] || []
  }

  async logSong(data: {
    waId: string
    promptRaw: string
    promptEnhanced: string
    genre: string
    sunoUrl: string
    title: string
  }) {
    const entry = {
      id: crypto.randomUUID(),
      ...data,
      status: 'delivered',
      created_at: new Date().toISOString(),
    }
    this.songs.push(entry)
    if (this.users[data.waId]) {
      this.users[data.waId].song_count = (this.users[data.waId].song_count || 0) + 1
      this.users[data.waId].last_song_url = data.sunoUrl
      this.users[data.waId].last_active = new Date().toISOString()
      await this.saveUsers()
    }
    await this.saveSongs()
    logger.info(`[Memory] Song logged: "${data.title}" for ${data.waId}`)
  }

  async getSongs(waId?: string): Promise<any[]> {
    if (waId) return this.songs.filter((s) => s.waId === waId)
    return this.songs
  }

  async getAllUsers(): Promise<any[]> {
    return Object.values(this.users)
  }

  private async saveUsers() {
    await fs.writeFile(USERS_FILE, JSON.stringify(this.users, null, 2))
  }

  private async saveSongs() {
    await fs.writeFile(SONGS_FILE, JSON.stringify(this.songs, null, 2))
  }
}
