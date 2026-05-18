import type { EvenAppBridge } from '@evenrealities/even_hub_sdk'
import { TextContainerProperty, RebuildPageContainer } from '@evenrealities/even_hub_sdk'
import type { Cue } from '../types.ts'
import { getHudContent } from './hud.ts'

let bridge: EvenAppBridge

export function initCueOverlay(b: EvenAppBridge) {
  bridge = b
}

let cueQueue: Cue[] = []
let currentCueIndex = 0
let dismissTimer: ReturnType<typeof setTimeout> | null = null
let onDismiss: (() => void) | null = null

const MAX_CUE_TEXT = 750
const CHARS_PER_PAGE = 300

export function enqueueCue(cue: Cue) {
  if (cueQueue.length >= 20) cueQueue.shift()
  cueQueue.push(cue)
  currentCueIndex = cueQueue.length - 1
}

export function getCueQueue(): Cue[] {
  return cueQueue
}

export function clearCueQueue() {
  cueQueue = []
  currentCueIndex = 0
}

export function showCueOverlay(cue: Cue, holdSeconds: number, dismiss: () => void) {
  onDismiss = dismiss
  enqueueCue(cue)
  currentCueIndex = cueQueue.length - 1
  renderCueOverlay()
  scheduleDismiss(holdSeconds)
}

export function cueNavigatePrev(): boolean {
  if (currentCueIndex > 0) {
    currentCueIndex--
    renderCueOverlay()
    return true
  }
  return false
}

export function cueNavigateNext(): boolean {
  if (currentCueIndex < cueQueue.length - 1) {
    currentCueIndex++
    renderCueOverlay()
    return true
  }
  return false
}

export function dismissCueOverlay() {
  clearDismissTimer()
  if (onDismiss) onDismiss()
}

function scheduleDismiss(seconds: number) {
  clearDismissTimer()
  dismissTimer = setTimeout(dismissCueOverlay, seconds * 1000)
}

function clearDismissTimer() {
  if (dismissTimer !== null) {
    clearTimeout(dismissTimer)
    dismissTimer = null
  }
}

// Layout (288px total):
//   HUD:        y=0,   h=35  (1 line, p=4, b=0 → inner=27px)
//   CueContent: y=35,  h=181 (p=6, b=2 → inner=165px = 6 lines)
//   CueNav:     y=216, h=35  (1 line, p=4, b=0 → inner=27px)
//   CueLabel:   y=251, h=37  (1 line, p=4, b=1 → inner=27px)

function renderCueOverlay() {
  const cue = cueQueue[currentCueIndex]
  if (!cue) return

  const prefix = cue.usedWebSearch ? '[web] ' : ''
  const rawText = prefix + cue.text
  const displayText = rawText.length > MAX_CUE_TEXT ? rawText.slice(0, MAX_CUE_TEXT) + '…' : rawText
  const hasMore = rawText.length > CHARS_PER_PAGE

  const hud = new TextContainerProperty({
    xPosition: 0, yPosition: 0, width: 576, height: 35,
    borderWidth: 0, borderColor: 5, paddingLength: 4,
    containerID: 1, containerName: 'hud-bar',
    content: getHudContent(), isEventCapture: 0,
  })

  const cueContent = new TextContainerProperty({
    xPosition: 0, yPosition: 35, width: 576, height: 181,
    borderWidth: 2, borderColor: 8, paddingLength: 6,
    containerID: 2, containerName: 'cue-content',
    content: displayText + (hasMore ? '\n▼ more' : ''), isEventCapture: 1,
  })

  const navItems = [
    currentCueIndex > 0 ? '▲ prev' : '      ',
    currentCueIndex < cueQueue.length - 1 ? '▼ next' : '      ',
    '● dismiss',
  ]
  const cueNav = new TextContainerProperty({
    xPosition: 0, yPosition: 216, width: 576, height: 35,
    borderWidth: 0, borderColor: 5, paddingLength: 4,
    containerID: 3, containerName: 'cue-nav',
    content: navItems.join('  '), isEventCapture: 0,
  })

  const typeLabel = cue.type.toUpperCase()
  const cueLabel = new TextContainerProperty({
    xPosition: 0, yPosition: 251, width: 576, height: 37,
    borderWidth: 1, borderColor: 3, paddingLength: 4,
    containerID: 4, containerName: 'cue-label',
    content: `CUE ${currentCueIndex + 1} OF ${cueQueue.length} — ${typeLabel}`,
    isEventCapture: 0,
  })

  bridge.rebuildPageContainer(
    new RebuildPageContainer({ containerTotalNum: 4, textObject: [hud, cueContent, cueNav, cueLabel] }),
  )
}
