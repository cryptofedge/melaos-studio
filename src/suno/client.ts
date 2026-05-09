import { chromium, Browser, Page, BrowserContext } from 'playwright'
import { logger } from '../utils/logger'
import path from 'path'
import fs from 'fs'

interface SunoClientOptions {
  email: string
  password: string
  waId: string
}

interface SongRequest {
  prompt: string
  style: string
  title: string
}

interface SongResult {
  url: string
  title: string
  id: string
}

export class SunoClient {
  private email: string
  private password: string
  private waId: string
  private browser: Browser | null = null
  private context: BrowserContext | null = null
  private page: Page | null = null
  private sessionPath: string
  private loggedIn = false

  constructor({ email, password, waId }: SunoClientOptions) {
    this.email = email
    this.password = password
    this.waId = waId
    this.sessionPath = path.join(
      process.cwd(),
      'sessions/suno',
      waId.replace(/[^a-zA-Z0-9]/g, '_')
    )
    fs.mkdirSync(this.sessionPath, { recursive: true })
  }

  async login(): Promise<void> {
    logger.info(`[Suno] Logging in for ${this.waId}`)

    this.browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    })

    // Restore session if it exists
    const hasSavedSession = fs.existsSync(path.join(this.sessionPath, 'state.json'))

    this.context = await this.browser.newContext({
      storageState: hasSavedSession ? path.join(this.sessionPath, 'state.json') : undefined,
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    })

    this.page = await this.context.newPage()

    await this.page.goto('https://suno.com', { waitUntil: 'networkidle' })

    // Check if already logged in (session restored)
    const isLoggedIn = await this.checkLoggedIn()
    if (isLoggedIn) {
      logger.info(`[Suno] Session restored for ${this.waId}`)
      this.loggedIn = true
      return
    }

    // Perform login via Clerk (Suno uses Clerk auth)
    await this.performLogin()
  }

  private async checkLoggedIn(): Promise<boolean> {
    try {
      await this.page!.waitForSelector('[data-testid="create-button"], .create-btn, a[href="/create"]', {
        timeout: 5000,
      })
      return true
    } catch {
      return false
    }
  }

  private async performLogin(): Promise<void> {
    if (!this.page) throw new Error('Page not initialized')

    logger.info(`[Suno] Performing fresh login for ${this.waId}`)

    // Navigate to sign-in
    await this.page.goto('https://suno.com/sign-in', { waitUntil: 'networkidle' })
    await this.page.waitForTimeout(2000)

    // Click "Continue with email" or fill email field
    try {
      const emailField = await this.page.waitForSelector('input[type="email"], input[name="identifier"]', { timeout: 10000 })
      await emailField.fill(this.email)
      await this.page.keyboard.press('Enter')
      await this.page.waitForTimeout(1500)
    } catch {
      throw new Error('Could not find email field on Suno login page')
    }

    // Fill password
    try {
      const pwField = await this.page.waitForSelector('input[type="password"]', { timeout: 8000 })
      await pwField.fill(this.password)
      await this.page.keyboard.press('Enter')
    } catch {
      throw new Error('Could not find password field on Suno login page')
    }

    // Wait for redirect after login
    await this.page.waitForNavigation({ waitUntil: 'networkidle', timeout: 15000 })

    const success = await this.checkLoggedIn()
    if (!success) {
      throw new Error('Login failed — check Suno credentials')
    }

    // Save session for next time
    await this.context!.storageState({ path: path.join(this.sessionPath, 'state.json') })
    this.loggedIn = true
    logger.info(`[Suno] Login successful for ${this.waId}`)
  }

  async createSong({ prompt, style, title }: SongRequest): Promise<SongResult> {
    if (!this.loggedIn || !this.page) {
      throw new Error('Not logged in to Suno')
    }

    logger.info(`[Suno] Creating song for ${this.waId}: "${title}"`)

    // Navigate to create page
    await this.page.goto('https://suno.com/create', { waitUntil: 'networkidle' })
    await this.page.waitForTimeout(2000)

    // Switch to Custom Mode for full control
    try {
      const customBtn = await this.page.waitForSelector('button:has-text("Custom"), [data-tab="custom"]', { timeout: 5000 })
      await customBtn.click()
      await this.page.waitForTimeout(1000)
    } catch {
      logger.warn('[Suno] Could not find custom mode button, proceeding with simple mode')
    }

    // Fill the main prompt / lyrics field
    const promptField = await this.page.waitForSelector(
      'textarea[placeholder*="prompt"], textarea[placeholder*="lyrics"], textarea[placeholder*="Describe"], #prompt',
      { timeout: 10000 }
    )
    await promptField.click()
    await promptField.fill(prompt)
    await this.page.waitForTimeout(500)

    // Fill style field if visible
    try {
      const styleField = await this.page.waitForSelector(
        'input[placeholder*="style"], input[placeholder*="genre"], textarea[placeholder*="style"]',
        { timeout: 3000 }
      )
      await styleField.fill(style)
    } catch {
      // Style field not visible — prompt includes style info
    }

    // Fill title if field visible
    try {
      const titleField = await this.page.waitForSelector(
        'input[placeholder*="title"], input[name="title"]',
        { timeout: 3000 }
      )
      await titleField.fill(title)
    } catch {
      // Title optional
    }

    // Hit Create
    const createBtn = await this.page.waitForSelector(
      'button:has-text("Create"), button[type="submit"]:has-text("Generate"), button:has-text("Make")',
      { timeout: 5000 }
    )
    await createBtn.click()

    logger.info(`[Suno] Generation triggered — polling for result...`)

    // Poll for song URL (Suno generates ~30-90 seconds)
    const songUrl = await this.pollForSong()

    // Save updated session
    await this.context!.storageState({ path: path.join(this.sessionPath, 'state.json') })

    return {
      url: songUrl,
      title,
      id: songUrl.split('/').pop() || 'unknown',
    }
  }

  private async pollForSong(maxWait = 120000): Promise<string> {
    const start = Date.now()
    const page = this.page!

    while (Date.now() - start < maxWait) {
      await page.waitForTimeout(5000)

      try {
        // Look for generated song links in the sidebar/feed
        const songLinks = await page.$$eval(
          'a[href*="/song/"]',
          (links) => links.map((l) => (l as HTMLAnchorElement).href).filter((h) => h.includes('/song/'))
        )

        if (songLinks.length > 0) {
          const songUrl = songLinks[0]
          logger.info(`[Suno] Song ready: ${songUrl}`)
          return songUrl
        }
      } catch {
        // Keep polling
      }

      logger.info(`[Suno] Still generating... (${Math.round((Date.now() - start) / 1000)}s)`)
    }

    throw new Error('Suno generation timed out after 2 minutes')
  }

  async close() {
    await this.browser?.close()
    this.loggedIn = false
  }
}
