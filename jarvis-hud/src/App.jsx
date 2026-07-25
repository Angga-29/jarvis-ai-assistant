import { useState, useEffect, useMemo, useRef } from 'react'
import './App.css'

// ─── CONFIG ──────────────────────────────────────────────────────────────────
const API_BASE = `http://${window.location.hostname}:8000`
const API_CHAT = `${API_BASE}/v1/chat/completions`
const TTS_BASE = `http://${window.location.hostname}:8001`
const API_KEY  = import.meta.env.VITE_API_KEY || ''
const MODEL    = 'qwen2.5:7b'
const VISION_MODEL = 'llava:13b'
const TIMEOUT  = 60000
const VISION_TIMEOUT = 90000

// ─── JARVIS PERSONA ───────────────────────────────────────────────────────────
function buildSystemPrompt() {
  const now = new Date()
  const tgl = now.toLocaleDateString('id-ID', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
  const jam = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
  return `Kamu adalah J.A.R.V.I.S. (Just A Rather Very Intelligent System), asisten AI pribadi Angga. Berjalan lokal via Ollama — tidak ada koneksi internet, tidak ada akses ke data real-time.

Aturan wajib:
- Bahasa Indonesia secara default
- Jawab singkat dan langsung — tidak bertele-tele
- Kamu BISA mencari informasi terkini lewat web search kalau dibutuhkan (misal: berita, harga, tanggal event, siapa pejabat saat ini)
- Kalau setelah mencari tetap tidak ketemu jawabannya, katakan jujur "Saya tidak menemukan informasi tentang itu" — jangan mengarang
- Sebutkan sumber singkat kalau memang mengutip hasil pencarian (misal "menurut Wikipedia")

Waktu sekarang: ${tgl}, pukul ${jam}.`
}

// ─── LOCAL HANDLERS ───────────────────────────────────────────────────────────
const LOCAL_PATTERNS = [
  {
    pattern: /\b(siapa\s+kamu|kamu\s+siapa|nama\s+kamu|kamu\s+apa|perkenalkan\s+dirimu)\b|^halo$|^hai$|^hei$|^hello$/i,
    answer: () =>
      'J.A.R.V.I.S. — asisten AI pribadi Angga. Berjalan sepenuhnya lokal di perangkat ini via Ollama. Tidak ada data yang keluar. Siap membantu.',
  },
  {
    pattern: /\b(hari ini|hari apa|tanggal (berapa|hari ini))\b/i,
    answer: () => {
      const d = new Date().toLocaleDateString('id-ID', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
      })
      return `Hari ini ${d}.`
    },
  },
  {
    pattern: /\b(jam|pukul) (berapa|sekarang)\b|\bsekarang jam\b/i,
    answer: () => {
      const t = new Date().toLocaleTimeString('id-ID', {
        hour: '2-digit', minute: '2-digit', second: '2-digit',
      })
      return `Sekarang pukul ${t}.`
    },
  },
  {
    pattern: /^(berapa|hitung)?\s*[\d\s\+\-\*\/x×÷\.\(\)]+[\d\)]+\s*[=?]?\s*$/i,
    answer: (text) => {
      try {
        const expr = text
          .replace(/^(berapa|hitung)\s*/i, '')
          .replace(/[=?]/g, '')
          .replace(/÷/g, '/')
          .replace(/[×x]/g, '*')
          .trim()
        // eslint-disable-next-line no-new-func
        const result = Function(`"use strict"; return (${expr})`)()
        if (typeof result === 'number' && isFinite(result)) {
          const formatted = Number.isInteger(result)
            ? result.toLocaleString('id-ID')
            : result.toLocaleString('id-ID', { maximumFractionDigits: 4 })
          return `${expr} = ${formatted}`
        }
      } catch {}
      return null
    },
  },
  {
    pattern: /\b(status|kondisi) (sistem|jarvis|server)\b/i,
    answer: () =>
      `Sistem operasional. Engine: Ollama · Model: ${MODEL} · Mode: CPU-only · Koneksi: lokal`,
  },
]

function tryLocalAnswer(text) {
  for (const { pattern, answer } of LOCAL_PATTERNS) {
    if (pattern.test(text)) {
      const result = answer(text)
      if (result) return result
    }
  }
  return null
}

