# 🎵 Melao's Studio
### Melao'S Studios / Song-Writer & Music-Producer

> *"Every idea deserves a beat. Every feeling deserves a song."*

**Melao's Studio** is a FEDGE 2.O managed sub-agent that connects WhatsApp to Suno AI.  
Users send a message → Melao's Studio turns it into a real song → song URL delivered back on WhatsApp.

```
User (WhatsApp) → Melao's Studio → Suno AI → Song URL → User (WhatsApp)
```

---

## Architecture

```
melaos-studio/
├── agent/
│   ├── SOUL.md          ← Agent identity & personality
│   ├── MEMORY.md        ← Persistent memory schema
│   └── AGENTS.md        ← Agent config & FEDGE 2.O integration
├── src/
│   ├── index.ts         ← Entry point
│   ├── whatsapp/
│   │   ├── client.ts    ← Baileys WhatsApp connection
│   │   └── message-handler.ts ← Conversation logic
│   ├── suno/
│   │   └── client.ts    ← Playwright Suno automation
│   └── core/
│       ├── prompt-engine.ts   ← Claude AI prompt enhancement
│       ├── memory.ts          ← AES-256 encrypted memory store
│       └── agent-bus.ts       ← FEDGE 2.O IPC bus
├── sessions/            ← WhatsApp + Suno sessions (gitignored)
├── memory/              ← Runtime data (gitignored)
├── logs/                ← Agent logs (gitignored)
├── .env.example
├── package.json
└── tsconfig.json
```

---

## Quick Start

### 1. Clone & Install

```bash
git clone https://github.com/cryptofedge/melaos-studio
cd melaos-studio
npm install
npx playwright install chromium
```

### 2. Configure

```bash
cp .env.example .env
# Fill in ANTHROPIC_API_KEY and MEMORY_ENCRYPTION_KEY
```

### 3. Run

```bash
npm run dev
```

Scan the QR code that appears in terminal with your WhatsApp number.  
Melao's Studio is now live.

---

## User Flow (WhatsApp)

```
User:  "Make me a hype trap song about grinding in Miami"

Agent: "🎧 Got it. Cooking your song now..."
Agent: "🧠 Enhancing your idea for Suno..."
Agent: "✨ Style: dark trap, 808s, cinematic"
       "_Generating on Suno..._"
Agent: "🎵 Your song is ready!

        "Miami Grind"

        🔗 https://suno.com/song/abc123

        Like the vibe? Tell me what to change!"
```

### Onboarding (first-time user)

```
User:  "Make me a song"
Agent: "Hey! Welcome to Melao's Studio 🎵
        I need access to your Suno account first.
        Send: LINK your@email.com yourpassword"
User:  "LINK user@suno.com mypassword"
Agent: "🔐 Linking... Done! Now tell me what you want."
```

---

## WhatsApp Commands

| Command | Description |
|---------|-------------|
| `LINK email password` | Connect your Suno account |
| `UNLINK` | Disconnect Suno |
| `STATUS` | View your stats |
| `HELP` | Show all commands |
| _(anything else)_ | Generate a song |

---

## FEDGE 2.O Management

FEDGE 2.O can manage this agent via `memory/fedge-commands.json`:

```json
[{ "type": "AGENT:STATUS" }]
[{ "type": "AGENT:USERS" }]
[{ "type": "AGENT:SONG_LOG" }]
[{ "type": "AGENT:STOP" }]
```

Response is written to `memory/fedge-response.json`.

---

## Security

- Suno credentials are AES-256 encrypted before storage
- WhatsApp sessions stored locally in `sessions/` (gitignored)
- Suno browser sessions stored per-user in `sessions/suno/`
- No credentials ever logged in plaintext
- MEMORY_ENCRYPTION_KEY must be set in `.env`

---

## Dependencies

| Package | Purpose |
|---------|---------|
| `@whiskeysockets/baileys` | WhatsApp Web automation |
| `playwright` | Suno browser automation |
| `@anthropic-ai/sdk` | Claude AI prompt enhancement |
| `typescript` | Type safety |

---

## Managed By

**FEDGE 2.O Ecosystem**  
GitHub: [@cryptofedge](https://github.com/cryptofedge)  
Mission: Generational wealth through AI, crypto & financial education.

---

*Melao's Studio — a FEDGE 2.O sub-agent.*

---

## License & Brand

**FEDGE 2.O** | Powered by Rafael Fellito Rodriguez / Milciades Holguin and Eclat Universe  
© 2026 FEDGE 2.O. All rights reserved.

This project is part of the FEDGE 2.O ecosystem and is protected under full intellectual property rights reserved by Rafael Fellito Rodriguez and Eclat Universe.

| | |
|---|---|
| **Type** | Proprietary — All Rights Reserved |
| **Owner** | Rafael Fellito Rodriguez and Eclat Universe |
| **Brand** | FEDGE 2.O |
| **Status** | Protected and Confidential |

For licensing, partnerships, or usage permissions:  
📧 [cryptofedge@gmail.com](mailto:cryptofedge@gmail.com)  
📄 [Full License](https://github.com/cryptofedge/FEDGE-2.O/blob/main/LICENSE)
