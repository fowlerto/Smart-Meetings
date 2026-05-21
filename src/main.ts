import { waitForEvenAppBridge, OsEventTypeList, TextContainerProperty, TextContainerUpgrade, CreateStartUpPageContainer } from '@evenrealities/even_hub_sdk'
import type { EvenAppBridge } from '@evenrealities/even_hub_sdk'
import { renderPhoneHTML } from './phone/template.ts'
import {
  initStorage, loadSettings, saveSettings, saveSession, loadSessionIndex,
  loadContextDocText, loadContextIndex, generateId,
} from './storage.ts'
import { initHud, startHudUpdates, stopHudUpdates, setHudContext } from './glasses/hud.ts'
import { initHomeScreen, renderHomeScreen, rebuildHomeScreen, homeSelectUp, homeSelectDown, getSelectedIndex } from './glasses/home.ts'
import {
  initSessionScreen, resetSessionDisplay, appendTranscript, incrementCueCount,
  renderSessionScreen, stopStatusTimer, showReconnecting, showCueReady,
  setTranscriptUpdates,
} from './glasses/session.ts'
import { initCueOverlay, showCueOverlay, cueNavigatePrev, cueNavigateNext, dismissCueOverlay } from './glasses/cue.ts'
import {
  initDeepgram, configureDeepgram, startStreaming, stopStreaming,
  startPhoneMicStreaming, stopPhoneMicStreaming,
  sendAudioData, onDeepgramStatus,
} from './audio/deepgram.ts'
import {
  configureAI, shouldGenerateCue, generateCue, askClaude,
  startMeetingConversation, endMeetingConversation, generateSummary,
} from './ai/claude.ts'
import {
  startSession, appendSessionTranscript, addCueToSession, stopSession,
  flushSession, buildShareExport, loadSession, deleteSession,
} from './session/manager.ts'
import type { ShareOptions } from './session/manager.ts'
import { renderSettings, collectSettings } from './phone/settings.ts'
import { renderSessionList, renderSessionDetail, renderActiveSessionPhone, showCueDrawer } from './phone/session-view.ts'
import {
  importTextDoc, removeDoc, renderDocsList, loadContextIndex as reloadDocs,
} from './phone/context-docs.ts'
import type { Settings, Cue } from './types.ts'
import { DEFAULT_SETTINGS } from './types.ts'


// ── App state ─────────────────────────────────────────────────────────────────

let bridge: EvenAppBridge
let settings: Settings = DEFAULT_SETTINGS
let glassesView: 'home' | 'active-session' | 'cue-overlay' = 'home'
let glassesPageCreated = false

let activeContextText = ''
let activeContextName = ''
let sessionTimerInterval: ReturnType<typeof setInterval> | null = null
let sessionDuration = 0
let phoneTranscript = ''
let phoneCueCount = 0

let cueDetectorInterval: ReturnType<typeof setInterval> | null = null
let transcriptSinceLastCue = ''
let currentDetailSession: import('./types.ts').Session | null = null


// ── Boot ──────────────────────────────────────────────────────────────────────

async function boot() {
  renderPhoneHTML()
  wirePhoneUI()

  try {
    bridge = await waitForEvenAppBridge()
  } catch {
    renderFallbackMessage('Could not connect to Even bridge. Please restart the app.')
    return
  }

  initStorage(bridge)
  initHud(bridge)
  initHomeScreen(bridge)
  initSessionScreen(bridge)
  initCueOverlay(bridge)
  initDeepgram(bridge)

  onDeepgramStatus((status) => {
    if (status === 'reconnecting…') showReconnecting()
    const el = document.getElementById('deepgram-status')
    if (el) {
      el.textContent = `Deepgram: ${status}`
      el.style.color = status === 'connected' ? '#3ecf8e' : '#f87171'
    }
  })

  try {
    settings = await loadSettings()
  } catch {
    document.getElementById('storage-warning')!.style.display = 'block'
  }

  applySettings()
  wireGlassesInput()

  if (!settings.keys.deepgramKey || !settings.keys.anthropicKey) {
    await showSetupGlassesScreen()
    glassesPageCreated = true
    switchPhoneTab('settings')
  } else {
    await renderHomeScreen()
    glassesPageCreated = true
    glassesView = 'home'
  }

  startHudUpdates()
}

// ── First-run glasses screen ──────────────────────────────────────────────────

