import type { Settings } from '../types.ts'

export function renderSettings(settings: Settings): void {
  setInput('dg-key', settings.keys.deepgramKey ? '••••••••••••••••••••' : '')
  setInput('anthropic-key', settings.keys.anthropicKey ? '••••••••••••••••••••' : '')

  setSelect('model-summary', settings.models.summaryModel)
  setSelect('model-cue', settings.models.cueModel)

  const isManual = settings.cues.frequency === 0
  setToggle('cue-manual-only', isManual)
  setRange('cue-freq', isManual ? 18 : settings.cues.frequency)
  const freqEl = document.getElementById('cue-freq') as HTMLInputElement | null
  if (freqEl) freqEl.disabled = isManual
  const freqLabelEl = document.getElementById('cue-freq-label')
  if (freqLabelEl && isManual) freqLabelEl.textContent = '—'
  setRange('cue-hold', settings.cues.hold)
  setRadio('cue-threshold', settings.cues.threshold)
  setToggle('cue-autopopup', settings.cues.autoPopup)

  setToggle('disp-transcript', settings.display.liveTranscription)
  setToggle('disp-cues', settings.display.cuesOnGlasses)
  setToggle('disp-time', settings.display.timeInHud)
  setToggle('disp-context', settings.display.contextInHud)

  setToggle('sum-actions', settings.summary.extractActionItems)
  setRadio('sum-detail', settings.summary.summaryDetail)

  setTextarea('share-prompt', settings.prompts.sharePrompt)
}

export function collectSettings(current: Settings): Settings {
  const dgKeyEl = document.getElementById('dg-key') as HTMLInputElement | null
  const anthropicKeyEl = document.getElementById('anthropic-key') as HTMLInputElement | null

  return {
    keys: {
      deepgramKey: isObfuscated(dgKeyEl?.value) ? current.keys.deepgramKey : (dgKeyEl?.value ?? ''),
      anthropicKey: isObfuscated(anthropicKeyEl?.value) ? current.keys.anthropicKey : (anthropicKeyEl?.value ?? ''),
    },
    models: {
      summaryModel: getSelectValue('model-summary') ?? current.models.summaryModel,
      cueModel: getSelectValue('model-cue') ?? current.models.cueModel,
    },
    cues: {
      frequency: (getToggleValue('cue-manual-only') ?? false)
        ? 0
        : (getRangeValue('cue-freq') ?? (current.cues.frequency || 18)),
      hold: getRangeValue('cue-hold') ?? current.cues.hold,
      threshold: (getRadioValue('cue-threshold') as Settings['cues']['threshold']) ?? current.cues.threshold,
      autoPopup: getToggleValue('cue-autopopup') ?? current.cues.autoPopup,
    },
    display: {
      liveTranscription: getToggleValue('disp-transcript') ?? current.display.liveTranscription,
      cuesOnGlasses: getToggleValue('disp-cues') ?? current.display.cuesOnGlasses,
      timeInHud: getToggleValue('disp-time') ?? current.display.timeInHud,
      contextInHud: getToggleValue('disp-context') ?? current.display.contextInHud,
    },
    summary: {
      extractActionItems: getToggleValue('sum-actions') ?? current.summary.extractActionItems,
      summaryDetail: (getRadioValue('sum-detail') as Settings['summary']['summaryDetail']) ?? current.summary.summaryDetail,
    },
    prompts: {
      sharePrompt: getTextareaValue('share-prompt') ?? current.prompts.sharePrompt,
    },
    activeDocId: current.activeDocId,
  }
}

function isObfuscated(val: string | undefined): boolean {
  return !!val && /^•+$/.test(val)
}

function setInput(id: string, value: string) {
  const el = document.getElementById(id) as HTMLInputElement | null
  if (el) el.value = value
}

function setSelect(id: string, value: string) {
  const el = document.getElementById(id) as HTMLSelectElement | null
  if (el) el.value = value
}

function setRange(id: string, value: number) {
  const el = document.getElementById(id) as HTMLInputElement | null
  if (el) {
    el.value = String(value)
    const label = document.getElementById(`${id}-label`)
    if (label) label.textContent = String(value)
  }
}

function setToggle(id: string, value: boolean) {
  const el = document.getElementById(id) as HTMLInputElement | null
  if (el) el.checked = value
}

function setRadio(name: string, value: string) {
  const el = document.querySelector(`input[name="${name}"][value="${value}"]`) as HTMLInputElement | null
  if (el) el.checked = true
}

function setTextarea(id: string, value: string) {
  const el = document.getElementById(id) as HTMLTextAreaElement | null
  if (el) el.value = value
}

function getSelectValue(id: string): string | null {
  return (document.getElementById(id) as HTMLSelectElement | null)?.value ?? null
}

function getRangeValue(id: string): number | null {
  const val = (document.getElementById(id) as HTMLInputElement | null)?.value
  return val !== undefined ? Number(val) : null
}

function getToggleValue(id: string): boolean | null {
  const el = document.getElementById(id) as HTMLInputElement | null
  return el ? el.checked : null
}

function getRadioValue(name: string): string | null {
  const el = document.querySelector(`input[name="${name}"]:checked`) as HTMLInputElement | null
  return el?.value ?? null
}

function getTextareaValue(id: string): string | null {
  return (document.getElementById(id) as HTMLTextAreaElement | null)?.value ?? null
}
