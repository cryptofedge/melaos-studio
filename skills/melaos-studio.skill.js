/**
 * SKILL: melaos-studio
 * Version: 1.0.0
 * Managed by: FEDGE 2.O
 *
 * Drop into: ~/.openclaw/sandboxes/agent-main-f331f052/skills/melaos-studio.js
 *
 * FEDGE 2.O triggers this skill when a WhatsApp message matches music intent.
 * No WhatsApp connection needed — FEDGE 2.O owns that layer.
 */

const { chromium } = require('playwright')
const Anthropic = require('@anthropic-ai/sdk').default
const crypto = require('crypto')
const fs = require('fs').promises
const path = require('path')

// ─── Config ───────────────────────────────────────────────────────────────────

const SKILL_ID = 'melaos-studio'
const SKILL_DIR = path.join(process.cwd(), 'agent', 'skills', SKILL_ID)
const USERS_FILE = path.join(SKILL_DIR, 'users.json')
const SONGS_FILE = path.join(SKILL_DIR, 'songs.json')
const SESSIONS_DIR = path.join(SKILL_DIR, 'suno-sessions')
const ENC_KEY = process.env.MEMORY_ENCRYPTION_KEY || 'FedgeM3laoStudio2026SecretKey!!'

// ─── Skill Manifest (OpenClaw reads this) ────────────────────────────────────

const SKILL_MANIFEST = {
  id: SKILL_ID,
  name: "Melao's Studio",
  version: '1.0.0',
  description: 'Turns WhatsApp messages into songs via Suno AI',
  triggers: [
    // Keywords that make FEDGE 2.O route to this skill
    'make me a song', 'create a song', 'make a beat', 'make a track',
    'hazme una cancion', 'create music', 'generate a song', 'write me a song',
    'suno', 'melao', 'LINK ', 'UNLINK', 'my songs', 'song status'
  ],
  commands: ['LINK', 'UNLINK', 'SONGS', 'SONG_STATUS'],
  author: 'FEDGE 2.O — @cryptofedge',
}

// ─── Encryption ───────────────────────────────────────────────────────────────

function encrypt(text) {
  const iv = crypto.randomBytes(16)
  const key = crypto.scryptSync(ENC_KEY, 'salt', 32)
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv)
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()])
  return `enc::${iv.toString('hex')}:${encrypted.toString('hex')}`
}

function decrypt(data) {
  const raw = data.replace('enc::', '')
  const [ivHex, encHex] = raw.split(':')
  const key = crypto.scryptSync(ENC_KEY, 'salt', 32)
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, Buffer.from(ivHex, 'hex'))
  return Buffer.concat([decipher.update(Buffer.from(encHex, 'hex')), decipher.final()]).toString('utf8')
}

// ─── Storage ──────────────────────────────────────────────────────────────────

async function init() {
  await fs.mkdir(SKILL_DIR, { recursive: true })
  await fs.mkdir(SESSIONS_DIR, { recursive: true })
}

async function getUsers() {
  try { return JSON.parse(await fs.readFile(USERS_FILE, 'utf8')) } catch { return {} }
}

async function saveUsers(users) {
  await fs.writeFile(USERS_FILE, JSON.stringify(users, null, 2))
}

async function getUser(waId) {
  const users = await getUsers()
  return users[waId] || null
}

async function logSong(data) {
  let songs = []
  try { songs = JSON.parse(await fs.readFile(SONGS_FILE, 'utf8')) } catch {}
  songs.push({ ...data, id: crypto.randomUUID(), created_at: new Date().toISOString() })
  await fs.writeFile(SONGS_FILE, JSON.stringify(songs, null, 2))
}

async function getUserSongs(waId) {
  let songs = []
  try { songs = JSON.parse(await fs.readFile(SONGS_FILE, 'utf8')) } catch {}
  return songs.filter(s => s.waId === waId)
}

// ─── Prompt Enhancement via Claude ───────────────────────────────────────────

