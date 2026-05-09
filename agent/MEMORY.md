# MEMORY.md — Melao's Studio

> This file is the living memory of Melao's Studio. Updated by the agent at runtime.  
> Managed and readable by FEDGE 2.O at any time.

---

## Agent Bootstrap Memory

```json
{
  "agent_id": "melaos-studio",
  "version": "1.0.0",
  "managed_by": "fedge-2.0",
  "status": "active",
  "created_at": "2026-05-09",
  "channel": "whatsapp",
  "platform": "suno"
}
```

---

## User Registry

Each user who connects to Melao's Studio gets a memory slot:

```json
{
  "users": [
    {
      "wa_id": "+1XXXXXXXXXX",
      "name": "User Name",
      "suno_account_linked": true,
      "suno_email": "encrypted::...",
      "preferred_genres": ["trap", "reggaeton"],
      "last_request": "Make me a hype song about winning",
      "last_song_url": "https://suno.com/song/...",
      "song_count": 0,
      "joined_at": "2026-05-09T00:00:00Z",
      "last_active": "2026-05-09T00:00:00Z"
    }
  ]
}
```

*At runtime, this is stored in `memory/users.json` and updated after every interaction.*

---

## Conversation Context

Melao's Studio remembers the last 10 messages per user to maintain context across multi-turn WhatsApp conversations.

```json
{
  "context_window": 10,
  "storage": "memory/context/{wa_id}.json"
}
```

---

## Suno Session State

```json
{
  "suno_sessions": {
    "+1XXXXXXXXXX": {
      "logged_in": false,
      "session_cookie": "encrypted::...",
      "last_login": null,
      "active_generation": null
    }
  }
}
```

---

## Song Log

Every song generated is logged here for auditability:

```json
{
  "songs": [
    {
      "id": "uuid",
      "wa_id": "+1XXXXXXXXXX",
      "prompt_raw": "user's original message",
      "prompt_enhanced": "enhanced Suno prompt",
      "genre": "trap",
      "mood": "hype",
      "suno_url": "https://suno.com/song/...",
      "status": "delivered",
      "created_at": "2026-05-09T00:00:00Z"
    }
  ]
}
```

---

## Error Log

```json
{
  "errors": [
    {
      "timestamp": "2026-05-09T00:00:00Z",
      "wa_id": "+1XXXXXXXXXX",
      "error_type": "suno_login_failed | generation_timeout | wa_send_failed",
      "message": "...",
      "resolved": false,
      "escalated_to_fedge": true
    }
  ]
}
```

---

## FEDGE 2.O Sync

FEDGE 2.O reads/writes this file via the agent bus. Last sync timestamp:

```
LAST_FEDGE_SYNC: null
NEXT_SCHEDULED_SYNC: on_startup
```

---

## Agent Notes (Self-Written)

*Melao's Studio writes freeform observations here during operation.*

```
[2026-05-09] Agent initialized. Waiting for first WhatsApp connection.
```

---

## Songwriter Style Database

Melao's Studio has a full style database loaded at `agent/STYLES.md`.

**Covered artists:** 70+ songwriters across all major genres.

**Categories:**
- 🇺🇸 American: Rock, Folk, R&B, Soul, Hip-Hop, Pop, Country
- 🌎 Latin Legends: Bolero, Bossa Nova, Tango, Ranchera, Salsa
- 🌎 Latin Modern: Reggaeton, Latin Trap, Bachata, Merengue, Vallenato, Urban

**Usage:** When user references a songwriter or artist style, Melao's Studio
maps it to the Suno style tag from STYLES.md and builds the prompt accordingly.

**Examples loaded into prompt engine:**
- "Like Bad Bunny" → `Latin trap, reggaeton, emotional, experimental, modern`
- "Carole King vibes" → `soft rock, piano, intimate, emotional, 70s pop`
- "Daddy Yankee energy" → `reggaeton, dembow, street, Puerto Rico, anthem`
- "Juan Gabriel romantic" → `ranchera, romantic pop, Mexican, emotional, iconic`
- "Beyoncé powerful" → `pop R&B, feminist, powerhouse vocals, cinematic, modern`
