# J.A.R.V.I.S. — Personal AI Assistant

A fully local, self-hosted AI assistant inspired by Iron Man's JARVIS — running entirely on consumer hardware, with voice interaction, screen vision, and web search, all without sending data to the cloud.

![Status](https://img.shields.io/badge/status-functional-brightgreen)
![Privacy](https://img.shields.io/badge/data-100%25%20local-blue)

## Demo

The floating orb overlay (`jarvis-hud`, orb mode) — the arc-reactor HUD used as the always-on-top desktop widget:

https://github.com/Angga-29/jarvis-ai-assistant/raw/main/docs/orb-demo.mp4

## What It Does

- **Voice conversation** — speak naturally, JARVIS listens, thinks, and talks back
- **Screen vision** — say "lihat layar" (look at screen) and JARVIS analyzes what's on your monitor
- **Live web search** — answers current-events questions using real-time search, entirely offline-capable otherwise
- **Floating desktop overlay** — a small circular orb, always on top, click to talk, drag to reposition
- **100% local inference** — no OpenAI, no cloud API, no subscription. Runs on a Ryzen 7 mini PC with 16GB RAM

## Architecture
The assistant runs as a dedicated headless server (auto-starts on boot via systemd), while a lightweight Electron client on the daily-driver machine provides the floating UI, microphone/speaker access, and screen capture — communicating over a private LAN connection.

## Tech Stack

| Layer | Technology |
|---|---|
| LLM inference | Ollama + qwen2.5:7b |
| Vision | llava:13b |
| Speech-to-text | faster-whisper |
| Text-to-speech | Piper / Meta MMS-TTS (Indonesian) |
| Backend | OpenJarvis (Python/FastAPI) |
| Frontend | React + Vite |
| Desktop overlay | Electron |
| OS | Ubuntu 26.04 LTS (native, no WSL2) |

## Interesting Engineering Problems Solved

This project involved real debugging, not just following a tutorial:

- **Migrated from WSL2 to native Ubuntu** after discovering WSL2's virtualization layer blocked GPU/audio/USB device access entirely — a ~3x inference speed improvement resulted from removing that layer.
- **Patched a real CORS bug** in the OpenJarvis backend where preflight `OPTIONS` requests were being rejected by the auth middleware (the middleware checked every method identically, with no exemption for CORS preflight) — traced it to source, fixed with a 3-line patch.
- **Discovered a hidden capability**: web search was already fully wired up in the backend's agent system, but the system prompt was explicitly telling the model it *couldn't* search — a one-line fix unlocked a feature that looked like it needed building from scratch.
- **Extended the backend to support vision requests**, which weren't implemented end-to-end: patched the Pydantic schema, the OpenAI-format message converter, and the agent-routing logic (vision messages need to bypass the tool-calling agent, which only accepts plain-string input) across three files, guided by tracing the actual code path rather than guessing.
- **Diagnosed a GPU driver crash** (`vk::Queue::submit: ErrorDeviceLost`) when attempting Vulkan-accelerated inference on an integrated AMD GPU — verified via Ollama's own logs that the failure was a genuine driver-level issue, not a config mistake, and made the call to revert to a stable CPU-only configuration rather than chase an unstable path.
- **TTS language mismatch**: initially used an English Piper voice for character, but it mispronounced Indonesian text (especially numbers). Diagnosed the root cause (English phonetic model applied to Indonesian text) and switched to Meta's MMS-TTS project, which has a dedicated Indonesian-trained model.

## Repository Layout

| Path | What it is |
|---|---|
| `jarvis-hud/` | React UI (chat/voice HUD + floating orb) plus the Electron shell (`electron/main.js`, `electron/preload.js`) that gives the orb window, mic/screen access, and always-on-top drag behavior |
| `jarvis-tts/` | Standalone FastAPI microservice wrapping Meta's MMS-TTS Indonesian model |
| `openjarvis-patches/` | Three patch files contributed back to [OpenJarvis](https://github.com/open-jarvis/OpenJarvis) — the local-first agent framework this assistant's backend runs on — **not a copy of OpenJarvis itself**, just the fixes described above (CORS preflight, vision routing, etc.), kept here as a record of the debugging work |

## Quick Start

Running the full assistant means standing up three separate pieces, in this order:

1. **Backend — [OpenJarvis](https://github.com/open-jarvis/OpenJarvis)** (external project, not vendored here)
   ```bash
   git clone https://github.com/open-jarvis/OpenJarvis.git
   cd OpenJarvis
   # follow OpenJarvis's own install docs, then pull the models this project uses:
   ollama pull qwen2.5:7b
   ollama pull llava:13b
   # apply the fixes in openjarvis-patches/ (auth_middleware.py, models.py, routes.py)
   # to the matching files in your OpenJarvis checkout, then start the server
   # (defaults to http://localhost:8000 — the host jarvis-hud talks to)
   ```

2. **TTS microservice — `jarvis-tts/`**
   ```bash
   cd jarvis-tts
   pip install -r requirements.txt
   uvicorn server:app --host 0.0.0.0 --port 8001
   ```
   Downloads `facebook/mms-tts-ind` from Hugging Face on first run.

3. **Desktop overlay — `jarvis-hud/`** (see below)

## Running the Desktop Overlay

```bash
cd jarvis-hud
npm install
npm run dev        # terminal 1: Vite dev server
npm run overlay    # terminal 2: Electron floating orb window
```

`electron/main.js` opens a small frameless, transparent, always-on-top window pointed at the dev server's `?mode=orb` route; `electron/preload.js` exposes `window.orbAPI.captureScreen()` (via `desktopCapturer`) and `window.orbAPI.moveWindowBy()` (drag-to-reposition) to the renderer through `contextBridge`. The UI expects the backend on port 8000 and the TTS service on port 8001 (see `API_BASE` / `TTS_BASE` in `src/App.jsx`).

## Security Notes

- `OPENJARVIS_API_KEY` / `VITE_API_KEY` are meant for a private LAN, not a public deployment — the Vite build bundles the key into client-side JS, which is fine for a machine only your own devices can reach but would need a proper auth flow before exposing this over the internet.
- `check_bind_safety()` in `openjarvis-patches/auth_middleware.py` refuses to bind the backend to a non-loopback address without an API key set, specifically to guard against this.

## What's Not Included

Personal configuration (API keys, network settings, WiFi credentials) has been stripped from this repository. See `.env.example` for the environment variables you'll need to supply. The OpenJarvis backend itself and its Ollama/model setup are also external to this repo — see the patch files' docstrings for the exact fixes applied to it.

## License

MIT — see [LICENSE](./LICENSE).

## Author

Built as a hands-on learning project to understand local LLM deployment, voice pipelines, and desktop application development from the ground up.
