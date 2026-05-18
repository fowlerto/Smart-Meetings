# Product Design Document
## Smart Meeting — AI Meeting Assistant Plugin for Even G2 Smart Glasses

**Version:** 1.0  
**Author:** Product Management  
**Audience:** Senior Developer (Claude Code)  
**Platform:** Even Hub Plugin — Even Realities G2  
**Date:** May 2026

---

## 1. Overview & Problem Statement

### The Problem

Conversate (the first-party Even Realities app) and Conversate Plus (third-party variant) both provide real-time transcription and AI cues on the G2 glasses, but they have two critical deficiencies:

1. **Inferior AI:** They use models that are not Claude. The quality of cues, summaries, and contextual intelligence is noticeably weaker.
2. **Unreliable operation:** As documented in testing, the Conversate Plus plugin fails to function reliably — specifically, the local storage unavailability issue breaks session persistence.

### The Solution

**Smart Meeting** is a new Even Hub plugin built from scratch that:

- Uses **Claude** (via the Anthropic API) as the sole AI engine
- Uses **Deepgram** for speech-to-text (no native STT in the Even SDK)
- Runs reliably inside the Even WebView, handling storage and lifecycle correctly
- Provides a richer, more configurable meeting intelligence experience than either existing app
- Renders a carefully designed glasses UI that respects the 576×288 greyscale canvas

---

## 2. Core Feature Set

| # | Feature | Description |
|---|---|---|
| F1 | Live Transcription | Deepgram streaming STT → scrolling text on glasses display |
| F2 | AI Cues | Claude-powered contextual suggestions triggered automatically or manually |
| F3 | Context Documents | Upload documents; Claude uses them + live web search for cue generation |
| F4 | Ask Claude | Ad-hoc question input on phone → response on phone + glasses |
| F5 | Session Management | Save, search, and browse past sessions |
| F6 | Share / Export | iOS share sheet with preset prompt for drop-in AI summarization |
| F7 | Glasses Navigation | Full navigation via G2 touchpad, R1 ring, or phone app |
| F8 | Glasses HUD | Time (top-right), active context file/folder (top bar), transcript scroll, cue pop-up |
| F9 | Settings | API keys, models, cue behavior, folders, privacy, display preferences |

---

## 3. Technical Architecture

### 3.1 Stack

```
Phone WebView (Vite + TypeScript + Even Hub SDK)
    ↓ Bluetooth
Even G2 Glasses (display + touchpad input)
    ↕ R1 Ring (optional additional input)

External APIs (called from WebView):
    ├── Anthropic API  — Claude Sonnet 4.6 (cues, ask, summary)
    ├── Anthropic API  — Claude Haiku 4.5 (low-latency cue detection)
    └── Deepgram API   — Nova-3 streaming STT
```

### 3.2 app.json Manifest

```json
{
  "package_id": "com.smartmeeting.g2assistant",
  "edition": "202601",
  "name": "Smart Meeting",
  "version": "1.0.0",
  "min_app_version": "2.0.0",
  "min_sdk_version": "0.0.10",
  "entrypoint": "index.html",
  "permissions": [
    {
      "name": "network",
      "desc": "Connects to Anthropic API for AI cues and summaries, and Deepgram API for speech transcription.",
      "whitelist": [
        "https://api.anthropic.com",
        "https://api.deepgram.com"
      ]
    },
    {
      "name": "g2-microphone",
      "desc": "Captures audio from the G2 glasses microphone array for real-time transcription."
    },
    {
      "name": "phone-microphone",
      "desc": "Fallback microphone capture from the phone when glasses are not worn."
    }
  ],
  "supported_languages": ["en"]
}
```

> **Note:** The network whitelist only allows Anthropic and Deepgram. Both servers must return correct CORS headers (`Access-Control-Allow-Origin: *`). Deepgram streaming uses WebSocket, not HTTP fetch — confirm WS origin rules apply separately.

### 3.3 Storage Strategy

The Conversate Plus app fails with `localStorage unavailable`. Smart Meeting must handle this gracefully:

