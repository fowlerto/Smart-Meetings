import type { EvenAppBridge } from '@evenrealities/even_hub_sdk'
import { TextContainerProperty, RebuildPageContainer, TextContainerUpgrade } from '@evenrealities/even_hub_sdk'
import { getHudContent } from './hud.ts'

let bridge: EvenAppBridge
let sendTranscriptUpdates = true

export function initSessionScreen(b: EvenAppBridge) {
  bridge = b
}

export function setTranscriptUpdates(enabled: boolean) {
  sendTranscriptUpdates = enabled
}

const MAX_DISPLAY_CHARS = 800
let transcriptBuffer = ''
let cueCount = 0
let sessionStartTime = 0
let statusTimer: ReturnType<typeof setInterval> | null = null
let statusText = ''

export function resetSessionDisplay() {
  transcriptBuffer = ''
  cueCount = 0
  sessionStartTime = Date.now()
  statusText = buildStatusText()
}

export function appendTranscript(newText: string) {
  transcriptBuffer += newText + '\n'
  if (transcriptBuffer.length > MAX_DISPLAY_CHARS) {
    transcriptBuffer = transcriptBuffer.slice(-MAX_DISPLAY_CHARS)
  }
  if (sendTranscriptUpdates) {
    bridge.textContainerUpgrade(new TextContainerUpgrade({ containerID: 2, containerName: 'transcript', content: transcriptBuffer, contentOffset: 0, contentLength: transcriptBuffer.length }))
  }
}

export function incrementCueCount() {
  cueCount++
  updateStatusBar()
}

function buildStatusText(): string {
  const elapsed = Math.floor((Date.now() - sessionStartTime) / 1000)
  const h = Math.floor(elapsed / 3600).toString().padStart(2, '0')
  const m = Math.floor((elapsed % 3600) / 60).toString().padStart(2, '0')
  const s = (elapsed % 60).toString().padStart(2, '0')
  return `● REC  Session: ${h}:${m}:${s}   Cues: ${cueCount}`
}

function updateStatusBar() {
  statusText = buildStatusText()
  bridge.textContainerUpgrade(new TextContainerUpgrade({ containerID: 4, containerName: 'status-bar', content: statusText, contentOffset: 0, contentLength: statusText.length }))
}

export function startStatusTimer() {
  if (statusTimer !== null) clearInterval(statusTimer)
  statusTimer = setInterval(updateStatusBar, 1000)
}

export function stopStatusTimer() {
  if (statusTimer !== null) {
    clearInterval(statusTimer)
    statusTimer = null
  }
}

// Layout (288px total):
//   HUD:        y=0,   h=35  (1 line, p=4, b=0 → inner=27px)
//   Transcript: y=35,  h=172 (p=4, b=0 → inner=164px = 6 lines)
//   NavHint:    y=207, h=37  (1 line, p=4, b=1 → inner=27px)
//   StatusBar:  y=244, h=44  (1 line, p=4, b=1 → inner=34px)

export function renderSessionScreen(): void {
  const hud = new TextContainerProperty({
    xPosition: 0, yPosition: 0, width: 576, height: 35,
    borderWidth: 0, borderColor: 5, paddingLength: 4,
    containerID: 1, containerName: 'hud-bar',
    content: getHudContent(), isEventCapture: 0,
  })

  const transcript = new TextContainerProperty({
    xPosition: 0, yPosition: 35, width: 576, height: 172,
    borderWidth: 0, borderColor: 5, paddingLength: 8,
    containerID: 2, containerName: 'transcript',
    content: transcriptBuffer || 'Listening…', isEventCapture: 1,
  })

  const navHint = new TextContainerProperty({
    xPosition: 0, yPosition: 207, width: 576, height: 37,
    borderWidth: 1, borderColor: 3, paddingLength: 4,
    containerID: 3, containerName: 'nav-hint',
    content: '▲● cue  ▼ end  ○ ask', isEventCapture: 0,
  })

  const statusBar = new TextContainerProperty({
    xPosition: 0, yPosition: 244, width: 576, height: 44,
    borderWidth: 1, borderColor: 3, paddingLength: 4,
    containerID: 4, containerName: 'status-bar',
    content: buildStatusText(), isEventCapture: 0,
  })

  bridge.rebuildPageContainer(
    new RebuildPageContainer({ containerTotalNum: 4, textObject: [hud, transcript, navHint, statusBar] }),
  )
  startStatusTimer()
}

export function getTranscriptBuffer(): string {
  return transcriptBuffer
}

export function showReconnecting() {
  bridge.textContainerUpgrade(new TextContainerUpgrade({ containerID: 4, containerName: 'status-bar', content: '[reconnecting…]', contentOffset: 0, contentLength: 15 }))
}

export function showCueReady() {
  const content = buildStatusText() + '  [CUE READY]'
  bridge.textContainerUpgrade(new TextContainerUpgrade({ containerID: 4, containerName: 'status-bar', content, contentOffset: 0, contentLength: content.length }))
}
