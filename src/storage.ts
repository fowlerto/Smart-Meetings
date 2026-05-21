import type { EvenAppBridge } from '@evenrealities/even_hub_sdk'
import type { Settings, Session, SessionIndex, ContextDoc } from './types.ts'
import { DEFAULT_SETTINGS } from './types.ts'

let bridge: EvenAppBridge

export function initStorage(b: EvenAppBridge) {
  bridge = b
}

async function get<T>(key: string): Promise<T | null> {
  try {
    const val = await bridge.getLocalStorage(key)
    return val ? (JSON.parse(val) as T) : null
  } catch {
    return null
  }
}

async function set(key: string, value: unknown): Promise<void> {
  try {
    await bridge.setLocalStorage(key, JSON.stringify(value))
  } catch {
    // ephemeral mode: silently ignore
  }
}

// Settings
export async function loadSettings(): Promise<Settings> {
  const [keys, models, cues, display, summary, prompts, audio, activeDocId] = await Promise.all([
    get<Settings['keys']>('settings:keys'),
    get<Settings['models']>('settings:models'),
    get<Settings['cues']>('settings:cues'),
    get<Settings['display']>('settings:display'),
    get<Settings['summary']>('settings:summary'),
    get<Settings['prompts']>('settings:prompts'),
    get<Settings['audio']>('settings:audio'),
    get<string | null>('settings:activeDocId'),
  ])
  return {
    keys: keys ?? DEFAULT_SETTINGS.keys,
    models: models ?? DEFAULT_SETTINGS.models,
    cues: cues ?? DEFAULT_SETTINGS.cues,
    display: display ?? DEFAULT_SETTINGS.display,
    summary: summary ?? DEFAULT_SETTINGS.summary,
    prompts: prompts ?? DEFAULT_SETTINGS.prompts,
    audio: audio ?? DEFAULT_SETTINGS.audio,
    activeDocId: activeDocId ?? null,
  }
}

export async function saveSettings(s: Settings): Promise<void> {
  await Promise.all([
    set('settings:keys', s.keys),
    set('settings:models', s.models),
    set('settings:cues', s.cues),
    set('settings:display', s.display),
    set('settings:summary', s.summary),
    set('settings:prompts', s.prompts),
    set('settings:audio', s.audio),
    set('settings:activeDocId', s.activeDocId),
  ])
}

// Sessions
export async function loadSessionIndex(): Promise<SessionIndex[]> {
  return (await get<SessionIndex[]>('sessions:index')) ?? []
}

export async function saveSessionIndex(index: SessionIndex[]): Promise<void> {
  await set('sessions:index', index)
}

export async function loadSession(id: string): Promise<Session | null> {
  return get<Session>(`sessions:${id}`)
}

export async function saveSession(session: Session): Promise<void> {
  await set(`sessions:${session.id}`, session)
  const index = await loadSessionIndex()
  const entry: SessionIndex = {
    id: session.id,
    title: session.title,
    date: session.date,
    duration: session.duration,
  }
  const existing = index.findIndex(s => s.id === session.id)
  if (existing >= 0) index[existing] = entry
  else index.unshift(entry)
  await saveSessionIndex(index)
}

export async function deleteSession(id: string): Promise<void> {
  await set(`sessions:${id}`, null)
  const index = (await loadSessionIndex()).filter(s => s.id !== id)
  await saveSessionIndex(index)
}

// Context docs — max 5, no folders
const MAX_DOC_BYTES = 5 * 1024 * 1024
const MAX_DOCS = 5
const CHUNK_SIZE = 2000

export async function loadContextIndex(): Promise<ContextDoc[]> {
  return (await get<ContextDoc[]>('ctx:index')) ?? []
}

export async function saveContextIndex(index: ContextDoc[]): Promise<void> {
  await set('ctx:index', index)
}

export async function saveContextDoc(
  doc: ContextDoc,
  text: string,
): Promise<{ ok: boolean; error?: string }> {
  if (doc.sizeBytes > MAX_DOC_BYTES) {
    return { ok: false, error: 'Document exceeds the 5 MB limit. Please use a smaller file or paste a shorter excerpt.' }
  }

  const index = await loadContextIndex()
  const isNew = !index.find(d => d.id === doc.id)
  if (isNew && index.length >= MAX_DOCS) {
    return { ok: false, error: `You can store up to ${MAX_DOCS} documents. Delete one before adding another.` }
  }

  const chunks = chunkText(text, CHUNK_SIZE)
  doc.chunkCount = chunks.length
  await Promise.all(chunks.map((chunk, i) => set(`ctx:${doc.id}:${i}`, chunk)))

  const existing = index.findIndex(d => d.id === doc.id)
  if (existing >= 0) index[existing] = doc
  else index.push(doc)
  await saveContextIndex(index)

  return { ok: true }
}

export async function loadContextDocText(doc: ContextDoc): Promise<string> {
  const chunks = await Promise.all(
    Array.from({ length: doc.chunkCount }, (_, i) => get<string>(`ctx:${doc.id}:${i}`)),
  )
  return chunks.filter(Boolean).join('')
}

export async function deleteContextDoc(id: string, chunkCount: number): Promise<void> {
  await Promise.all(Array.from({ length: chunkCount }, (_, i) => set(`ctx:${id}:${i}`, null)))
  const index = (await loadContextIndex()).filter(d => d.id !== id)
  await saveContextIndex(index)
}

// Utilities
function chunkText(text: string, size: number): string[] {
  const chunks: string[] = []
  for (let i = 0; i < text.length; i += size) chunks.push(text.slice(i, i + size))
  return chunks
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}
