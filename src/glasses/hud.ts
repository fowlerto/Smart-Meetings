import type { EvenAppBridge } from '@evenrealities/even_hub_sdk'
import { TextContainerUpgrade } from '@evenrealities/even_hub_sdk'
import { getTextWidth } from '@evenrealities/pretext'

let bridge: EvenAppBridge
let hudTimer: ReturnType<typeof setInterval> | null = null
let contextName = ''

export function initHud(b: EvenAppBridge) {
  bridge = b
}

export function setHudContext(name: string) {
  contextName = name
}

function formatHudContent(): string {
  const now = new Date()
  const hours = now.getHours()
  const minutes = now.getMinutes().toString().padStart(2, '0')
  const ampm = hours >= 12 ? 'PM' : 'AM'
  const h = (hours % 12 || 12).toString()
  const timeStr = `${h}:${minutes} ${ampm}`

  const ctxDisplay = contextName ? contextName.slice(0, 16) : 'Smart Meeting'
  const leftPart = `[${ctxDisplay}]`

  const usable = 576 - 2 * 4  // paddingLength=4 -> 568px usable
  const gapPx = usable - getTextWidth(leftPart) - getTextWidth(timeStr)
  const nbspW = getTextWidth(' ')
  const nbspCount = Math.max(1, Math.floor(gapPx / nbspW))

  return leftPart + ' '.repeat(nbspCount) + timeStr
}

export function startHudUpdates() {
  // Only update on the 30s tick so containers are guaranteed to exist before we attempt an in-place upgrade.
  hudTimer = setInterval(updateHud, 30_000)
}

export function stopHudUpdates() {
  if (hudTimer !== null) {
    clearInterval(hudTimer)
    hudTimer = null
  }
}

function updateHud() {
  const content = formatHudContent()
  bridge.textContainerUpgrade(new TextContainerUpgrade({ containerID: 1, containerName: 'hud-bar', content, contentOffset: 0, contentLength: content.length }))
}

export function getHudContent(): string {
  return formatHudContent()
}