// ─── ARC REACTOR ─────────────────────────────────────────────────────────────
function polar(cx, cy, r, deg) {
  const rad = (deg * Math.PI) / 180
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}

function ArcReactor({ state }) {
  const ticks = useMemo(() =>
    Array.from({ length: 48 }, (_, i) => {
      const a = polar(120, 120, 100, (360 / 48) * i)
      const b = polar(120, 120, 109, (360 / 48) * i)
      return { x1: a.x, y1: a.y, x2: b.x, y2: b.y }
    }), [])

  const blocks = useMemo(() =>
    Array.from({ length: 22 }, (_, i) => (360 / 22) * i), [])

  return (
    <div className={`reactor reactor--${state}`}>
      <svg viewBox="0 0 240 240" className="reactor__svg">
        <circle className="ring ring--faint" cx="120" cy="120" r="113" />
        <g className="ring ring--ticks">
          {ticks.map((t, i) => (
            <line key={i} x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2} />
          ))}
        </g>
        <g className="ring ring--blocks">
          {blocks.map((deg) => (
            <rect key={deg} x="117" y="34" width="6" height="11"
              transform={`rotate(${deg} 120 120)`} />
          ))}
        </g>
        <circle className="ring ring--hex" cx="120" cy="120" r="66" />
        <circle className="ring ring--mid" cx="120" cy="120" r="46" />
        <circle className="core core--glow" cx="120" cy="120" r="26" />
        <circle className="core core--bright" cx="120" cy="120" r="14" />
        <circle className="core core--center" cx="120" cy="120" r="4.5" />
      </svg>
    </div>
  )
}