async function showSetupGlassesScreen() {
  const msg = 'Smart Meeting\n\nOpen the phone app and go to Settings → Keys to add your Deepgram and Anthropic API keys.'
  await bridge.createStartUpPageContainer(
    new CreateStartUpPageContainer({
      containerTotalNum: 1,
      textObject: [new TextContainerProperty({
        xPosition: 0, yPosition: 0, width: 576, height: 288,
        borderWidth: 0, borderColor: 5, paddingLength: 12,
        containerID: 1, containerName: 'setup',
        content: msg, isEventCapture: 1,
      })],
    }),
  )
}

function renderFallbackMessage(msg: string) {
  const app = document.getElementById('app')!
  app.innerHTML = `<div style="padding:32px;color:#f0f0f0;font-family:sans-serif">${msg}</div>`
}

// ── Glasses input ─────────────────────────────────────────────────────────────

function wireGlassesInput() {
  bridge.onEvenHubEvent(async (event) => {
    if (event.audioEvent?.audioPcm) {
      sendAudioData(event.audioEvent.audioPcm)
      return
    }

    // Lifecycle events arrive as sysEvent — handle and return early only for those
    const sys = event.sysEvent
    if (sys) {
      switch (sys.eventType) {
        case OsEventTypeList.FOREGROUND_EXIT_EVENT: await onBackground(); return
        case OsEventTypeList.FOREGROUND_ENTER_EVENT: await onForeground(); return
        case OsEventTypeList.ABNORMAL_EXIT_EVENT: await onExit(); return
        case OsEventTypeList.SYSTEM_EXIT_EVENT: await onExit(); return
        case OsEventTypeList.IMU_DATA_REPORT: return
      }
      // Touch events can also arrive as sysEvent (carries eventSource field) — fall through
    }

    // Prefer textEvent, fall back to listEvent, then sysEvent for touch
    const rawType = event.textEvent?.eventType
      ?? event.listEvent?.eventType
      ?? event.sysEvent?.eventType

    const type = OsEventTypeList.fromJson(rawType)
    console.log('[input]', 'view:', glassesView, 'raw:', rawType, 'type:', type,
      'text:', !!event.textEvent, 'list:', !!event.listEvent, 'sys:', !!event.sysEvent)

    if (glassesView === 'home') await handleHomeInput(type)
    else if (glassesView === 'active-session') await handleSessionInput(type)
    else if (glassesView === 'cue-overlay') handleCueInput(type)
  })
}

async function handleHomeInput(type: OsEventTypeList | undefined) {
  switch (type) {
    case OsEventTypeList.SCROLL_TOP_EVENT: homeSelectUp(); break
    case OsEventTypeList.SCROLL_BOTTOM_EVENT: homeSelectDown(); break
    case OsEventTypeList.CLICK_EVENT:
    case undefined:
      // CLICK_EVENT = 0 can arrive as undefined after JSON bridge normalization
      await beginSession()
      break
    case OsEventTypeList.DOUBLE_CLICK_EVENT:
      bridge.shutDownPageContainer(1)
      break
  }
}

async function handleSessionInput(type: OsEventTypeList | undefined) {
  switch (type) {
    case OsEventTypeList.CLICK_EVENT:
    case undefined:
      // CLICK_EVENT = 0 can arrive as undefined after JSON bridge normalization
      await triggerManualCue()
      break
    case OsEventTypeList.DOUBLE_CLICK_EVENT:
      await endSession()
      break
    // SCROLL_TOP/BOTTOM reserved for future transcript navigation — no-op during session
  }
}

function handleCueInput(type: OsEventTypeList | undefined) {
  switch (type) {
    case OsEventTypeList.SCROLL_TOP_EVENT: cueNavigatePrev(); break
    case OsEventTypeList.SCROLL_BOTTOM_EVENT: cueNavigateNext(); break
    case OsEventTypeList.CLICK_EVENT:
    case undefined:
    case OsEventTypeList.DOUBLE_CLICK_EVENT:
      dismissCueOverlay()
      break
  }
}

// ── Audio helpers ─────────────────────────────────────────────────────────────

function startAudio(cb: (text: string) => void): Promise<void> {
  return settings.audio?.usePhoneMic ? startPhoneMicStreaming(cb) : startStreaming(cb)
}

function stopAudio(): Promise<void> {
  return settings.audio?.usePhoneMic ? stopPhoneMicStreaming() : stopStreaming()
}

// ── Session lifecycle ─────────────────────────────────────────────────────────