1. **Primary:** `bridge.setLocalStorage()` / `bridge.getLocalStorage()` — the Even SDK's scoped key-value store. This is the correct API for persistent data inside the Even WebView.
2. **Runtime state:** In-memory JS objects for the active session (transcript buffer, cue queue, current context doc).
3. **Never use** `window.localStorage` or `window.sessionStorage` directly inside the Even WebView.
4. On startup, read all persisted settings and session index from SDK local storage. If that fails, show a non-blocking warning and continue in ephemeral mode (don't crash).

### 3.4 Lifecycle Handling

```typescript
// Required lifecycle wiring — do not omit
bridge.onEvenHubEvent(event => {
  switch(event.sysEvent?.eventType) {
    case OsEventTypeList.FOREGROUND_EXIT_EVENT:    // 5
      flushTranscriptBuffer()
      pauseDeepgramStream()
      saveSessionState()
      break
    case OsEventTypeList.FOREGROUND_ENTER_EVENT:   // 4
      resumeDeepgramStream()
      refreshGlassesDisplay()
      break
    case OsEventTypeList.ABNORMAL_EXIT_EVENT:       // 6
      saveSessionState()
      cleanupAudioResources()
      break
    case OsEventTypeList.SYSTEM_EXIT_EVENT:         // 7
      saveSessionState()
      cleanupAudioResources()
      break
  }
})
```

**Root-page exit rule:** Double-tap on the root page MUST call `bridge.shutDownPageContainer(1)` (confirmation dialog). `shutDownPageContainer(0)` is not permitted on the root page per QA guidelines.

---

## 4. Glasses Display Design

### 4.1 Canvas Constraints

- **576 × 288 px**, 4-bit greyscale (16 shades of green)
- No CSS, no DOM, no background fill
- Max 4 image containers + 8 other containers per page
- Exactly one container with `isEventCapture: 1`
- Unicode block characters for visual structure

### 4.2 Display Layout — Active Session (Primary View)

```
┌────────────────────────────────────────────────────────────────────┐  y=0
│ [Context: Reynolds Co.]                             12:34 PM        │  h=20
├────────────────────────────────────────────────────────────────────┤  y=20
│                                                                    │
│  Live transcript scrolls here...                                   │  h=200
│  ...and the speaker says something interesting                     │
│  about the Q3 revenue figures.                                     │
│                                                                    │
├────────────────────────────────────────────────────────────────────┤  y=220
│ ▲ cue  ▼ nav  ● ask  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │  h=24
├────────────────────────────────────────────────────────────────────┤  y=244
│ [REC ●]  Session: 00:04:32                   Cues: 3               │  h=44
└────────────────────────────────────────────────────────────────────┘  y=288
```

**Container Map:**

| ID | Name | x | y | w | h | Type | Notes |
|---|---|---|---|---|---|---|---|
| 1 | `hud-bar` | 0 | 0 | 576 | 20 | Text | Context filename + time. No event capture. |
| 2 | `transcript` | 0 | 20 | 576 | 200 | Text | `isEventCapture: 1`. Scrolling transcript. |
| 3 | `nav-hint` | 0 | 220 | 576 | 24 | Text | Input hint row. No event capture. |
| 4 | `status-bar` | 0 | 244 | 576 | 44 | Text | REC indicator, timer, cue count. |

**Cue Overlay (replaces transcript temporarily):**

When a cue fires, `rebuildPageContainer` swaps in a cue-focused layout:

| ID | Name | x | y | w | h | Notes |
|---|---|---|---|---|---|---|
| 1 | `hud-bar` | 0 | 0 | 576 | 20 | Same HUD |
| 2 | `cue-content` | 0 | 20 | 576 | 220 | `isEventCapture: 1`. Cue text. Border visible. |
| 3 | `cue-nav` | 0 | 240 | 576 | 24 | `▲ prev  ▼ next  ● dismiss  ○○●○ (page)` |
| 4 | `cue-label` | 0 | 264 | 576 | 24 | `CUE 3 OF 5 — probe` |

**HUD Bar format string:**
```
[{contextName:16}]                    {HH:MM}
```
Use `\u00A0` (non-breaking space) padding to right-align the time. Context name truncated to 16 chars with ellipsis.

### 4.3 Display Layout — Home Screen (No Active Session)

```
┌─────────────────────────────────────────┐
│ Smart Meeting               12:34 PM    │  h=24
├─────────────────────────────────────────┤
│                                         │
│  > Start new session                    │
│    Browse sessions                      │
│    Context docs                         │
│    Ask Claude                           │
│    Settings                             │
│                                         │
├─────────────────────────────────────────┤
│ ▲▼ navigate  ● select  ○○ hold=exit    │
└─────────────────────────────────────────┘
```

Container map: 1 header text (HUD) + 1 full menu list container (`isEventCapture: 1`). List containers support native scroll highlighting.

### 4.4 Transcript Scrolling

The G2 firmware handles internal scrolling on a text container with `isEventCapture: 1` when content overflows. Use `textContainerUpgrade` to append new transcript lines without rebuilding the page. Paginate at ~450 characters; on overflow, rebuild with the last N lines only (maintain a rolling buffer of the last 800 chars of transcript).

```typescript
// Transcript update pattern
const MAX_DISPLAY_CHARS = 800
let transcriptBuffer = ''

function appendTranscript(newText: string) {
  transcriptBuffer += newText + '\n'
  if (transcriptBuffer.length > MAX_DISPLAY_CHARS) {
    transcriptBuffer = transcriptBuffer.slice(-MAX_DISPLAY_CHARS)
  }
  bridge.textContainerUpgrade(2, 'transcript', transcriptBuffer, 0, transcriptBuffer.length)
}
```

### 4.5 Time Display

Update the HUD bar every 30 seconds using `textContainerUpgrade` on container 1. Do not poll faster — avoid unnecessary BLE traffic.

---

## 5. Input & Navigation

### 5.1 Input Sources

Both G2 touchpad and R1 ring emit the same event types. The app should treat them identically unless explicitly differentiated (the SDK provides `eventSource`).

### 5.2 Input Map — Active Session View

| Gesture | Action |
|---|---|
| Single tap | Request manual cue |
| Double tap | Toggle transcript scroll on/off |
| Swipe up | Scroll transcript up (firmware handles if isEventCapture) |
| Swipe down | Scroll transcript down |
| Hold (2s single tap) | Exit confirmation (`shutDownPageContainer(1)`) |

> **Note:** "Hold" isn't a native SDK event. Implement by tracking time between `CLICK_EVENT` and starting a countdown in the app.

### 5.3 Input Map — Cue Overlay View

| Gesture | Action |
|---|---|
| Swipe up | Previous cue |
| Swipe down | Next cue |
| Single tap | Dismiss cue overlay → return to transcript |
| Double tap | Save/star this cue |

### 5.4 Input Map — Home Menu

| Gesture | Action |
|---|---|
| Swipe up | Move selection up |
| Swipe down | Move selection down |
| Single tap | Select highlighted item |
| Double tap | Back / exit |

### 5.5 Phone App Navigation

The phone WebView UI has a persistent bottom navigation bar with the same sections. Phone-side interactions update glasses display via the bridge synchronously where needed.

---

## 6. AI Cue System

### 6.1 Cue Triggers

Cues are generated by two mechanisms:

**Automatic (Claude Haiku — low latency):**
- Every N seconds (configurable, default 18s), the last ~800 chars of transcript are sent to Haiku with a prompt asking: "Does this transcript contain a question, an unclear claim, or a topic where the context document is relevant? Respond YES or NO only."
- If YES → escalate to Sonnet for full cue generation
- Also triggers when Haiku detects a question mark pattern or interrogative phrasing in the real-time stream

**Manual:**
- User taps the G2 touchpad or R1 ring single-press during a session
- User taps "Request Cue" button in phone app

### 6.2 Cue Types

Match the types visible in Conversate Plus cues settings:

| Type | Description |
|---|---|
| `probe` | A follow-up question to ask the other party |
| `concept` | A background explanation of a term or concept mentioned |
| `bio` | Background info on a person mentioned |
| `answer` | A direct answer to a question asked in the meeting |
| `reference` | A relevant fact, statistic, or source |

Each cue type is toggleable in settings (all enabled by default).

### 6.3 Context Documents

Users can upload documents (PDF, TXT, MD) or paste text into the phone app as context for a session. Multiple documents can be stored and assigned to sessions or folders.

**Size Limits:**
- **Per document:** 5 MB maximum. Enforce at upload time — reject with a clear error message before any processing begins.
- **Per folder:** 10 MB total across all documents assigned to that folder. When a document is added to a folder, validate the running total. If adding it would exceed 10 MB, block the assignment and prompt the user to remove another document first or create a separate folder.
- Display current usage (e.g., `3.2 MB / 10 MB`) in the folder detail view and on the document assignment screen.

When generating a cue:
1. Check if any context document has relevant content (keyword match or semantic similarity via Claude).
2. If yes → include the relevant passage in the Claude prompt.
3. If no → prompt Claude to use its training knowledge and note that a web search would be ideal (see §6.4).

**Storage:** Context documents are stored as text in SDK local storage, keyed by document ID. Each document is chunked into 2,000-char segments stored separately. A 5 MB plain-text document is approximately 5,000,000 characters; after chunking that is ~2,500 keys. Test SDK storage capacity at this scale before finalizing (see Open Questions §15).

### 6.4 Web Search Enhancement

When context documents don't cover the topic:
- Prompt Claude with the `web_search` tool enabled (Anthropic API supports this)
- Claude autonomously searches and incorporates results into the cue
- The cue on glasses should show a small `[web]` prefix if web search was used

```typescript
// Cue generation API call
const response = await fetch('https://api.anthropic.com/v1/messages', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1000,
    system: buildCueSystemPrompt(contextDoc, cueTypes),
    messages: [{ role: 'user', content: transcriptSnippet }],
    tools: [{ type: 'web_search_20250305', name: 'web_search' }]
  })
})
```

### 6.5 Cue Display on Glasses

- Cue appears as an overlay (see §4.2 Cue Overlay layout)
- If `auto pop-up` is enabled (default on), cue overlays appear automatically when generated
- If disabled, a `[CUE READY]` indicator appears in the status bar; user taps to view
- Cue hold time: configurable (default 10s), then auto-dismisses back to transcript view
- Max 20 cues stored per session (oldest dropped)

---

## 7. Ask Claude Feature

Users can ask Claude any question at any time, from either the phone app or the glasses.

### 7.1 From Phone App

- Persistent "Ask" FAB button in the phone UI
- Opens a text input modal
- Response displayed in a full-screen card on phone
- Simultaneously displayed on glasses as a cue overlay (cue type: `answer`)

### 7.2 From Glasses

- Map to a menu item in the home screen: "Ask Claude"
- On selection → show a prompt on glasses: `Ask Claude: speak your question`
- Trigger microphone capture for 10 seconds
- Transcribe the captured audio via Deepgram
- Send transcription to Claude Sonnet
- Display response on glasses cue overlay + phone

---

## 8. Phone App UI Design

### 8.1 Navigation Structure

```
Bottom Nav:
  [●] Session (home)  |  [≡] Sessions  |  [doc] Context  |  [?] Ask  |  [⚙] Settings
```

### 8.2 Session Screen (Active)

- Live transcript feed (scrolling text view, full screen)
- Floating controls: `[● STOP]` `[✦ CUE]` `[? ASK]`
- Cue drawer: slides up from bottom when cue received
- Session timer + REC indicator in top bar

### 8.3 Session Screen (Idle)

Matches the visual reference from Conversate (Image 5 in brief):
- Session list with search
- Folder filter chips
- `Start recording` primary CTA button
- Warning banner if SDK storage unavailable (non-blocking)

### 8.4 Sessions Browser

- Searchable list of past sessions
- Each session row: title (auto-generated from transcript first line), date/time, location, duration
- Tap to open → full transcript + cue list + share button
- Long press → delete, rename, move to folder

### 8.5 Context Documents Screen

- List of saved context documents
- `+ Add document` button → paste text, or use iOS document picker for PDF/TXT
- Each document row: name, file size, date added
- **Size enforcement:** Documents larger than 5 MB are rejected at import with a clear inline error. The add flow shows the limit: `"Max 5 MB per document."`
- Long press → delete, rename
- Folder assignment: documents can be tagged to folders; when a folder is active, all its docs are loaded as context
- **Folder detail view** shows running usage: `3.2 MB / 10 MB ━━━━━━─────` with a progress bar. When a folder approaches 9 MB, show a yellow warning. At 10 MB, block further additions.

### 8.6 Ask Claude Screen

- Simple chat-like interface
- Input: text field + voice button
- Response: formatted text card
- If a session is active, conversation is appended to the session record
- History within the session, not persistent across sessions

### 8.7 Settings Screens

Mirror the settings tabs visible in the reference screenshots, adapted for Smart Meeting:

**Keys tab:**
```
DEEPGRAM API KEY    [••••••••••••••••••••]
ANTHROPIC API KEY   [••••••••••••••••••••]
Note: "Keys stored on device only via Even SDK storage. Audio and text go directly to Deepgram and Anthropic — no third-party servers in between."
```

**Models tab:**
```
SUMMARY MODEL         [Claude Sonnet 4.6  ▾]
CUE MODEL (LOW-LATENCY) [Claude Haiku 4.5 ▾]
```

**Cues tab:**
```
FREQUENCY: EVERY [18]S    ━━●─────────────
HOLD: [10]S               ━━━━━━━●────────
CONFIDENCE THRESHOLD      [low] [●medium] [high]
AUTO POP-UP               [toggle: ON]
ENABLED CUE TYPES
  [✓] probe
  [✓] concept
  [✓] bio
  [✓] answer
  [✓] reference
```

**Display tab:**
```
LIVE TRANSCRIPTION ON GLASSES  [toggle: ON]
AI CUES ON GLASSES             [toggle: ON]
TIME IN HUD                    [toggle: ON]
CONTEXT NAME IN HUD            [toggle: ON]
TRANSCRIPT SCROLL DIRECTION    [auto] [●up] [down]
```

**Folders tab:**
```
NEW FOLDER [Folder name ________] [Add]
(list of existing folders)
```

**Prompts tab:**
```
GLOBAL SYSTEM PROMPT   [(none) ▾]
SHARE EXPORT PROMPT    [editable text area]
"Open a context doc to fork it as a session or folder prompt."
```

**Privacy tab:**
```
[✓] Speaker diarization
    Tag each line with speaker number; tap to label.
[✓] Auto-tag wearer's voice
    Detects which speaker is you using near-field audio energy.
[✓] Extract action items in summary

SUMMARY DETAIL   [brief] [●standard] [detailed]
LANGUAGE         [Auto-detect ▾]
```

---

## 9. Share & Export

### 9.1 Share Sheet Trigger

Available from:
- Session detail screen (share icon)
- Post-session summary screen (auto-shown when recording stops)

### 9.2 Export Content

The share payload is a single text block:

```
--- SMART MEETING SESSION EXPORT ---
Date: {date}
Duration: {duration}
Context: {contextDocName or "none"}

--- TRANSCRIPT ---
{full transcript}

--- AI CUES ---
[{timestamp}] {cueType}: {cueText}
[{timestamp}] {cueType}: {cueText}
...

--- ACTION ITEMS ---
{extracted action items if enabled}

--- AI PROMPT ---
Please summarize this meeting transcript and cue log. Identify:
1. Key decisions made
2. Action items with owners (if mentioned)
3. Open questions that were not resolved
4. The most important 3 takeaways

Format the output as a structured brief suitable for sharing with attendees.
```

The "AI PROMPT" section at the bottom is the preset prompt so the user can paste the entire block into Claude.ai or another AI app and get an instant summary.

### 9.3 Share Prompt Settings

The share prompt is editable in Settings → Prompts → "Share Export Prompt". The default template is pre-filled as shown above.

---

## 10. Deepgram Integration

### 10.1 Connection Pattern

```typescript
// Deepgram streaming WebSocket
const ws = new WebSocket(
  `wss://api.deepgram.com/v1/listen?model=nova-3&smart_format=true&diarize=true&punctuate=true`,
  ['token', deepgramApiKey]
)

