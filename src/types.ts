export type CueType = 'probe' | 'concept' | 'bio' | 'answer' | 'reference'

export interface Cue {
  id: string
  type: CueType
  text: string
  timestamp: number
  starred: boolean
  usedWebSearch: boolean
}

export interface Session {
  id: string
  title: string
  date: number
  duration: number
  contextDocId: string | null
  transcript: string
  cues: Cue[]
  actionItems: string[]
  summary?: string
}

export interface SessionIndex {
  id: string
  title: string
  date: number
  duration: number
}

export interface ContextDoc {
  id: string
  name: string
  chunkCount: number
  sizeBytes: number
}

export interface Settings {
  keys: {
    deepgramKey: string
    anthropicKey: string
  }
  models: {
    summaryModel: string
    cueModel: string
  }
  cues: {
    frequency: number
    hold: number
    threshold: 'low' | 'medium' | 'high'
    autoPopup: boolean
  }
  display: {
    liveTranscription: boolean
    cuesOnGlasses: boolean
    timeInHud: boolean
    contextInHud: boolean
  }
  summary: {
    extractActionItems: boolean
    summaryDetail: 'brief' | 'standard' | 'detailed'
  }
  prompts: {
    sharePrompt: string
  }
  audio: {
    usePhoneMic: boolean
  }
  activeDocId: string | null
}

export const DEFAULT_SETTINGS: Settings = {
  keys: { deepgramKey: '', anthropicKey: '' },
  models: {
    summaryModel: 'claude-sonnet-4-6',
    cueModel: 'claude-haiku-4-5-20251001',
  },
  cues: {
    frequency: 18,
    hold: 10,
    threshold: 'medium',
    autoPopup: true,
  },
  display: {
    liveTranscription: true,
    cuesOnGlasses: true,
    timeInHud: true,
    contextInHud: true,
  },
  summary: {
    extractActionItems: true,
    summaryDetail: 'standard',
  },
  prompts: {
    sharePrompt:
      'This export includes a meeting transcript and AI-generated cues. If an AI Cues section is present, incorporate relevant cues into your summary — wherever a cue influenced a point, mark it with * and add the cue type in square brackets, e.g. "The team discussed consensus algorithms* [concept]".\n\nPlease provide:\n1. A structured summary of the meeting\'s key topics, decisions, and outcomes\n2. Action items with owners (if mentioned)\n3. Any open questions not resolved\n4. The top 3–5 takeaways\n\nFormat as a clear brief suitable for sharing with meeting attendees.',
  },
  audio: {
    usePhoneMic: false,
  },
  activeDocId: null,
}

export type AppScreen = 'session' | 'sessions' | 'context' | 'ask' | 'settings'
export type GlassesView = 'home' | 'active-session' | 'cue-overlay'