async function beginSession() {
  const docIndex = await reloadDocs()
  const activeDoc = settings.activeDocId
    ? docIndex.find(d => d.id === settings.activeDocId) ?? null
    : null

  if (activeDoc) {
    activeContextText = await loadContextDocText(activeDoc)
    activeContextName = activeDoc.name
    setHudContext(activeContextName)
    const ctxEl = document.getElementById('context-name')
    if (ctxEl) ctxEl.textContent = activeContextName
  } else {
    activeContextText = ''
    activeContextName = ''
    setHudContext('')
  }

  // Start persistent Claude conversation with context doc loaded once
  startMeetingConversation(activeContextText)

  startSession(activeDoc)
  resetSessionDisplay()
  phoneTranscript = ''
  phoneCueCount = 0
  sessionDuration = 0
  transcriptSinceLastCue = ''

  renderSessionScreen()
  glassesView = 'active-session'

  document.getElementById('session-idle')!.style.display = 'none'
  document.getElementById('session-active')!.style.display = 'flex'
  document.getElementById('rec-badge')!.style.display = 'block'

  sessionTimerInterval = setInterval(() => {
    sessionDuration++
    renderActiveSessionPhone(phoneTranscript || 'Listening…', phoneCueCount, sessionDuration)
  }, 1000)

  if (!settings.keys.deepgramKey) {
    appendTranscript('[Deepgram key required — open Settings → Keys]')
    return
  }

  await startAudio((text: string) => {
    if (settings.display.liveTranscription) appendTranscript(text)
    phoneTranscript += text + '\n'
    appendSessionTranscript(text)
    transcriptSinceLastCue += text + ' '
  })

  startCueDetector()
}

async function endSession() {
  stopCueDetector()
  stopStatusTimer()
  setTranscriptUpdates(true)
  try { await stopAudio() } catch { /* ensure we always reach rebuildHomeScreen */ }
  endMeetingConversation()

  if (sessionTimerInterval) { clearInterval(sessionTimerInterval); sessionTimerInterval = null }

  let saved = null
  try { saved = await stopSession() } catch (e) { console.error('[endSession] stopSession error:', e) }

  document.getElementById('session-idle')!.style.display = 'block'
  document.getElementById('session-active')!.style.display = 'none'
  document.getElementById('rec-badge')!.style.display = 'none'

  setHudContext('')
  activeContextText = ''
  activeContextName = ''

  glassesView = 'home'
  try { await rebuildHomeScreen() } catch (e) { console.error('[endSession] rebuildHomeScreen error:', e) }
  await refreshSessionsList()

  if (saved) {
    switchPhoneTab('sessions')
    await openSessionDetail(saved.id)
  }
}

// ── Cue pipeline ──────────────────────────────────────────────────────────────

function startCueDetector() {
  if (settings.cues.frequency === 0) return
  cueDetectorInterval = setInterval(async () => {
    if (transcriptSinceLastCue.trim().length < 40) return
    if (!settings.keys.anthropicKey) return

    const snippet = transcriptSinceLastCue.slice(-800)
    transcriptSinceLastCue = ''

    if (!(await shouldGenerateCue(snippet))) return
    await deliverCue(snippet)
  }, settings.cues.frequency * 1000)
}

function stopCueDetector() {
  if (cueDetectorInterval) { clearInterval(cueDetectorInterval); cueDetectorInterval = null }
}

async function deliverCue(snippet: string) {
  const result = await generateCue(snippet)
  if (!result) {
    bridge.textContainerUpgrade(new TextContainerUpgrade({ containerID: 4, containerName: 'status-bar', content: '[Cue failed]', contentOffset: 0, contentLength: 12 }))
    return
  }

  const cue: Cue = { id: generateId(), ...result, timestamp: Date.now(), starred: false }
  addCueToSession(cue)
  incrementCueCount()
  phoneCueCount++

  if (settings.cues.autoPopup && settings.display.cuesOnGlasses) {
    setTranscriptUpdates(false)
    showCueOverlay(cue, settings.cues.hold, () => {
      setTranscriptUpdates(true)
      glassesView = 'active-session'
      renderSessionScreen()
    })
    glassesView = 'cue-overlay'
  } else {
    showCueReady()
  }

  showCueDrawer(cue.text, cue.type)
}

async function triggerManualCue() {
  if (!settings.keys.anthropicKey) return
  const snippet = phoneTranscript.slice(-800)
  if (snippet.trim().length < 20) {
    showToast('Not enough transcript yet — keep talking')
    return
  }
  await deliverCue(snippet)
}