async function enhancePrompt(userIdea) {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const res = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 500,
    system: `You are Melao's Studio, a creative music producer inside FEDGE 2.O.
Turn the user's raw idea into an optimized Suno AI prompt.
Respond ONLY with JSON, no markdown:
{"prompt":"<100-200 word Suno prompt>","style":"<3-6 word genre>","title":"<2-5 word song title>"}`,
    messages: [{ role: 'user', content: `Song idea: "${userIdea}"` }],
  })
  const raw = res.content[0].type === 'text' ? res.content[0].text : '{}'
  try {
    return JSON.parse(raw.replace(/```json|```/g, '').trim())
  } catch {
    return { prompt: userIdea, style: 'pop, modern', title: 'My Song' }
  }
}

// ─── Suno Browser Automation ─────────────────────────────────────────────────

async function sunoCreateSong(email, password, waId, prompt, style, title) {
  const sessionFile = path.join(SESSIONS_DIR, waId.replace(/[^a-zA-Z0-9]/g, '_'), 'state.json')
  await fs.mkdir(path.dirname(sessionFile), { recursive: true })
  const hasSavedSession = await fs.access(sessionFile).then(() => true).catch(() => false)

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  })

  const context = await browser.newContext({
    storageState: hasSavedSession ? sessionFile : undefined,
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36',
  })

  const page = await context.newPage()

  try {
    await page.goto('https://suno.com', { waitUntil: 'networkidle' })

    // Check if already logged in
    const loggedIn = await page.$('a[href="/create"]').then(Boolean).catch(() => false)

    if (!loggedIn) {
      await page.goto('https://suno.com/sign-in', { waitUntil: 'networkidle' })
      await page.waitForTimeout(2000)

      const emailField = await page.waitForSelector('input[type="email"], input[name="identifier"]', { timeout: 10000 })
      await emailField.fill(email)
      await page.keyboard.press('Enter')
      await page.waitForTimeout(1500)

      const pwField = await page.waitForSelector('input[type="password"]', { timeout: 8000 })
      await pwField.fill(password)
      await page.keyboard.press('Enter')
      await page.waitForNavigation({ waitUntil: 'networkidle', timeout: 15000 })
    }

    // Save session
    await context.storageState({ path: sessionFile })

    // Go to create
    await page.goto('https://suno.com/create', { waitUntil: 'networkidle' })
    await page.waitForTimeout(2000)

    // Custom mode
    try {
      const customBtn = await page.waitForSelector('button:has-text("Custom")', { timeout: 4000 })
      await customBtn.click()
      await page.waitForTimeout(1000)
    } catch {}

    // Fill prompt
    const promptField = await page.waitForSelector(
      'textarea[placeholder*="prompt"], textarea[placeholder*="lyrics"], textarea[placeholder*="Describe"]',
      { timeout: 10000 }
    )
    await promptField.fill(prompt)

    // Fill style
    try {
      const styleField = await page.waitForSelector('input[placeholder*="style"], input[placeholder*="genre"]', { timeout: 3000 })
      await styleField.fill(style)
    } catch {}

    // Fill title
    try {
      const titleField = await page.waitForSelector('input[placeholder*="title"]', { timeout: 3000 })
      await titleField.fill(title)
    } catch {}

    // Hit Create
    const createBtn = await page.waitForSelector('button:has-text("Create"), button:has-text("Generate")', { timeout: 5000 })
    await createBtn.click()

    // Poll for song URL (max 2 min)
    const start = Date.now()
    while (Date.now() - start < 120000) {
      await page.waitForTimeout(5000)
      const links = await page.$$eval('a[href*="/song/"]', els => els.map(e => e.href))
      if (links.length > 0) {
        await browser.close()
        return links[0]
      }
    }

    throw new Error('Suno generation timed out')
  } catch (err) {
    await browser.close()
    throw err
  }
}

// ─── Main Skill Handler (FEDGE 2.O calls this) ───────────────────────────────

/**
 * @param {object} ctx - FEDGE 2.O skill context
 * @param {string} ctx.waId       - WhatsApp sender ID
 * @param {string} ctx.message    - Raw user message
 * @param {function} ctx.reply    - async (text) => void — sends WA message back
 */
