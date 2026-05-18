import type { CueType, Cue, Session, Settings } from '../types.ts'

export type CueResult = Omit<Cue, 'id' | 'timestamp' | 'starred'>

const SONNET = 'claude-sonnet-4-6'
const HAIKU = 'claude-haiku-4-5-20251001'
const ALL_CUE_TYPES: CueType[] = ['probe', 'concept', 'bio', 'answer', 'reference']

let anthropicKey = ''
let cueSettings: Settings['cues']
let models: Settings['models']
let summarySettings: Settings['summary']

interface Message { role: 'user' | 'assistant'; content: string }
type ApiContent = string | { type: 'text'; text: string; cache_control?: { type: 'ephemeral' } }[]
type ApiMessage = { role: 'user' | 'assistant'; content: ApiContent }

let conversationMessages: Message[] = []
let conversationSystem: string = ''
let conversationActive = false

export function configureAI(key: string, s: Settings) {
  anthropicKey = key
  cueSettings = s.cues
  models = s.models
  summarySettings = s.summary
}

export function startMeetingConversation(contextText: string) {
  conversationMessages = []
  conversationSystem = buildMeetingSystemPrompt(contextText)
  conversationActive = true
}

export function endMeetingConversation() {
  conversationMessages = []
  conversationSystem = ''
  conversationActive = false
}

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    'x-api-key': anthropicKey,
    'anthropic-version': '2023-06-01',
    'anthropic-beta': 'prompt-caching-2024-07-31',
    'anthropic-dangerous-direct-browser-access': 'true',
  }
}

function cachedSystem(text: string) {
  return [{ type: 'text', text, cache_control: { type: 'ephemeral' } }]
}

// Builds the messages array with cache_control on the last historical message so
// the conversation prefix is eligible for reuse on subsequent calls.
function buildApiMessages(newMsg: string): ApiMessage[] {
  const result: ApiMessage[] = []
  for (let i = 0; i < conversationMessages.length; i++) {
    const m = conversationMessages[i]
    if (i === conversationMessages.length - 1) {
      result.push({ role: m.role, content: [{ type: 'text', text: m.content, cache_control: { type: 'ephemeral' } }] })
    } else {
      result.push({ role: m.role, content: m.content })
    }
  }
  result.push({ role: 'user', content: newMsg })
  return result
}

const THRESHOLD_SYSTEM: Record<string, string> = {
  low: 'Respond YES if this meeting transcript mentions any topic, person, term, or question that could benefit from additional context. Respond NO only for pure small talk. Reply with one word.',
  medium: 'Respond YES if this meeting transcript contains a question being asked, an unclear or technical claim, a named person, or a notable topic worth an AI cue. Respond NO for filler conversation. Reply with one word.',
  high: 'Respond YES only if this meeting transcript contains a specific question that needs answering, a named individual being discussed, or a technical or factual claim that needs verification. Respond NO otherwise. Reply with one word.',
}

export async function shouldGenerateCue(transcript: string): Promise<boolean> {
  if (!anthropicKey) return false
  const threshold = cueSettings?.threshold ?? 'medium'
  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        model: models?.cueModel ?? HAIKU,
        max_tokens: 10,
        system: THRESHOLD_SYSTEM[threshold],
        messages: [{ role: 'user', content: transcript }],
      }),
    })
    const data = await resp.json()
    const text: string = data.content?.[0]?.text ?? ''
    return text.trim().toUpperCase().startsWith('YES')
  } catch {
    return false
  }
}

export async function generateCue(transcript: string): Promise<CueResult | null> {
  if (!anthropicKey) return null

  const userMsg = `New transcript segment:\n${transcript}\n\nGenerate ONE cue from the available types. Respond in this exact format:\nTYPE: <type>\nCUE: <cue text, max 200 chars>`

  try {
    const systemText = conversationActive ? conversationSystem : buildMeetingSystemPrompt('')
    const messages = buildApiMessages(userMsg)

    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        model: models?.summaryModel ?? SONNET,
        max_tokens: 300,
        system: cachedSystem(systemText),
        messages,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
      }),
    })
    const data = await resp.json()

    if (data.error) {
      console.error('Claude cue error:', data.error)
      return null
    }

    const usedWebSearch = (data.content ?? []).some(
      (b: { type: string }) => b.type === 'tool_use' && (b as { name?: string }).name === 'web_search',
    )

    const textBlock = (data.content ?? []).find((b: { type: string }) => b.type === 'text') as
      | { text: string }
      | undefined
    if (!textBlock) return null

    const parsed = parseCueResponse(textBlock.text)
    if (!parsed) return null

    if (conversationActive) {
      conversationMessages.push({ role: 'user', content: userMsg })
      conversationMessages.push({ role: 'assistant', content: textBlock.text })
    }

    return { ...parsed, usedWebSearch }
  } catch {
    return null
  }
}