// ── Phone UI ──────────────────────────────────────────────────────────────────

function wirePhoneUI() {
  document.addEventListener('click', async (e) => {
    const target = e.target as HTMLElement

    const navTab = target.closest<HTMLElement>('[data-screen]')
    if (navTab) { switchPhoneTab(navTab.dataset.screen!); return }

    const settingsTab = target.closest<HTMLElement>('[data-panel]')
    if (settingsTab) { switchSettingsPanel(settingsTab.dataset.panel!); return }

    const sessionRow = target.closest<HTMLElement>('.session-row-main')
    if (sessionRow) {
      const row = sessionRow.closest<HTMLElement>('.session-row')
      if (row?.dataset.id) { await openSessionDetail(row.dataset.id); return }
    }

    switch (target.id) {
      case 'start-btn':
        if (!settings.keys.deepgramKey) {
          alert('Deepgram API key required — open Settings → Keys.')
          switchPhoneTab('settings')
          return
        }
        await beginSession()
        break
      case 'stop-btn': await endSession(); break
      case 'manual-cue-btn': await triggerManualCue(); break
      case 'session-ask-btn': switchPhoneTab('ask'); break
      case 'ask-send-btn': await sendAskClaude(); break
      case 'add-doc-btn': openDocImportModal(); break
      case 'doc-cancel-btn': closeDocImportModal(); break
      case 'doc-confirm-btn': await confirmDocImport(); break
      case 'back-to-list': showSessionsList(); break
      case 'generate-summary-btn': await generateCurrentSummary(); break
      case 'restore-default-prompt-btn': restoreDefaultPrompt(); break
      case 'share-btn': await shareCurrentSession(); break
    }

    if (target.id?.startsWith('save-settings')) await saveSettingsFromForm()

    // Doc delete via data-action attribute
    const actionBtn = target.closest<HTMLElement>('[data-action="delete"]')
    if (actionBtn?.dataset.id) {
      const docs = await reloadDocs()
      const doc = docs.find(d => d.id === actionBtn.dataset.id)
      if (doc && confirm(`Delete "${doc.name}"?`)) {
        await removeDoc(doc)
        if (settings.activeDocId === doc.id) {
          settings.activeDocId = null
          await saveSettings(settings)
        }
        await refreshContextDocs()
      }
    }
  })

  document.addEventListener('input', (e) => {
    const el = e.target as HTMLInputElement
    if (el.type === 'range') {
      const label = document.getElementById(`${el.id}-label`)
      if (label) label.textContent = el.value
    }
  })

  document.addEventListener('change', async (e) => {
    const el = e.target as HTMLInputElement
    if (el.id === 'doc-file-input') {
      const file = el.files?.[0]
      if (!file) return
      const nameInput = document.getElementById('doc-name-input') as HTMLInputElement
      const textInput = document.getElementById('doc-text-input') as HTMLTextAreaElement
      const errEl = document.getElementById('doc-import-error')!
      nameInput.value = file.name.replace(/\.[^.]+$/, '')
      errEl.style.display = 'none'
      if (file.name.toLowerCase().endsWith('.pdf')) {
        textInput.value = 'Extracting PDF text…'
        try {
          const { extractPdfText } = await import('./utils/pdf.ts')
          const extracted = await extractPdfText(file)
          if (extracted.trim().length < 20) {
            textInput.value = ''
            errEl.textContent = 'No text found in this PDF — it may be a scanned image. Try copying the text manually and pasting it below.'
            errEl.style.display = 'block'
          } else {
            textInput.value = extracted
          }
        } catch (e) {
          console.error('[PDF] extraction error:', e)
          textInput.value = ''
          errEl.textContent = `PDF error: ${e instanceof Error ? e.message : String(e)}`
          errEl.style.display = 'block'
        }
      } else {
        const reader = new FileReader()
        reader.onload = () => { textInput.value = reader.result as string }
        reader.onerror = () => {
          errEl.textContent = 'Could not read file. Try a different format or paste the text.'
          errEl.style.display = 'block'
        }
        reader.readAsText(file)
      }
      return
    }
    if (el.id === 'cue-manual-only') {
      const freqInput = document.getElementById('cue-freq') as HTMLInputElement | null
      const freqLabel = document.getElementById('cue-freq-label')
      if (freqInput) freqInput.disabled = el.checked
      if (freqLabel) freqLabel.textContent = el.checked ? '—' : (freqInput?.value ?? '18')
    }
  })

  document.addEventListener('keydown', async (e) => {
    if (e.key === 'Enter' && (e.target as HTMLElement).id === 'ask-input') {
      await sendAskClaude()
    }
  })
}

