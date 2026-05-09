import Anthropic from '@anthropic-ai/sdk'
import { logger } from '../utils/logger'

interface EnhancedPrompt {
  prompt: string
  style: string
  title: string
  mood: string
}

interface ContextMessage {
  role: 'user' | 'assistant'
  content: string
}

export class PromptEngine {
  private client: Anthropic

  constructor() {
    this.client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  }

  async enhance(userIdea: string, context: ContextMessage[] = []): Promise<EnhancedPrompt> {
    logger.info(`[PromptEngine] Enhancing: "${userIdea.slice(0, 60)}"`)

    const systemPrompt = `You are Melao's Studio, a creative music producer AI inside the FEDGE 2.O ecosystem.
Your job is to take a user's raw song idea and turn it into an optimized prompt for Suno AI.

Suno works best with prompts that include:
- Genre and sub-genre (e.g. "dark trap, 808s heavy")
- Vocal style (e.g. "male rap vocals", "female R&B, melodic")
- Mood and energy (e.g. "melancholic, introspective", "hype, aggressive")
- Instrumentation hints (e.g. "piano, strings, hi-hats")
- Lyrical theme (2-3 sentences max)

Respond ONLY with a JSON object, no markdown, no explanation:
{
  "prompt": "<optimized Suno generation prompt, 100-200 words>",
  "style": "<3-6 word genre/style descriptor for Suno style field>",
  "title": "<catchy song title, 2-6 words>",
  "mood": "<single word mood>"
}`

    const messages: any[] = [
      ...context.slice(-6).map((m) => ({ role: m.role, content: m.content })),
      { role: 'user', content: `Turn this into an optimized Suno song prompt: "${userIdea}"` },
    ]

    const response = await this.client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      system: systemPrompt,
      messages,
    })

    const raw = response.content[0].type === 'text' ? response.content[0].text : '{}'

    try {
      const parsed = JSON.parse(raw.replace(/```json|```/g, '').trim())
      logger.info(`[PromptEngine] Enhanced → style: "${parsed.style}", title: "${parsed.title}"`)
      return parsed as EnhancedPrompt
    } catch {
      logger.warn('[PromptEngine] JSON parse failed, using fallback')
      return {
        prompt: userIdea,
        style: 'pop, modern',
        title: 'My Song',
        mood: 'expressive',
      }
    }
  }
}
