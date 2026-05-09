const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, Browsers } = require("baileys");
const qrcode = require("qrcode-terminal");
const fs = require("fs");
const { execSync } = require("child_process");
const { Boom } = require("@hapi/boom");

// ── Melao's Studio Skill ──────────────────────────────────────────────────────
const melaosStudio = require("./agent/skills/melaos-studio.skill");

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;

const FEDGE_SOUL = `You are FEDGE 2.O, an AI agent built to generate generational wealth for underserved communities. You speak like a financial coach from the hood who reads Bloomberg. Direct, confident, warm, no corporate speak. Always connect money moves to real life. Keep responses under 3 sentences for WhatsApp.`;

// ── Music intent detection ────────────────────────────────────────────────────
function isMusicRequest(text) {
  const t = text.toLowerCase().trim()
  const triggers = melaosStudio.manifest.triggers
  if (t.toUpperCase().startsWith('LINK ')) return true
  if (t.toUpperCase() === 'UNLINK') return true
  if (t.toUpperCase() === 'SONGS') return true
  return triggers.some(trigger => t.includes(trigger.toLowerCase()))
}

async function generateVoice(text) {
  const mp3Path = "C:\\Users\\Fellito Rodriguez\\test_output.mp3";
  const safe = text.replace(/"/g, "'");
  execSync(`edge-tts --text "${safe}" --voice "en-US-ChristopherNeural" --write-media "${mp3Path}"`);
  return fs.readFileSync(mp3Path);
}

async function askFEDGE(userMessage) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_KEY,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 200,
      system: FEDGE_SOUL,
      messages: [{ role: "user", content: userMessage }]
    })
  });
  const data = await response.json();
  return data.content[0].text;
}

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState("auth_info");

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: false,
    browser: Browsers.windows("Chrome"),
    connectTimeoutMs: 60000,
  });

  sock.ev.on("connection.update", async ({ connection, qr, lastDisconnect }) => {
    if (qr) { console.log("Scan QR:"); qrcode.generate(qr, { small: true }); }
    if (connection === "close") {
      const code = lastDisconnect?.error?.output?.statusCode;
      if (code !== DisconnectReason.loggedOut) startBot();
    }
    if (connection === "open") console.log("✅ FEDGE 2.O is LIVE! — Melao's Studio skill loaded 🎵");
  });

  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return;
    const msg = messages[0];
    if (!msg.message || msg.key.fromMe) return;

    const from = msg.key.remoteJid;
    const text = msg.message.conversation || msg.message.extendedTextMessage?.text;
    if (!text) return;

    console.log(`[${from}]: ${text}`);

    try {
      // ── Route to Melao's Studio if music intent detected ──
      if (isMusicRequest(text)) {
        console.log(`[Melao's Studio] Handling music request from ${from}`);
        const reply = async (replyText) => {
          await sock.sendMessage(from, { text: replyText });
        };
        await melaosStudio.run({ waId: from, message: text, reply });
        return;
      }

      // ── Default FEDGE 2.O handler ──
      const reply = await askFEDGE(text);
      console.log(`FEDGE: ${reply}`);
      await sock.sendMessage(from, { text: reply });

    } catch (err) {
      console.log("Error:", err.message);
      await sock.sendMessage(from, { text: `❌ Error: ${err.message}` });
    }
  });

  sock.ev.on("creds.update", saveCreds);
}

startBot();