function switchPhoneTab(screen: string) {
  document.querySelectorAll('.screen').forEach(el => el.classList.remove('active'))
  document.querySelectorAll('.nav-tab').forEach(el => el.classList.remove('active'))
  document.getElementById(`screen-${screen}`)?.classList.add('active')
  document.querySelector<HTMLElement>(`.nav-tab[data-screen="${screen}"]`)?.classList.add('active')
  if (screen === 'sessions') refreshSessionsList()
  if (screen === 'context') refreshContextDocs()
  if (screen === 'settings') renderSettings(settings)
}

function switchSettingsPanel(panel: string) {
  document.querySelectorAll('.settings-tab').forEach(el => el.classList.remove('active'))
  document.querySelectorAll('.settings-panel').forEach(el => el.classList.remove('active'))
  document.querySelector<HTMLElement>(`.settings-tab[data-panel="${panel}"]`)?.classList.add('active')
  document.getElementById(`panel-${panel}`)?.classList.add('active')
}

async function sendAskClaude() {
  const input = document.getElementById('ask-input') as HTMLInputElement
  const responseEl = document.getElementById('ask-response')!
  const question = input.value.trim()
  if (!question) return

  responseEl.textContent = 'Thinking…'
  input.value = ''

  if (!settings.keys.anthropicKey) {
    responseEl.textContent = 'Anthropic API key not configured. Open Settings → Keys.'
    return
  }

  const answer = await askClaude(question, phoneTranscript)
  responseEl.textContent = answer

  if (glassesView === 'active-session' && settings.display.cuesOnGlasses) {
    const cue: Cue = { id: generateId(), type: 'answer', text: answer.slice(0, 250), timestamp: Date.now(), starred: false, usedWebSearch: false }
    addCueToSession(cue)
    showCueOverlay(cue, settings.cues.hold, () => { glassesView = 'active-session'; renderSessionScreen() })
    glassesView = 'cue-overlay'
  }
}

async function refreshSessionsList() {
  const index = await loadSessionIndex()
  renderSessionList(index, async (id) => {
    if (confirm('Delete this session?')) {
      await deleteSession(id)
      await refreshSessionsList()
    }
  })
  const recentEl = document.getElementById('recent-sessions-list')
  if (recentEl) {
    recentEl.innerHTML = index.slice(0, 3).map(s =>
      `<div class="session-row" data-id="${s.id}">
        <div class="session-row-main">
          <div class="session-title">${escapeHtml(s.title)}</div>
          <div class="session-meta">${new Date(s.date).toLocaleDateString()}</div>
        </div>
      </div>`,
    ).join('')
  }
}

async function refreshContextDocs() {
  const docs = await reloadDocs()
  renderDocsList(docs, settings.activeDocId, async (id) => {
    settings.activeDocId = id
    await saveSettings(settings)
    await refreshContextDocs()
    showToast('Context document selected')
  })
}

function openDocImportModal() {
  document.getElementById('doc-import-modal')!.classList.add('open')
  document.getElementById('doc-import-error')!.style.display = 'none'
}

function closeDocImportModal() {
  document.getElementById('doc-import-modal')!.classList.remove('open')
  ;(document.getElementById('doc-name-input') as HTMLInputElement).value = ''
  ;(document.getElementById('doc-text-input') as HTMLTextAreaElement).value = ''
  ;(document.getElementById('doc-file-input') as HTMLInputElement).value = ''
}

async function confirmDocImport() {
  const name = (document.getElementById('doc-name-input') as HTMLInputElement).value.trim()
  const text = (document.getElementById('doc-text-input') as HTMLTextAreaElement).value.trim()
  const errEl = document.getElementById('doc-import-error')!

  if (!name || !text) {
    errEl.textContent = 'Please provide a name and document text.'
    errEl.style.display = 'block'
    return
  }

  const result = await importTextDoc(name, text)
  if (!result.ok) {
    errEl.textContent = result.error ?? 'Import failed.'
    errEl.style.display = 'block'
    return
  }

  closeDocImportModal()
  await refreshContextDocs()
  if (text.length > 10000) {
    showToast('Document added — only the first ~10,000 characters will be used as context')
  } else {
    showToast('Document added')
  }
}

function restoreDefaultPrompt() {
  const textarea = document.getElementById('share-prompt') as HTMLTextAreaElement | null
  if (textarea) textarea.value = DEFAULT_SETTINGS.prompts.sharePrompt
  showToast('Default prompt restored — tap Save Settings to keep it')
}

