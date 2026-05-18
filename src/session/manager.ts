import type { Session, Cue, ContextDoc } from '../types.ts'
import { generateId, saveSession, loadSession, deleteSession as storageDelete } from '../storage.ts'

let activeSession: Session | null = null

export function getActiveSession(): Session | null {
  return activeSession
}

export function startSession(contextDoc: ContextDoc | null): Session {
  activeSession = {
    id: generateId(),
    title: `Session ${new Date().toLocaleString()}`,
    date: Date.now(),
    duration: 0,
    contextDocId: contextDoc?.id ?? null,
    transcript: '',
    cues: [],
    actionItems: [],
  }
  return activeSession
}

export function appendSessionTranscript(text: string) {
  if (!activeSession) return
  activeSession.transcript += text + '\n'
  if (activeSession.title.startsWith('Session ') && activeSession.transcript.trim().length > 20) {
    const firstLine = activeSession.transcript.trim().split('\n')[0]
    activeSession.title = firstLine.slice(0, 60)
  }
}

export function addCueToSession(cue: Cue) {
  if (!activeSession) return
  if (activeSession.cues.length >= 20) activeSession.cues.shift()
  activeSession.cues.push(cue)
}

export async function stopSession(): Promise<Session | null> {
  if (!activeSession) return null
  activeSession.duration = Math.floor((Date.now() - activeSession.date) / 1000)
  await saveSession(activeSession)
  const saved = activeSession
  activeSession = null
  return saved
}

export async function flushSession(): Promise<void> {
  if (!activeSession) return
  activeSession.duration = Math.floor((Date.now() - activeSession.date) / 1000)
  await saveSession(activeSession)
}

export { loadSession, storageDelete as deleteSession }

export interface ShareOptions {
  includeTranscript: boolean
  includeSummary: boolean
  includeCues: boolean
  includePrompt: boolean
  sharePrompt: string
}

export function buildShareExport(session: Session, opts: ShareOptions): string {
  const lines: string[] = [
    '--- SMART MEETING SESSION EXPORT ---',
    `Title: ${session.title}`,
    `Date: ${new Date(session.date).toLocaleString()}`,
    `Duration: ${formatDuration(session.duration)}`,
  ]

  if (opts.includeSummary && session.summary) {
    lines.push('\n--- SUMMARY ---')
    lines.push(session.summary)
  }

  if (opts.includeTranscript) {
    lines.push('\n--- TRANSCRIPT ---')
    lines.push(session.transcript || '(no transcript)')
  }

  if (opts.includeCues && session.cues.length > 0) {
    lines.push('\n--- AI CUES ---')
    lines.push(session.cues
      .map(c => `[${formatDuration(Math.floor((c.timestamp - session.date) / 1000))}] [${c.type}] ${c.text}`)
      .join('\n'))
  }

  if (opts.includePrompt && opts.sharePrompt) {
    lines.push('\n--- INSTRUCTIONS FOR AI ASSISTANT ---')
    lines.push(opts.sharePrompt)
  }

  return lines.join('\n')
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600).toString().padStart(2, '0')
  const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0')
  const s = (seconds % 60).toString().padStart(2, '0')
  return `${h}:${m}:${s}`
}
