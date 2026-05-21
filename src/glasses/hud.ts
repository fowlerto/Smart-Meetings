import type { EvenAppBridge } from '@evenrealities/even_hub_sdk'
import { TextContainerUpgrade } from '@evenrealities/even_hub_sdk'
import { getTextWidth } from '@evenrealities/pretext'

let bridge: EvenAppBridge
let hudTimer: ReturnType<typeof setInterval> | null = null
let contextName = ''

let sessionActive = false
let sessionElapsed = 0
let sessionCues = 0

export function initHud(b: EvenAppBridge) {
  bridge = b
}

export function setHudContext(name: string) {
  contextName = name
}

export function setSessionInfo(elapsed: number, cues: number, active: boolean) {
  sessionElapsed = elapsed
  sessionCues = cues
  sessionActive = active
}

export function forceHudUpdate() {
  const content = formatHudContent()
  bridge.textContainerUpgrade(new TextContainerUpgrade({ containerID: 1, containerName: 'hud-bar', content, contentOffset: 0, contentLength: content.length }))
}

function formatHudContent(): string {
  const now = new Date()
  const hours = now.getHours()
  const minutes = now.getMinutes().toString().padStart(2, '0')
  const ampm = hours >= 12 ? 'PM' : 'AM'
  const h = (hours % 12 || 12).toString()
  const timeStr = `${h}:${minutes} ${ampm}`

  const rawName = contextName || 'SmartMtg'
  const ctxDisplay = rawName.slice(0, 10)
  const leftPart = `[${ctxDisplay}]`

  const usable = 576 - 2 * 4  // paddingLength=4 → 568px usable
  const spW = getTextWidth(' ')

  if (sessionActive) {
    const hh = Math.floor(sessionElapsed / 3600).toString().padStart(2, '0')
    const mm = Math.floor((sessionElapsed % 3600) / 60).toString().padStart(2, '0')
    const ss = (sessionElapsed % 60).toString().padStart(2, '0')
    const sessionInfo = `${hh}:${mm}:${ss}  Cues: ${sessionCues}`

    const leftW = getTextWidth(leftPart)
    const midW = getTextWidth(sessionInfo)
    const rightW = getTextWidth(timeStr)
    const totalGap = usable - leftW - midW - rightW
    const gap1 = Math.max(1, Math.floor(totalGap / 2 / spW))
    const gap2 = Math.max(1, Math.round((totalGap - gap1 * spW) / spW))

    return leftPart + ' '.repeat(gap1) + sessionInfo + ' '.repeat(gap2) + timeStr
  }

  const gapPx = usable - getTextWidth(leftPart) - getTextWidth(timeStr)
  const nbspCount = Math.max(1, Math.floor(gapPx / spW))

  return leftPart + ' '.repeat(nbspCount) + timeStr
}

export function startHudUpdates() {
  hudTimer = setInterval(() => {
    const content = formatHudContent()
    bridge.textContainerUpgrade(new TextContainerUpgrade({ containerID: 1, containerName: 'hud-bar', content, contentOffset: 0, contentLength: content.length }))
  }, 30_000)
}

export function stopHudUpdates() {
  if (hudTimer !== null) {
    clearInterval(hudTimer)
    hudTimer = null
  }
}

export function getHudContent(): string {
  return formatHudContent()
}