export async function askClaude(question: string, transcriptContext: string): Promise<string> {
  if (!anthropicKey) return 'Anthropic API key not configured. Go to Settings → Keys.'

  const userContent = transcriptContext
    ? `Meeting context:\n${transcriptContext.slice(-600)}\n\nQuestion: ${question}`
    : question

  try {
    const systemText = conversationActive
      ? conversationSystem
      : 'You are a meeting assistant. Answer concisely (3–5 sentences max).'
    const messages = buildApiMessages(userContent)

    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        model: models?.summaryModel ?? SONNET,
        max_tokens: 400,
        system: cachedSystem(systemText),
        messages,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
      }),
    })
    const data = await resp.json()
    if (data.error) return `Error: ${data.error.message}`

    const textBlock = (data.content ?? []).find((b: { type: string }) => b.type === 'text') as
      | { text: string }
      | undefined
    const answer = textBlock?.text ?? 'No response.'

    if (conversationActive) {
      conversationMessages.push({ role: 'user', content: userContent })
      conversationMessages.push({ role: 'assistant', content: answer })
    }

    return answer
  } catch (err) {
    return `Request failed: ${String(err)}`
  }
}

export async function generateSummary(session: Session, model: string): Promise<string> {
  if (!anthropicKey) return 'Anthropic API key not configured.'

  const detail = summarySettings?.summaryDetail ?? 'standard'
  const extractActions = summarySettings?.extractActionItems ?? true

  const detailInstructions: Record<string, string> = {
    brief: 'Write a brief 3–5 sentence summary covering the key outcomes.',
    standard: 'Write a structured summary with key topics, decisions, and outcomes.',
    detailed: 'Write a comprehensive summary covering all major topics, decisions, outcomes, and context.',
  }

  const h = Math.floor(session.duration / 3600).toString().padStart(2, '0')
  const m = Math.floor((session.duration % 3600) / 60).toString().padStart(2, '0')
  const s = (session.duration % 60).toString().padStart(2, '0')

  const cueSection = session.cues.length > 0
    ? `\n\nAI cues generated during the meeting:\n${session.cues.map(c => `[${c.type}] ${c.text}`).join('\n')}`
    : ''

  const systemPrompt = [
    `You are a meeting summarizer. ${detailInstructions[detail]}`,
    extractActions ? 'Include a separate "Action Items" section listing tasks and owners (if mentioned).' : '',
    'When a summary point is informed by an AI cue, mark it with * and append the cue type in [brackets], e.g. "The team discussed RAFT consensus* [concept]".',
  ].filter(Boolean).join(' ')

  const userContent = `Meeting: ${session.title}\nDate: ${new Date(session.date).toLocaleString()}\nDuration: ${h}:${m}:${s}\n\nTranscript:\n${session.transcript}${cueSection}`
  const maxTokens = detail === 'detailed' ? 1500 : detail === 'standard' ? 800 : 400

  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: [{ role: 'user', content: userContent }],
      }),
    })
    const data = await resp.json()
    if (data.error) return `Error: ${data.error.message}`
    const textBlock = (data.content ?? []).find((b: { type: string }) => b.type === 'text') as { text: string } | undefined
    return textBlock?.text ?? 'No summary generated.'
  } catch (err) {
    return `Request failed: ${String(err)}`
  }
}

function buildMeetingSystemPrompt(contextText: string): string {
  const typeDescriptions: Record<CueType, string> = {
    probe: 'A follow-up question to ask the other party',
    concept: 'A background explanation of a term or concept mentioned',
    bio: 'Background info on a person mentioned',
    answer: 'A direct answer to a question asked in the meeting',
    reference: 'A relevant fact, statistic, or source',
  }

  const typeList = ALL_CUE_TYPES.map(t => `- ${t}: ${typeDescriptions[t]}`).join('\n')

  const contextSection = contextText
    ? `\n\nContext document for this meeting (reference when relevant):\n${contextText.slice(0, 10000)}`
    : ''

  return `You are a real-time AI meeting assistant running on smart glasses. You help the wearer by generating concise cues and answering questions during live meetings.

Available cue types:
${typeList}

When generating cues, be concise — text displays on small glasses lenses. When answering questions, keep responses to 3–5 sentences.${contextSection}`
}

function parseCueResponse(text: string): { type: CueType; text: string } | null {
  const typeMatch = text.match(/TYPE:\s*(\w+)/i)
  const cueMatch = text.match(/CUE:\s*(.+)/is)
  if (!typeMatch || !cueMatch) return null

  const type = typeMatch[1].toLowerCase() as CueType
  if (!ALL_CUE_TYPES.includes(type)) return null

  return { type, text: cueMatch[1].trim().slice(0, 250) }
}
