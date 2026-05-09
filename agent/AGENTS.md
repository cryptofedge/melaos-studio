# AGENTS.md — Melao's Studio

## Agent Definition

```yaml
agent:
  id: melaos-studio
  name: "Melao's Studio"
  type: sub-agent
  parent: fedge-2.0
  runtime: node
  version: 1.0.0

entrypoint: src/index.ts

channels:
  - name: whatsapp
    adapter: baileys
    config: config/whatsapp.config.ts

integrations:
  - name: suno
    type: browser-automation
    adapter: playwright
    config: config/suno.config.ts

  - name: prompt-engine
    type: llm
    provider: anthropic
    model: claude-sonnet-4-20250514

memory:
  file: agent/MEMORY.md
  runtime_store: memory/
  encryption: aes-256

soul:
  file: agent/SOUL.md

logging:
  level: info
  file: logs/melaos-studio.log
  fedge_bus: true
```

---

## Lifecycle

```
FEDGE 2.O boots
  └─> spawns melaos-studio process
        └─> WhatsApp QR scan (first time) or session restore
              └─> Suno session warmup per linked user
                    └─> Ready — listening on WhatsApp
```

---

## Commands (FEDGE 2.O → Melao's Studio)

| Command | Action |
|---------|--------|
| `AGENT:STATUS` | Returns current status, uptime, active sessions |
| `AGENT:RESTART` | Graceful restart |
| `AGENT:STOP` | Shutdown |
| `AGENT:USERS` | Returns full user registry |
| `AGENT:SONG_LOG` | Returns last 50 songs generated |
| `AGENT:ERROR_LOG` | Returns unresolved errors |
| `AGENT:LINK_SUNO <wa_id> <email> <pass>` | Link a user's Suno account |
| `AGENT:UNLINK_SUNO <wa_id>` | Unlink a user's Suno account |

---

## Flow: WhatsApp Message → Suno Song

```
1. User sends WhatsApp message to Melao's Studio number
2. Baileys receives message → parseIntent()
3. Agent checks if user has Suno account linked
   - If not → sends onboarding flow
   - If yes → proceeds
4. promptEngine.enhance() → builds optimized Suno prompt
5. sunoClient.login(user) → restores or creates session
6. sunoClient.createSong(prompt) → triggers generation
7. sunoClient.pollStatus() → waits for song URL
8. WhatsApp sends song URL + title back to user
9. memory.logSong() → updates MEMORY.md log
```

---

## Onboarding Flow (New User)

```
User: "Make me a song"
Agent: "Hey! Welcome to Melao's Studio 🎵
        To make songs I need access to your Suno account.
        Reply with: LINK <your_suno_email> <your_password>
        Your credentials are encrypted and never stored in plaintext."
User: "LINK user@email.com mypassword"
Agent: "🔐 Linking your Suno account... Done!
        Now tell me what song you want — genre, mood, topic, anything."
```
