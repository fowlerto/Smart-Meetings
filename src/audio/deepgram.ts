import type { EvenAppBridge } from '@evenrealities/even_hub_sdk'

export type TranscriptCallback = (text: string) => void

let bridge: EvenAppBridge
let ws: WebSocket | null = null
let apiKey = ''
let onTranscript: TranscriptCallback | null = null
let reconnectAttempts = 0
let running = false
let onStatusChange: ((status: string) => void) | null = null

// Phone mic state
let phoneMicStream: MediaStream | null = null
let phoneMicCtx: AudioContext | null = null
let phoneMicNode: ScriptProcessorNode | null = null
let phoneMicSampleRate = 16000

const MAX_RECONNECT = 3
const RECONNECT_DELAY_MS = 2000

export function initDeepgram(b: EvenAppBridge) {
  bridge = b
}

export function configureDeepgram(key: string) {
  apiKey = key
}

export function onDeepgramStatus(cb: (status: string) => void) {
  onStatusChange = cb
}

function buildWsUrl(sampleRate = 16000): string {
  return `wss://api.deepgram.com/v1/listen?model=nova-3&encoding=linear16&sample_rate=${sampleRate}&channels=1&smart_format=true&punctuate=true`
}

// ── Glasses mic (G2 hardware) ──────────────────────────────────────────────────

export async function startStreaming(transcriptCb: TranscriptCallback): Promise<void> {
  onTranscript = transcriptCb
  running = true
  reconnectAttempts = 0
  try { await bridge.audioControl(true) } catch { /* simulator may not support audioControl */ }
  openWebSocket(16000)
}

export async function stopStreaming(): Promise<void> {
  running = false
  try { await bridge.audioControl(false) } catch { /* ignore */ }
  closeWebSocket()
}

// ── Phone mic (getUserMedia) ───────────────────────────────────────────────────

export async function startPhoneMicStreaming(transcriptCb: TranscriptCallback): Promise<void> {
  onTranscript = transcriptCb
  running = true
  reconnectAttempts = 0

  try {
    phoneMicStream = await navigator.mediaDevices.getUserMedia({ audio: true })
    phoneMicCtx = new AudioContext()
    phoneMicSampleRate = phoneMicCtx.sampleRate
    const source = phoneMicCtx.createMediaStreamSource(phoneMicStream)
    // ScriptProcessorNode is deprecated but broadly supported in embedded WebViews
    phoneMicNode = phoneMicCtx.createScriptProcessor(4096, 1, 1)
    phoneMicNode.onaudioprocess = (e) => {
      const float32 = e.inputBuffer.getChannelData(0)
      const int16 = new Int16Array(float32.length)
      for (let i = 0; i < float32.length; i++) {
        int16[i] = Math.max(-32768, Math.min(32767, Math.round(float32[i] * 32767)))
      }
      sendAudioData(new Uint8Array(int16.buffer))
    }
    source.connect(phoneMicNode)
    phoneMicNode.connect(phoneMicCtx.destination)
  } catch {
    onStatusChange?.('mic-denied')
    running = false
    return
  }

  openWebSocket(phoneMicSampleRate)
}

export async function stopPhoneMicStreaming(): Promise<void> {
  running = false
  if (phoneMicNode) { phoneMicNode.disconnect(); phoneMicNode = null }
  if (phoneMicCtx) { await phoneMicCtx.close(); phoneMicCtx = null }
  if (phoneMicStream) { phoneMicStream.getTracks().forEach(t => t.stop()); phoneMicStream = null }
  closeWebSocket()
}

// ── WebSocket ─────────────────────────────────────────────────────────────────

function openWebSocket(sampleRate: number) {
  ws = new WebSocket(buildWsUrl(sampleRate), ['token', apiKey])
  ws.binaryType = 'arraybuffer'

  ws.onopen = () => {
    reconnectAttempts = 0
    onStatusChange?.('connected')
  }

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data as string)
      if (!data.is_final) return
      const transcript = data.channel?.alternatives?.[0]?.transcript as string | undefined
      if (transcript) onTranscript?.(transcript)
    } catch {
      // ignore malformed frames
    }
  }

  ws.onerror = () => {
    onStatusChange?.('error')
  }

  ws.onclose = () => {
    if (!running) return
    if (reconnectAttempts < MAX_RECONNECT) {
      reconnectAttempts++
      onStatusChange?.('reconnecting…')
      setTimeout(() => openWebSocket(sampleRate), RECONNECT_DELAY_MS)
    } else {
      onStatusChange?.('failed')
      running = false
    }
  }
}

function closeWebSocket() {
  if (ws && ws.readyState === WebSocket.OPEN) ws.close()
  ws = null
}

// Called from the even hub event handler for audio PCM data.
// The SDK types audioPcm as Uint8Array but the runtime value after JSON
// bridge serialization may be a number[] or base64 string.
export function sendAudioData(pcmData: Uint8Array | number[] | string) {
  if (ws?.readyState !== WebSocket.OPEN) return
  const bytes = normalizePcm(pcmData)
  if (bytes.byteLength > 0) ws.send(bytes.buffer as ArrayBuffer)
}

function normalizePcm(data: Uint8Array | number[] | string): Uint8Array {
  if (typeof data === 'string') {
    const binary = atob(data)
    const out = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i)
    return out
  }
  if (Array.isArray(data)) return new Uint8Array(data)
  const copy = new Uint8Array(data.byteLength)
  copy.set(data)
  return copy
}

export function isStreaming(): boolean {
  return running
}
