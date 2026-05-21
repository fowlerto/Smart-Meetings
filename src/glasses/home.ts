import type { EvenAppBridge } from '@evenrealities/even_hub_sdk'
import { TextContainerProperty, CreateStartUpPageContainer, RebuildPageContainer, TextContainerUpgrade } from '@evenrealities/even_hub_sdk'
import { getHudContent } from './hud.ts'

let bridge: EvenAppBridge

export function initHomeScreen(b: EvenAppBridge) {
  bridge = b
}

// Simplified: browse sessions, context docs, and settings are phone-only.
const MENU_ITEMS = [
  'Start new session',
]

let selectedIndex = 0

export function getSelectedIndex(): number {
  return selectedIndex
}

// Layout (288px total):
//   HUD:  y=0,  h=35  (1 line, p=4, b=0)
//   Menu: y=35, h=253 (p=8, b=0 — full remaining height)

function makeContainers(menuText: string) {
  const hud = new TextContainerProperty({
    xPosition: 0, yPosition: 0, width: 576, height: 35,
    borderWidth: 0, borderColor: 5, paddingLength: 4,
    containerID: 1, containerName: 'hud-bar',
    content: getHudContent(), isEventCapture: 0,
  })

  const menu = new TextContainerProperty({
    xPosition: 0, yPosition: 35, width: 576, height: 253,
    borderWidth: 0, borderColor: 5, paddingLength: 8,
    containerID: 2, containerName: 'home-menu',
    content: menuText, isEventCapture: 1,
  })

  return [hud, menu]
}

export async function renderHomeScreen(): Promise<void> {
  selectedIndex = 0
  const [hud, menu] = makeContainers(buildMenuText())
  await bridge.createStartUpPageContainer(
    new CreateStartUpPageContainer({ containerTotalNum: 2, textObject: [hud, menu] }),
  )
}

export async function rebuildHomeScreen(): Promise<void> {
  const [hud, menu] = makeContainers(buildMenuText())
  const ok = await bridge.rebuildPageContainer(new RebuildPageContainer({ containerTotalNum: 2, textObject: [hud, menu] }))
  console.log('[rebuildHomeScreen] result:', ok)
}

export function homeSelectUp(): boolean {
  if (selectedIndex > 0) {
    selectedIndex--
    updateMenuInPlace()
    return true
  }
  return false
}

export function homeSelectDown(): boolean {
  if (selectedIndex < MENU_ITEMS.length - 1) {
    selectedIndex++
    updateMenuInPlace()
    return true
  }
  return false
}

function updateMenuInPlace() {
  const content = buildMenuText()
  bridge.textContainerUpgrade(new TextContainerUpgrade({ containerID: 2, containerName: 'home-menu', content, contentOffset: 0, contentLength: content.length }))
}

function buildMenuText(): string {
  return MENU_ITEMS.map((item, i) => (i === selectedIndex ? '> ' : '  ') + item).join('\n')
}
