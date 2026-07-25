# J.A.R.V.I.S. — Personal AI Assistant

A fully local, self-hosted AI assistant inspired by Iron Man's JARVIS — running entirely on consumer hardware, with voice interaction, screen vision, and web search, all without sending data to the cloud.

![Status](https://img.shields.io/badge/status-functional-brightgreen)
![Privacy](https://img.shields.io/badge/data-100%25%20local-blue)

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

## What's Not Included

Personal configuration (API keys, network settings, WiFi credentials) has been stripped from this repository. See `.env.example` for the environment variables you'll need to supply.

## Author

Built as a hands-on learning project to understand local LLM deployment, voice pipelines, and desktop application development from the ground up.
