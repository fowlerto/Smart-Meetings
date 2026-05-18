import type { Session } from '../types.ts'

export function renderActiveSessionPhone(transcript: string, cueCount: number, duration: number): void {
  const transcriptEl = document.getElementById('phone-transcript')
  const cueCountEl = document.getElementById('cue-count')
  const timerEl = document.getElementById('session-timer')

  if (transcriptEl) {
    transcriptEl.textContent = transcript
    transcriptEl.scrollTop = transcriptEl.scrollHeight
  }
  if (cueCountEl) cueCountEl.textContent = `Cues: ${cueCount}`
  if (timerEl) timerEl.textContent = formatDuration(duration)
}

export function showCueDrawer(cueText: string, cueType: string): void {
  const drawer = document.getElementById('cue-drawer')
  const cueTextEl = document.getElementById('cue-drawer-text')
  const cueTypeEl = document.getElementById('cue-drawer-type')
  if (!drawer) return
  if (cueTextEl) cueTextEl.textContent = cueText
  if (cueTypeEl) cueTypeEl.textContent = cueType.toUpperCase()
  drawer.style.display = 'block'
  setTimeout(() => { drawer.style.display = 'none' }, 8000)
}

export function renderSessionList(
  sessions: { id: string; title: string; date: number; duration: number }[],
  onDelete: (id: string) => void,
): void {
  const listEl = document.getElementById('sessions-list')
  if (!listEl) return
  if (!sessions.length) {
    listEl.innerHTML = '<p class="empty-state">No sessions yet. Start recording to capture your first meeting.</p>'
    return
  }
  listEl.innerHTML = sessions
    .map(s => `
    <div class="session-row" data-id="${s.id}">
      <div class="session-row-main">
        <div class="session-title">${escapeHtml(s.title)}</div>
        <div class="session-meta">${new Date(s.date).toLocaleDateString()} · ${formatDuration(s.duration)}</div>
      </div>
      <button class="session-delete btn-icon" data-id="${s.id}" title="Delete session">✕</button>
    </div>`)
    .join('')

  listEl.querySelectorAll<HTMLElement>('.session-delete').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation()
      onDelete(btn.dataset.id!)
    })
  })
}

export function renderSessionDetail(session: Session): void {
  const titleEl = document.getElementById('session-detail-title')
  const summarySection = document.getElementById('session-summary-section')
  const summaryEl = document.getElementById('session-detail-summary')
  const transcriptEl = document.getElementById('session-detail-transcript')
  const cuesEl = document.getElementById('session-detail-cues')
  const summaryCb = document.getElementById('share-summary') as HTMLInputElement | null
  const summaryNote = document.getElementById('share-summary-note')
  const promptCb = null // checked state driven by HTML default; cleared here to avoid lint warnings

  if (titleEl) titleEl.textContent = session.title

  if (session.summary) {
    if (summarySection) summarySection.style.display = 'block'
    if (summaryEl) summaryEl.textContent = session.summary
    if (summaryCb) { summaryCb.disabled = false; summaryCb.checked = true }
    if (summaryNote) summaryNote.style.display = 'none'
  } else {
    if (summarySection) summarySection.style.display = 'none'
    if (summaryCb) { summaryCb.disabled = true; summaryCb.checked = false }
    if (summaryNote) summaryNote.style.display = 'inline'
  }

  if (transcriptEl) transcriptEl.textContent = session.transcript
  if (cuesEl) {
    cuesEl.innerHTML = session.cues
      .map(c => `
        <div class="cue-item cue-${c.type}">
          <span class="cue-type">${c.type}</span>
          <span class="cue-text">${escapeHtml(c.text)}</span>
        </div>`)
      .join('')
  }

  void promptCb
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600).toString().padStart(2, '0')
  const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0')
  const s = (seconds % 60).toString().padStart(2, '0')
  return `${h}:${m}:${s}`
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