ws.onmessage = (event) => {
  const data = JSON.parse(event.data)
  if (data.is_final) {
    const transcript = data.channel.alternatives[0].transcript
    appendTranscript(transcript)
    feedToHaikuDetector(transcript)
  }
}
```

### 10.2 Audio Source

Use `bridge.audioControl(true)` to start the G2 mic array. Audio arrives as PCM 16kHz signed 16-bit LE mono via `audioEvent`. Forward raw PCM bytes directly to the Deepgram WebSocket.

```typescript
bridge.onEvenHubEvent(event => {
  if (event.audioEvent?.pcmData && wsIsOpen) {
    ws.send(event.audioEvent.pcmData)
  }
})
```

### 10.3 Diarization

Deepgram returns `speaker` index per word when `diarize=true`. Use this to prefix transcript lines with `[S1]`, `[S2]`, etc. The privacy settings allow toggling diarization off.

---

## 11. Error Handling & Edge Cases

| Scenario | Behavior |
|---|---|
| Deepgram API key missing | Block session start, show inline error on phone and glasses: `"Deepgram key required. Open Settings → Keys."` |
| Anthropic API key missing | Allow transcription, disable cues. Phone shows banner. Glasses show `[AI cues off — no API key]` in status bar. |
| Deepgram WebSocket drops | Auto-reconnect with 2s backoff, max 3 attempts. Show `[reconnecting…]` in glasses status bar. |
| Anthropic API error (rate limit / 5xx) | Log cue failure, show `[Cue failed]` briefly in glasses status, continue silently. Do not crash. |
| SDK local storage unavailable | Show non-blocking warning (orange banner, matches Conversate Plus UX pattern). Run in ephemeral mode. |
| App backgrounded mid-session | Pause mic and WebSocket. Resume on foreground. Do not lose transcript buffer. |
| Glasses disconnect (ABNORMAL_EXIT) | Flush and save session. Show reconnection UI on phone. |
| Cue text > glasses display capacity | Paginate cue text. Add `▼ more` hint. Swipe down advances to next page of cue. |
| Context doc > 5 MB | Reject at upload/import with message: `"Document exceeds the 5 MB limit. Please use a smaller file or paste a shorter excerpt."` No partial ingestion. |
| Folder total > 10 MB | Block document assignment with message: `"This folder has reached its 10 MB limit. Remove a document or create a new folder."` Show current usage. |
| Context doc too large for SDK storage | Chunk into 2,000-char segments stored under `ctx:{docId}:{chunkIndex}` keys. With the 5 MB cap (~5M chars) this means up to ~2,500 chunks per document — validate SDK storage capacity in testing. |

---

## 12. Data Model (SDK Local Storage Keys)

```
settings:keys             → { deepgramKey, anthropicKey }
settings:models           → { summaryModel, cueModel }
settings:cues             → { frequency, hold, threshold, autoPopup, enabledTypes[] }
settings:display          → { liveTranscription, cuesOnGlasses, timeInHud, contextInHud }
settings:privacy          → { diarization, autoTagWearer, extractActionItems, summaryDetail, language }
settings:prompts          → { globalPrompt, sharePrompt }