// ─── APP ─────────────────────────────────────────────────────────────────────
export default function App() {
  const isOrbMode = useMemo(
    () => new URLSearchParams(window.location.search).get('mode') === 'orb',
    []
  )

  const [input, setInput]       = useState('')
  const [state, setState]       = useState('idle')   // idle | listening | thinking | speaking
  const [connected, setConnected] = useState(false)
  const [subtitle, setSubtitle] = useState('')
  const [meta, setMeta]         = useState('')
  const [clock, setClock]       = useState('')
  const [recording, setRecording] = useState(false)

  const mediaRecorderRef = useRef(null)
  const chunksRef = useRef([])

  // Toggle a body class so orb mode gets a fully transparent background
  useEffect(() => {
    if (isOrbMode) document.body.classList.add('orb-mode')
    return () => document.body.classList.remove('orb-mode')
  }, [isOrbMode])

  // Live clock
  useEffect(() => {
    const tick = () => setClock(
      new Date().toLocaleTimeString('id-ID', {
        hour: '2-digit', minute: '2-digit', second: '2-digit',
      })
    )
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  // Backend health polling every 5 s
  useEffect(() => {
    let active = true
    const check = async () => {
      try {
        const r = await fetch(`${API_BASE}/health`, {
          headers: { 'Authorization': `Bearer ${API_KEY}` },
          signal: AbortSignal.timeout(3000),
        })
        if (active) setConnected(r.ok)
      } catch {
        if (active) setConnected(false)
      }
    }
    check()
    const id = setInterval(check, 5000)
    return () => { active = false; clearInterval(id) }
  }, [])

  const speak = async (text) => {
    if (!text) return
    try {
      const res = await fetch(`${TTS_BASE}/speak`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
        signal: AbortSignal.timeout(20000),
      })
      if (!res.ok) return
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const audio = new Audio(url)
      audio.play().catch(() => {})
    } catch {}
  }

  const callModel = async (text) => {
    const res = await fetch(API_CHAT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${API_KEY}` },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: buildSystemPrompt() },
          { role: 'user',   content: text },
        ],
        stream: false,
      }),
      signal: AbortSignal.timeout(TIMEOUT),
    })
    if (!res.ok) {
      const err = await res.text().catch(() => '')
      throw new Error(`HTTP ${res.status}: ${err.slice(0, 120)}`)
    }
    const data = await res.json()
    return (
      data.choices?.[0]?.message?.content ||
      data.response || data.content || data.message ||
      JSON.stringify(data)
    )
  }

  const send = async (overrideText) => {
    const text = (overrideText ?? input).trim()
    if (!text || state === 'thinking') return
    setInput('')
    setState('thinking')
    setSubtitle('')
    setMeta('')
    const t0 = Date.now()

    const local = tryLocalAnswer(text)
    if (local) {
      setState('speaking')
      setSubtitle(local)
      setMeta('lokal · instan')
      speak(local)
      setTimeout(() => setState('idle'), 1400)
      return
    }

    let reply = ''
    try {
      reply = await callModel(text)
      setConnected(true)
    } catch {
      try {
        await new Promise(r => setTimeout(r, 2500))
        reply = await callModel(text)
        setConnected(true)
      } catch (err) {
        reply = connected
          ? `[SISTEM] Tidak ada respons setelah 2 percobaan. Kemungkinan model sedang load ulang. Silakan coba lagi. (${err.message?.slice(0, 80)})`
          : 'Mode offline. Pastikan backend JARVIS berjalan.'
      }
    }

    const elapsed = ((Date.now() - t0) / 1000).toFixed(1)
    setState('speaking')
    setSubtitle(reply)
    setMeta(`${MODEL} · ${elapsed}s`)
    speak(reply)
    setTimeout(() => setState('idle'), 1800)
  }

  // Detects phrases like "lihat layar", "liat layar", "cek layar",
  // "di layar" — only meaningful when running inside the Electron overlay
  // (window.orbAPI.captureScreen only exists there, never in a plain browser tab).
  const SCREEN_VISION_PATTERN = /\b(lihat|liat|cek|check)\s+(layar|screen)\b|\bdi\s+layar\b|\bpada\s+layar\b/i

  const handleScreenVision = async (text) => {
    setState('analyzing')
    setSubtitle('')
    setMeta('')
    const t0 = Date.now()
    try {
      const imageDataUrl = await window.orbAPI.captureScreen()
      const res = await fetch(API_CHAT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${API_KEY}` },
        body: JSON.stringify({
          model: VISION_MODEL,
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text },
                { type: 'image_url', image_url: { url: imageDataUrl } },
              ],
            },
          ],
          stream: false,
        }),
        signal: AbortSignal.timeout(VISION_TIMEOUT),
      })
      if (!res.ok) {
        const err = await res.text().catch(() => '')
        throw new Error(`HTTP ${res.status}: ${err.slice(0, 120)}`)
      }
      const data = await res.json()
      const reply = data.choices?.[0]?.message?.content || 'Tidak bisa menganalisa layar.'
      const elapsed = ((Date.now() - t0) / 1000).toFixed(1)
      setState('speaking')
      setSubtitle(reply)
      setMeta(`${VISION_MODEL} · ${elapsed}s`)
      speak(reply)
      setTimeout(() => setState('idle'), 1800)
    } catch (err) {
      setState('idle')
      setSubtitle(`[ERROR VISION] ${err.message?.slice(0, 100)}`)
    }
  }

  const transcribeAndSend = async (blob) => {
    setState('thinking')
    setSubtitle('')
    setMeta('')
    try {
      const form = new FormData()
      form.append('file', blob, 'recording.webm')
      form.append('language', 'id')
      const res = await fetch(`${API_BASE}/v1/speech/transcribe`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${API_KEY}` },
        body: form,
        signal: AbortSignal.timeout(30000),
      })
      if (!res.ok) {
        const err = await res.text().catch(() => '')
        throw new Error(`HTTP ${res.status}: ${err.slice(0, 120)}`)
      }
      const data = await res.json()
      const text = (data.text || '').trim()
      if (!text) {
        setState('idle')
        setSubtitle('[Tidak ada suara terdeteksi — coba lagi]')
        return
      }
      if (SCREEN_VISION_PATTERN.test(text) && window.orbAPI?.captureScreen) {
        await handleScreenVision(text)
      } else {
        await send(text)
      }
    } catch (err) {
      setState('idle')
      setSubtitle(`[ERROR STT] ${err.message?.slice(0, 100)}`)
    }
  }

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mr = new MediaRecorder(stream)
      chunksRef.current = []
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      mr.onstop = () => {
        stream.getTracks().forEach(t => t.stop())
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        transcribeAndSend(blob)
      }
      mr.start()
      mediaRecorderRef.current = mr
      setRecording(true)
      setState('listening')
      setSubtitle('')
      setMeta('')
    } catch (err) {
      setSubtitle('[ERROR] Tidak bisa akses mikrofon. Izinkan akses mic di browser.')
    }
  }

  const stopRecording = () => {
    mediaRecorderRef.current?.stop()
    setRecording(false)
  }

  const handleMicClick = () => {
    if (state === 'thinking') return
    if (recording) stopRecording()
    else startRecording()
  }

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  const stateLabel =
    state === 'listening' ? 'MENDENGARKAN' :
    state === 'analyzing' ? 'MENGANALISA LAYAR' :
    state === 'thinking'  ? 'MEMPROSES' :
    state === 'speaking'  ? 'MERESPONS' : 'SIAGA'

  // ─── ORB MODE — used by the Electron floating overlay ─────────────────────
  // Distinguishes a quick click (start/stop talking) from a click-and-drag
  // (move the window) manually, since CSS -webkit-app-region: drag eats
  // all pointer events and never lets onClick fire.
  const dragState = useRef({ down: false, moved: false, lastX: 0, lastY: 0 })
  const DRAG_THRESHOLD = 4 // px of movement before we treat it as a drag

  const handleOrbMouseDown = (e) => {
    dragState.current = { down: true, moved: false, lastX: e.screenX, lastY: e.screenY }
  }

  const handleOrbMouseMove = (e) => {
    if (!dragState.current.down) return
    const dx = e.screenX - dragState.current.lastX
    const dy = e.screenY - dragState.current.lastY
    if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) {
      dragState.current.moved = true
    }
    if (dragState.current.moved && window.orbAPI) {
      window.orbAPI.moveWindowBy(dx, dy)
      dragState.current.lastX = e.screenX
      dragState.current.lastY = e.screenY
    }
  }

  const handleOrbMouseUp = () => {
    if (dragState.current.down && !dragState.current.moved) {
      handleMicClick()
    }
    dragState.current.down = false
    dragState.current.moved = false
  }

  if (isOrbMode) {
    return (
      <div
        className="orb-wrap"
        onMouseDown={handleOrbMouseDown}
        onMouseMove={handleOrbMouseMove}
        onMouseUp={handleOrbMouseUp}
        onMouseLeave={handleOrbMouseUp}
        title="Klik untuk bicara, tahan-geser untuk pindah"
      >
        <ArcReactor state={state} />
      </div>
    )
  }

  // ─── FULL MODE — used by regular browser access ────────────────────────────
  return (
    <div className="app">
      <header className="topbar">
        <span className="topbar__brand">J.A.R.V.I.S.</span>
        <div className="topbar__status">
          <span className={`dot ${connected ? 'dot--ok' : 'dot--warn'}`} />
          <span>{connected ? 'API TERHUBUNG' : 'OFFLINE'}</span>
          <span className="topbar__clock">{clock}</span>
        </div>
      </header>

      <main className="stage">
        <ArcReactor state={state} />
        <div className="stage__label">{stateLabel}</div>
        {subtitle && (
          <div className="stage__subtitle" key={subtitle}>
            {subtitle}
          </div>
        )}
        {meta && <div className="stage__meta">{meta}</div>}
      </main>

      <footer className="inputbar">
        <button
          className={`inputbar__mic ${recording ? 'inputbar__mic--active' : ''}`}
          title={recording ? 'Berhenti merekam' : 'Bicara ke J.A.R.V.I.S.'}
          onClick={handleMicClick}
          disabled={state === 'thinking'}
        >
          <svg viewBox="0 0 24 24" width="18" height="18">
            <path fill="currentColor"
              d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2z"/>
          </svg>
        </button>
        <input
          className="inputbar__field"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Perintah untuk J.A.R.V.I.S. ..."
          disabled={state === 'thinking'}
        />
        <button
          className="inputbar__send"
          onClick={() => send()}
          disabled={state === 'thinking' || !input.trim()}
        >
          KIRIM
        </button>
      </footer>
    </div>
  )
}