async function saveSettingsFromForm() {
  const hadKeys = !!(settings.keys.deepgramKey && settings.keys.anthropicKey)
  settings = collectSettings(settings)
  await saveSettings(settings)
  applySettings()
  showToast('Settings saved')

  const nowHasKeys = !!(settings.keys.deepgramKey && settings.keys.anthropicKey)
  if (!hadKeys && nowHasKeys) {
    if (glassesPageCreated) {
      rebuildHomeScreen()
    } else {
      await renderHomeScreen()
      glassesPageCreated = true
    }
    glassesView = 'home'
  }
}

function applySettings() {
  configureDeepgram(settings.keys.deepgramKey)
  configureAI(settings.keys.anthropicKey, settings)
}

async function openSessionDetail(id: string) {
  const session = await loadSession(id)
  if (!session) return
  currentDetailSession = session
  document.getElementById('sessions-list')!.style.display = 'none'
  document.getElementById('sessions-search')!.style.display = 'none'
  document.getElementById('session-detail')!.style.display = 'block'
  renderSessionDetail(session)
}

function showSessionsList() {
  currentDetailSession = null
  document.getElementById('sessions-list')!.style.display = 'block'
  document.getElementById('sessions-search')!.style.display = 'block'
  document.getElementById('session-detail')!.style.display = 'none'
}

async function generateCurrentSummary() {
  if (!currentDetailSession) return
  if (!settings.keys.anthropicKey) {
    showToast('Anthropic API key required')
    return
  }
  const btn = document.getElementById('generate-summary-btn') as HTMLButtonElement
  if (btn) { btn.textContent = 'Generating…'; btn.disabled = true }
  try {
    const summary = await generateSummary(currentDetailSession, settings.models.summaryModel)
    currentDetailSession.summary = summary
    await saveSession(currentDetailSession)
    renderSessionDetail(currentDetailSession)
    showToast('Summary generated')
  } finally {
    if (btn) { btn.textContent = '✦ Generate Summary'; btn.disabled = false }
  }
}

async function shareCurrentSession() {
  if (!currentDetailSession) return
  const opts: ShareOptions = {
    includeTranscript: (document.getElementById('share-transcript') as HTMLInputElement)?.checked ?? true,
    includeSummary: (document.getElementById('share-summary') as HTMLInputElement)?.checked ?? false,
    includeCues: (document.getElementById('share-cues') as HTMLInputElement)?.checked ?? true,
    includePrompt: (document.getElementById('share-ai-prompt') as HTMLInputElement)?.checked ?? true,
    sharePrompt: settings.prompts.sharePrompt,
  }
  const text = buildShareExport(currentDetailSession, opts)
  if (navigator.share) {
    await navigator.share({ title: currentDetailSession.title, text }).catch(() => {})
  } else {
    await navigator.clipboard.writeText(text)
    showToast('Copied to clipboard')
  }
}

function showToast(msg: string) {
  const toast = document.createElement('div')
  toast.textContent = msg
  Object.assign(toast.style, {
    position: 'fixed', bottom: '90px', left: '50%',
    transform: 'translateX(-50%)', background: '#3ecf8e', color: '#000',
    padding: '8px 16px', borderRadius: '99px', fontWeight: '600',
    fontSize: '14px', zIndex: '999', pointerEvents: 'none',
  })
  document.body.appendChild(toast)
  setTimeout(() => toast.remove(), 2200)
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// ── Lifecycle ─────────────────────────────────────────────────────────────────

async function onBackground() {
  await stopAudio()
  stopHudUpdates()
  stopCueDetector()
  stopStatusTimer()
  await flushSession()
}

async function onForeground() {
  startHudUpdates()
  if (glassesView === 'active-session') {
    await startAudio((text: string) => {
      if (settings.display.liveTranscription) appendTranscript(text)
      phoneTranscript += text + '\n'
      appendSessionTranscript(text)
      transcriptSinceLastCue += text + ' '
    })
    startCueDetector()
    renderSessionScreen()
  } else {
    rebuildHomeScreen()
    glassesView = 'home'
  }
}

async function onExit() {
  endMeetingConversation()
  await flushSession()
  stopStatusTimer()
  await stopAudio()
  stopHudUpdates()
  stopCueDetector()
}

// ── Start ─────────────────────────────────────────────────────────────────────

boot().catch(console.error)
