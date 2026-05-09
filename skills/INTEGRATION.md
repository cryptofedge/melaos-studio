# Melao's Studio — FEDGE 2.O Skill Integration

## Install

```bash
# 1. Copy skill file into FEDGE 2.O skills folder
cp skills/melaos-studio.skill.js ../FEDGE-2.O/agent/skills/melaos-studio.skill.js

# 2. Install Playwright into FEDGE 2.O (if not already installed)
cd ../FEDGE-2.O
npm install playwright
npx playwright install chromium
```

---

## Wire into FEDGE 2.O WhatsApp Handler

Find the file in FEDGE-2.O that handles incoming WhatsApp messages.
Add this block where messages are processed:

```js
const melaosStudio = require('./agent/skills/melaos-studio.skill')

// Inside your message handler:
async function handleMessage(waId, message, sock) {
  const reply = async (text) => sock.sendMessage(waId, { text })

  // Check if Melao's Studio should handle this message
  const lower = message.toLowerCase()
  const triggers = melaosStudio.manifest.triggers
  const isMusic = triggers.some(t => lower.includes(t.toLowerCase()))

  if (isMusic || lower.startsWith('link ') || lower === 'unlink' || lower === 'songs') {
    return melaosStudio.run({ waId, message, reply })
  }

  // ... rest of your FEDGE 2.O message handling
}
```

---

## Environment Variables

Add to FEDGE-2.O `.env`:

```env
MEMORY_ENCRYPTION_KEY=FedgeM3laoStudio2026SecretKey!!
```

---

## User Flow (via FEDGE 2.O WhatsApp)

```
User:  "make me a trap song about Miami hustle"
FEDGE: routes to melaos-studio.skill.js
Agent: "🎧 Got it. Cooking your song now..."
Agent: "🧠 Enhancing your idea for Suno..."
Agent: "✨ Style: dark trap, 808s, cinematic"
Agent: "🎵 Your song is ready!
        "Miami Hustle"
        🔗 https://suno.com/song/abc123"
```

---

## Skill Data Location

All Melao's Studio data lives inside FEDGE-2.O:
```
FEDGE-2.O/
  agent/
    skills/
      melaos-studio/
        users.json        ← encrypted user registry
        songs.json        ← song log
        suno-sessions/    ← per-user Suno browser sessions
```

---

## Commands Users Can Send

| Message | Action |
|---------|--------|
| `LINK email pass` | Link Suno account |
| `UNLINK` | Unlink Suno account |
| `SONGS` | Show last 5 songs |
| _(any music idea)_ | Generate a song |