async function run(ctx) {
  const { waId, message, reply } = ctx
  const text = message.trim()

  await init()

  // ── LINK command ──
  if (text.toUpperCase().startsWith('LINK ')) {
    const parts = text.split(/\s+/)
    if (parts.length < 3) {
      return reply('❌ Format: *LINK your@email.com yourpassword*')
    }
    const [, email, password] = parts
    await reply('🔐 Linking your Suno account...')

    try {
      // Test login
      await sunoCreateSong(email, password, waId, 'test', 'pop', 'test')
    } catch (err) {
      // Login attempt — session saved even if song fails
    }

    const users = await getUsers()
    users[waId] = {
      ...(users[waId] || {}),
      wa_id: waId,
      suno_account_linked: true,
      suno_email: encrypt(email),
      suno_password: encrypt(password),
      song_count: users[waId]?.song_count || 0,
      joined_at: users[waId]?.joined_at || new Date().toISOString(),
      last_active: new Date().toISOString(),
    }
    await saveUsers(users)
    return reply(`✅ Suno account linked!\n\nNow tell me what song you want:\n\n_Example: "Make me a hype trap song about grinding in Miami"_`)
  }

  // ── UNLINK command ──
  if (text.toUpperCase() === 'UNLINK') {
    const users = await getUsers()
    if (users[waId]) {
      users[waId].suno_account_linked = false
      delete users[waId].suno_email
      delete users[waId].suno_password
      await saveUsers(users)
    }
    return reply('🔓 Suno account unlinked.')
  }

  // ── SONGS command ──
  if (text.toUpperCase() === 'SONGS') {
    const songs = await getUserSongs(waId)
    if (!songs.length) return reply('🎵 No songs yet — tell me what you want!')
    const list = songs.slice(-5).map((s, i) => `${i + 1}. *${s.title}*\n   ${s.sunoUrl}`).join('\n\n')
    return reply(`🎵 *Your last ${songs.slice(-5).length} songs:*\n\n${list}`)
  }

  // ── Check Suno account linked ──
  const user = await getUser(waId)
  if (!user?.suno_account_linked) {
    return reply(
      `🎵 *Welcome to Melao's Studio!*\n\nI turn your ideas into real songs on Suno AI.\n\nFirst, link your Suno account:\n*LINK your@email.com yourpassword*\n\n🔐 Credentials are AES-256 encrypted.`
    )
  }

  // ── Generate song ──
  await reply('🎧 Got it. Cooking your song now...')
  await reply('🧠 Enhancing your idea for Suno...')

  let enhanced
  try {
    enhanced = await enhancePrompt(text)
  } catch {
    enhanced = { prompt: text, style: 'pop, modern', title: 'My Song' }
  }

  await reply(`✨ *Style:* ${enhanced.style}\n_Generating on Suno — give me ~60 seconds..._`)

  try {
    const creds = {
      email: decrypt(user.suno_email),
      password: decrypt(user.suno_password),
    }

    const songUrl = await sunoCreateSong(
      creds.email, creds.password, waId,
      enhanced.prompt, enhanced.style, enhanced.title
    )

    await logSong({
      waId,
      promptRaw: text,
      promptEnhanced: enhanced.prompt,
      genre: enhanced.style,
      title: enhanced.title,
      sunoUrl: songUrl,
    })

    // Update user song count
    const users = await getUsers()
    if (users[waId]) {
      users[waId].song_count = (users[waId].song_count || 0) + 1
      users[waId].last_song_url = songUrl
      users[waId].last_active = new Date().toISOString()
      await saveUsers(users)
    }

    return reply(
      `🎵 *Your song is ready!*\n\n*"${enhanced.title}"*\n\n🔗 ${songUrl}\n\n_Like the vibe? Tell me what to change!_`
    )
  } catch (err) {
    return reply(`❌ Suno error: ${err.message}\n\nTry again or check your Suno account.`)
  }
}

// ─── Exports ─────────────────────────────────────────────────────────────────

module.exports = {
  manifest: SKILL_MANIFEST,
  run,
}
