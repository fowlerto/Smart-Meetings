import type { EvenAppBridge } from '@evenrealities/even_hub_sdk'
import { TextContainerProperty, RebuildPageContainer, TextContainerUpgrade } from '@evenrealities/even_hub_sdk'
import { getHudContent, setSessionInfo, forceHudUpdate } from './hud.ts'

let bridge: EvenAppBridge
let sendTranscriptUpdates = true

export function initSessionScreen(b: EvenAppBridge) {
  bridge = b
}

export function setTranscriptUpdates(enabled: boolean) {
  sendTranscriptUpdates = enabled
}

const MAX_LINES = 3
let transcriptLines: string[] = []
let cueCount = 0
let sessionStartTime = 0
let statusTimer: ReturnType<typeof setInterval> | null = null

export function resetSessionDisplay() {
  transcriptLines = []
  cueCount = 0
  sessionStartTime = Date.now()
  setSessionInfo(0, 0, true)
}

export function appendTranscript(newText: string) {
  transcriptLines.push(newText)
  if (transcriptLines.length > MAX_LINES) transcriptLines.shift()
  if (!sendTranscriptUpdates) return
  const content = transcriptLines.join('\n')
  bridge.textContainerUpgrade(new TextContainerUpgrade({ containerID: 2, containerName: 'transcript', content, contentOffset: 0, contentLength: content.length }))
}

export function incrementCueCount() {
  cueCount++
  const elapsed = Math.floor((Date.now() - sessionStartTime) / 1000)
  setSessionInfo(elapsed, cueCount, true)
  forceHudUpdate()
}

export function startStatusTimer() {
  if (statusTimer !== null) clearInterval(statusTimer)
  statusTimer = setInterval(() => {
    const elapsed = Math.floor((Date.now() - sessionStartTime) / 1000)
    setSessionInfo(elapsed, cueCount, true)
    forceHudUpdate()
  }, 1000)
}

export function stopStatusTimer() {
  if (statusTimer !== null) {
    clearInterval(statusTimer)
    statusTimer = null
  }
  setSessionInfo(0, 0, false)
}

// Layout (288px total):
//   HUD:        y=0,  h=35  (1 line, p=4, b=0 — carries session timer + cues)
//   Transcript: y=35, h=253 (p=8, b=0 — full remaining height, 3-line rolling)

export function renderSessionScreen(): void {
  const hud = new TextContainerProperty({
    xPosition: 0, yPosition: 0, width: 576, height: 35,
    borderWidth: 0, borderColor: 5, paddingLength: 4,
    containerID: 1, containerName: 'hud-bar',
    content: getHudContent(), isEventCapture: 0,
  })

  const transcriptContent = transcriptLines.length > 0 ? transcriptLines.join('\n') : 'Listening…'
  const transcript = new TextContainerProperty({
    xPosition: 0, yPosition: 35, width: 576, height: 253,
    borderWidth: 0, borderColor: 5, paddingLength: 8,
    containerID: 2, containerName: 'transcript',
    content: transcriptContent, isEventCapture: 1,
  })

  bridge.rebuildPageContainer(
    new RebuildPageContainer({ containerTotalNum: 2, textObject: [hud, transcript] }),
  )
  startStatusTimer()
}

export function getTranscriptBuffer(): string {
  return transcriptLines.join('\n')
}

export function showReconnecting() {
  if (!sendTranscriptUpdates) return
  const content = '[reconnecting…]'
  bridge.textContainerUpgrade(new TextContainerUpgrade({ containerID: 2, containerName: 'transcript', content, contentOffset: 0, contentLength: content.length }))
}

// Phone shows cue drawer — no glasses-side notification needed without status bar
export function showCueReady() {}