sessions:index            → [{ id, title, date, duration, folderId }]
sessions:{id}             → { transcript, cues[], actionItems, contextDocId }

folders:index             → [{ id, name, contextDocId }]
folders:{id}              → { name, contextDocId, promptOverride, totalSizeBytes }
                             // totalSizeBytes enforced ≤ 10,485,760 (10 MB)

ctx:index                 → [{ id, name, folderId, chunkCount, sizeBytes }]
                             // sizeBytes enforced ≤ 5,242,880 (5 MB) per document
ctx:{id}:{chunkIndex}     → string (plain text chunk, max 2,000 chars each)
```

---

## 13. Claude Code Integration Notes

This document is structured for use with the `everything-evenhub` Claude Code plugin. Recommended skill invocation sequence:

1. `/quickstart smart-meeting` — scaffold project
2. `/glasses-ui "active session layout with HUD, transcript, nav bar, status bar"` — build glasses containers
3. `/handle-input "tap = manual cue, double tap = toggle transcript, swipe = scroll, hold = exit"` — wire input
4. `/device-features "start G2 mic, stream PCM to Deepgram WebSocket, handle audioEvent"` — audio pipeline
5. `/background-state src/main.ts` — lifecycle and session persistence
6. `/test-with-simulator "verify HUD bar, transcript scroll, cue overlay transitions"` — QA
7. `/build-and-deploy` — package and publish

---

## 14. QA Checklist (Pre-Submission)

Based on Even Hub App Submission & QA Guidelines:

- [ ] `package_id` is `com.smartmeeting.g2assistant` (no hyphens, valid reverse domain)
- [ ] `edition` is `"202601"`
- [ ] `name` is `"Smart Meeting"` (≤20 chars, does not contain "Even")
- [ ] `version` is `"1.0.0"` (three-part semver)
- [ ] Both `min_app_version` and `min_sdk_version` present
- [ ] All whitelist domains actually used in code
- [ ] No `localStorage` / `sessionStorage` calls — all storage via `bridge.setLocalStorage`
- [ ] Root page double-tap calls `shutDownPageContainer(1)` not `(0)`
- [ ] After exit, Conversate launches cleanly (test this explicitly)
- [ ] App stays alive and responsive with phone locked for 5+ minutes
- [ ] First launch with no API keys shows helpful message on glasses (not black screen)
- [ ] First launch after keys set up remembers keys (doesn't re-prompt)
- [ ] CORS headers verified for both `api.anthropic.com` and `api.deepgram.com`
- [ ] Lifecycle events wired: FOREGROUND_EXIT (5), FOREGROUND_ENTER (4), ABNORMAL_EXIT (6), SYSTEM_EXIT (7)
- [ ] Icon is greyscale, legible at small size
- [ ] Screenshots match actual rendered output
- [ ] Privacy policy covers: g2-microphone, phone-microphone, network (Deepgram, Anthropic)
- [ ] `evenhub pack app.json dist -o smartmeeting.ehpk -c` passes with no validation errors

---

## 15. Open Questions for Developer

1. **Deepgram WebSocket + CORS:** The Even WebView enforces standard browser CORS even for WebSocket upgrades. Confirm Deepgram's `wss://api.deepgram.com` returns the correct `Access-Control-Allow-Origin` header on the WS upgrade response from within the Even WebView origin. If not, a lightweight proxy may be needed.

2. **Audio event timing:** The G2 mic array delivers PCM via `audioEvent` callbacks. Confirm the data structure of `event.audioEvent.pcmData` in SDK v0.0.10 — whether it's `ArrayBuffer`, `Uint8Array`, or base64. Deepgram's WebSocket expects binary frames.

3. **Context doc storage at 5 MB scale:** SDK local storage has undocumented size limits. A 5 MB plain-text document chunked at 2,000 chars produces ~2,500 keys. A full 10 MB folder could mean ~5,000 keys. Test this ceiling before committing to SDK-only storage. If limits are hit, consider a lightweight backend or compressing chunks before storage.

4. **Web search tool availability:** The Anthropic API `web_search_20250305` tool requires the account to have web search enabled. Verify the API key being used has this capability before relying on it for the cue pipeline. Fall back gracefully if not available.

5. **R1 ring event source discrimination:** The developer help doc states G2 and R1 events are distinguishable by `eventSource`. Verify the exact field name and values in SDK v0.0.10 to determine if we want different input mappings per device.

---

*End of Product Design Document — Smart Meeting v1.0*
