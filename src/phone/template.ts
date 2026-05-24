export function renderPhoneHTML(): void {
  const app = document.getElementById('app')!
  app.innerHTML = `
    <!-- Top bar -->
    <div class="top-bar">
      <span class="top-bar-title" id="top-title">Smart Meeting</span>
      <span class="rec-badge" id="rec-badge" style="display:none">● REC</span>
    </div>

    <!-- Screens -->
    <div id="screen-session" class="screen active">
      <div id="session-idle" class="session-idle">
        <div id="storage-warning" class="storage-warning" style="display:none">
          ⚠ SDK storage unavailable — running in ephemeral mode. Sessions will not be saved.
        </div>
        <p class="section-header">Recent Sessions</p>
        <div id="recent-sessions-list"></div>
        <button class="start-btn" id="start-btn">● Start recording</button>
      </div>

      <div id="session-active" class="session-active" style="display:none">
        <div class="session-controls">
          <button class="stop-btn" id="stop-btn">■ Stop</button>
          <span id="session-timer" style="font-size:13px;color:var(--text-dim)">00:00:00</span>
          <span id="cue-count" style="font-size:13px;color:var(--text-dim)">Cues: 0</span>
          <button class="cue-btn" id="manual-cue-btn">✦ Cue</button>
          <button class="ask-btn" id="session-ask-btn">? Ask</button>
        </div>
        <span id="context-name" style="display:block;padding:4px 16px;font-size:12px;color:var(--accent)"></span>
        <span id="deepgram-status" style="display:block;padding:0 16px 4px;font-size:11px;color:var(--text-dim)">Deepgram: connecting…</span>

        <div class="cue-banner" id="cue-drawer" style="display:none">
          <span class="cue-drawer-type" id="cue-drawer-type">CUE</span>
          <span class="cue-drawer-text" id="cue-drawer-text"></span>
        </div>

        <div id="phone-transcript" class="transcript-feed">Listening…</div>
      </div>
    </div>

    <div id="screen-sessions" class="screen">
      <div class="sessions-screen">
        <input class="search-input" id="sessions-search" type="search" placeholder="Search sessions…" />
        <div id="sessions-list"></div>

        <div id="session-detail" style="display:none">
          <div class="session-detail-header">
            <button class="share-btn" id="back-to-list">← Back</button>
            <h2 class="detail-title" id="session-detail-title"></h2>
          </div>

          <div style="padding:8px 16px">
            <button class="cue-btn" id="generate-summary-btn" style="width:100%">✦ Generate Summary</button>
          </div>

          <div id="session-summary-section" style="display:none">
            <p class="detail-section-title">Summary</p>
            <div id="session-detail-summary" class="transcript-text"></div>
          </div>

          <p class="detail-section-title">Transcript</p>
          <div id="session-detail-transcript" class="transcript-text"></div>
          <p class="detail-section-title">AI Cues</p>
          <div id="session-detail-cues"></div>

          <div style="padding:12px 16px;border-top:1px solid var(--border);margin-top:8px">
            <p class="detail-section-title" style="margin-bottom:8px">Export / Share</p>
            <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:12px;font-size:13px">
              <label style="display:flex;align-items:center;gap:8px">
                <input type="checkbox" id="share-transcript" checked /> Transcript
              </label>
              <label style="display:flex;align-items:center;gap:8px">
                <input type="checkbox" id="share-summary" disabled />
                Summary <span id="share-summary-note" style="color:var(--text-dim);font-size:11px">(generate first)</span>
              </label>
              <label style="display:flex;align-items:center;gap:8px">
                <input type="checkbox" id="share-cues" checked /> AI Cues
              </label>
              <label style="display:flex;align-items:center;gap:8px">
                <input type="checkbox" id="share-ai-prompt" checked /> AI Prompt
              </label>
            </div>
            <button class="share-btn" id="share-btn">Share / Copy</button>
          </div>
        </div>
      </div>
    </div>

    <div id="screen-context" class="screen">
      <div class="context-screen">
        <p style="font-size:12px;color:var(--text-dim);margin-bottom:8px">Select one document to use as context for AI cues during your next session. Up to 5 documents, 5 MB each.</p>
        <button class="add-doc-btn" id="add-doc-btn">+ Add document</button>
        <div id="context-docs-list" style="margin-top:12px"></div>
      </div>
    </div>

    <div id="screen-ask" class="screen">
      <div class="ask-screen">
        <div class="ask-response" id="ask-response">Ask Claude anything about your meeting…</div>
        <div class="ask-input-row">
          <input class="ask-input" id="ask-input" type="text" placeholder="Your question…" />
          <button class="ask-send-btn" id="ask-send-btn">Send</button>
        </div>
      </div>
    </div>

    <div id="screen-settings" class="screen">
      <div class="settings-screen">
        <div class="settings-tabs">
          <button class="settings-tab active" data-panel="keys">Keys</button>
          <button class="settings-tab" data-panel="models">Models</button>
          <button class="settings-tab" data-panel="cues">Cues</button>
          <button class="settings-tab" data-panel="display">Display</button>
          <button class="settings-tab" data-panel="prompts">Prompts</button>
          <button class="settings-tab" data-panel="summary">Summary</button>
          <button class="settings-tab" data-panel="help">Help</button>
        </div>

        <!-- Keys -->
        <div class="settings-panel active" id="panel-keys">
          <div class="settings-row">
            <div><div class="settings-label">DEEPGRAM API KEY</div></div>
            <input class="key-input" id="dg-key" type="password" placeholder="dg-…" />
          </div>
          <div class="settings-row">
            <div><div class="settings-label">ANTHROPIC API KEY</div></div>
            <input class="key-input" id="anthropic-key" type="password" placeholder="sk-ant-…" />
          </div>
          <p style="font-size:12px;color:var(--text-dim);margin-top:12px">Keys stored on device only via Even SDK storage. Audio and text go directly to Deepgram and Anthropic — no third-party servers in between.</p>
          <button class="save-settings-btn" id="save-settings-btn">Save Settings</button>
        </div>

        <!-- Models -->
        <div class="settings-panel" id="panel-models">
          <div class="settings-row">
            <div class="settings-label">SUMMARY MODEL</div>
            <select class="select-input" id="model-summary">
              <option value="claude-sonnet-4-6">Claude Sonnet 4.6</option>
              <option value="claude-opus-4-7">Claude Opus 4.7</option>
              <option value="claude-haiku-4-5-20251001">Claude Haiku 4.5</option>
            </select>
          </div>
          <div class="settings-row">
            <div class="settings-label">CUE DETECTION MODEL</div>
            <select class="select-input" id="model-cue">
              <option value="claude-haiku-4-5-20251001">Claude Haiku 4.5</option>
              <option value="claude-sonnet-4-6">Claude Sonnet 4.6</option>
            </select>
          </div>
          <button class="save-settings-btn" id="save-settings-models-btn">Save Settings</button>
        </div>

        <!-- Cues -->
        <div class="settings-panel" id="panel-cues">
          <div class="settings-row">
            <div class="settings-label">FREQUENCY</div>
            <div class="range-row">
              <input class="range-input" id="cue-freq" type="range" min="5" max="60" step="1" />
              <span class="range-label" id="cue-freq-label">18</span>s
            </div>
          </div>
          <div class="settings-row">
            <div><div class="settings-label">MANUAL CUES ONLY</div><div class="settings-desc">Disable auto-cues — only fire when manually triggered</div></div>
            <label class="toggle"><input type="checkbox" id="cue-manual-only" /><span class="toggle-slider"></span></label>
          </div>
          <div class="settings-row">
            <div class="settings-label">HOLD TIME</div>
            <div class="range-row">
              <input class="range-input" id="cue-hold" type="range" min="3" max="30" step="1" />
              <span class="range-label" id="cue-hold-label">10</span>s
            </div>
          </div>
          <div class="settings-row">
            <div class="settings-label">CONFIDENCE</div>
            <div class="radio-group">
              <label class="radio-option"><input type="radio" name="cue-threshold" value="low" /> Low</label>
              <label class="radio-option"><input type="radio" name="cue-threshold" value="medium" checked /> Medium</label>
              <label class="radio-option"><input type="radio" name="cue-threshold" value="high" /> High</label>
            </div>
          </div>
          <div class="settings-row">
            <div class="settings-label">AUTO POP-UP ON GLASSES</div>
            <label class="toggle"><input type="checkbox" id="cue-autopopup" checked /><span class="toggle-slider"></span></label>
          </div>
          <button class="save-settings-btn" id="save-settings-cues-btn">Save Settings</button>
        </div>

        <!-- Display -->
        <div class="settings-panel" id="panel-display">
          ${[
            ['disp-transcript', 'LIVE TRANSCRIPTION ON GLASSES'],
            ['disp-cues', 'AI CUES ON GLASSES'],
            ['disp-time', 'TIME IN HUD'],
            ['disp-context', 'CONTEXT NAME IN HUD'],
          ].map(([id, label]) => `
            <div class="settings-row">
              <div class="settings-label">${label}</div>
              <label class="toggle"><input type="checkbox" id="${id}" checked /><span class="toggle-slider"></span></label>
            </div>`).join('')}
          <button class="save-settings-btn" id="save-settings-display-btn">Save Settings</button>
        </div>

        <!-- Prompts -->
        <div class="settings-panel" id="panel-prompts">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
            <p class="settings-label" style="margin:0">AI EXPORT PROMPT</p>
            <button class="share-btn" id="restore-default-prompt-btn" style="font-size:11px;padding:4px 10px">↺ Restore Default</button>
          </div>
          <p style="font-size:12px;color:var(--text-dim);margin-bottom:8px">Appended when you export a session with the AI Prompt option checked. Paste the export into any AI assistant for instant analysis.</p>
          <textarea class="settings-textarea" id="share-prompt" rows="9"></textarea>
          <button class="save-settings-btn" id="save-settings-prompts-btn">Save Settings</button>
        </div>

        <!-- Meeting Summary -->
        <div class="settings-panel" id="panel-summary">
          <div class="settings-row">
            <div><div class="settings-label">EXTRACT ACTION ITEMS</div><div class="settings-desc">Identify tasks and owners from the transcript</div></div>
            <label class="toggle"><input type="checkbox" id="sum-actions" checked /><span class="toggle-slider"></span></label>
          </div>
          <div class="settings-row">
            <div class="settings-label">SUMMARY DETAIL</div>
            <div class="radio-group">
              <label class="radio-option"><input type="radio" name="sum-detail" value="brief" /> Brief</label>
              <label class="radio-option"><input type="radio" name="sum-detail" value="standard" checked /> Standard</label>
              <label class="radio-option"><input type="radio" name="sum-detail" value="detailed" /> Detailed</label>
            </div>
          </div>
          <button class="save-settings-btn" id="save-settings-summary-btn">Save Settings</button>
        </div>
        <!-- Help -->
        <div class="settings-panel" id="panel-help" style="font-size:13px;line-height:1.6;color:var(--text)">

          <p class="settings-label">ABOUT SMART MEETING</p>
          <p style="color:var(--text-dim);margin-bottom:8px">Smart Meeting is a real-time AI meeting assistant for Even Realities G2 smart glasses. During a session it transcribes your conversation, automatically generates AI cues that surface on your glasses display, and keeps a running conversation with Claude so you can ask follow-up questions hands-free. After the meeting you can generate a structured AI summary and export the full session — transcript, cues, and summary — to any AI assistant or collaborator.</p>
          <p style="color:var(--text-dim);margin-bottom:8px">I built this app because the meeting assistants already in the Even Hub — including Even Conversate — didn't give me the workflow I wanted. I specifically wanted Claude as the AI, finer control over how often and how confidently cues fire, and the ability to pipe a finished meeting straight into my work Claude instance with a custom prompt for a richer, more structured summary.</p>
          <p style="color:var(--text-dim);margin-bottom:12px">If this fits others' needs and workflows, I may expand it with support for additional AI providers and transcription services beyond Deepgram and Anthropic.</p>

          <p class="settings-label">SETTINGS: KEYS</p>
          <p style="color:var(--text-dim);margin-bottom:4px"><strong>Deepgram API Key</strong> — Required for live speech-to-text transcription. Get a key at deepgram.com. Audio is sent directly from your glasses to Deepgram — it never passes through a third-party server.</p>
          <p style="color:var(--text-dim);margin-bottom:12px"><strong>Anthropic API Key</strong> — Required for AI cue generation, Ask Claude, and session summaries. Get a key at console.anthropic.com. Text goes directly to Anthropic. Both keys are stored on-device only.</p>

          <p class="settings-label">SETTINGS: MODELS</p>
          <p style="color:var(--text-dim);margin-bottom:4px"><strong>Summary Model</strong> — Used to generate meeting summaries, produce cue content, and answer Ask Claude questions. Sonnet offers the best quality; Haiku is faster and cheaper.</p>
          <p style="color:var(--text-dim);margin-bottom:12px"><strong>Cue Detection Model</strong> — A lightweight first-pass filter that decides whether a transcript segment warrants a cue. Haiku is recommended — it's fast, cheap, and accurate enough for a yes/no decision.</p>

          <p class="settings-label">SETTINGS: CUES</p>
          <p style="color:var(--text-dim);margin-bottom:4px"><strong>Frequency</strong> — How often (seconds) the auto-cue detector checks the transcript. Lower = more cues and more API cost. 18 seconds is a good balance for most meetings. Enable <em>Manual Cues Only</em> to disable auto-cues entirely and only trigger cues yourself.</p>
          <p style="color:var(--text-dim);margin-bottom:4px"><strong>Hold Time</strong> — How long a cue stays visible on the glasses before auto-dismissing. Can also be dismissed manually with a tap.</p>
          <p style="color:var(--text-dim);margin-bottom:4px"><strong>Confidence</strong> — How strict the AI filter is before generating a cue:<br/>
            &nbsp;• Low: fires on most topics, terms, and light discussion<br/>
            &nbsp;• Medium: filters for questions, named people, and technical claims (recommended)<br/>
            &nbsp;• High: only fires on direct questions being asked or named individuals</p>
          <p style="color:var(--text-dim);margin-bottom:4px"><strong>Auto Pop-up on Glasses</strong> — Cues appear automatically on the glasses display. When off, the status bar shows [CUE READY] and you tap to view.</p>
          <p style="color:var(--text-dim);margin-bottom:4px"><strong>Auto cues</strong> — Every Frequency seconds, if at least a sentence has been spoken, the filter model checks whether a cue is needed. If yes, the summary model generates it and it appears on glasses and phone.</p>
          <p style="color:var(--text-dim);margin-bottom:12px"><strong>Manual cues</strong> — Trigger any time: tap ● on the glasses, or press the Cue button on the phone. Uses the last ~800 characters of transcript.</p>

          <p class="settings-label">SETTINGS: DISPLAY</p>
          <p style="color:var(--text-dim);margin-bottom:4px"><strong>Live Transcription on Glasses</strong> — Streams transcript text to the glasses display in real time during a session.</p>
          <p style="color:var(--text-dim);margin-bottom:4px"><strong>AI Cues on Glasses</strong> — Enables cue overlays on the glasses display. When off, cues still appear on the phone.</p>
          <p style="color:var(--text-dim);margin-bottom:4px"><strong>Time in HUD</strong> — Shows the current time in the top bar on the glasses.</p>
          <p style="color:var(--text-dim);margin-bottom:12px"><strong>Context Name in HUD</strong> — Shows the name of the selected context document in the top bar during a session.</p>

          <p class="settings-label">SETTINGS: PROMPTS</p>
          <p style="color:var(--text-dim);margin-bottom:12px">The AI Export Prompt is placed at the top of session exports when you check the AI Prompt option in the Export / Share section. Paste the full export into any AI assistant to receive a structured analysis. The default prompt instructs the AI to incorporate cues into the summary and tag cue-influenced points with * and [cue type]. Edit the prompt to match your preferred output style, or tap Restore Default to reset it.</p>

          <p class="settings-label">SETTINGS: SUMMARY</p>
          <p style="color:var(--text-dim);margin-bottom:4px"><strong>Extract Action Items</strong> — When generating a summary, the AI identifies tasks and owners mentioned during the meeting and lists them as a separate section.</p>
          <p style="color:var(--text-dim);margin-bottom:12px"><strong>Summary Detail</strong> — Controls depth: Brief (3–5 sentences), Standard (structured with key outcomes), or Detailed (comprehensive coverage of all topics).</p>

          <p class="settings-label">CUE TYPES</p>
          <p style="color:var(--text-dim);margin-bottom:4px"><strong>probe</strong> — A follow-up question to ask the other party</p>
          <p style="color:var(--text-dim);margin-bottom:4px"><strong>concept</strong> — Background explanation of a term or idea mentioned</p>
          <p style="color:var(--text-dim);margin-bottom:4px"><strong>bio</strong> — Background info on a person mentioned</p>
          <p style="color:var(--text-dim);margin-bottom:4px"><strong>answer</strong> — Direct answer to a question asked in the meeting</p>
          <p style="color:var(--text-dim);margin-bottom:12px"><strong>reference</strong> — A relevant fact, statistic, or source</p>

          <p class="settings-label">CONTEXT DOCUMENTS</p>
          <p style="color:var(--text-dim);margin-bottom:12px">Upload up to 5 documents (5 MB max each) on the Context tab. Select one before starting a session — the AI reads it at session start to generate more relevant cues and answers. Up to 10,000 characters (~2,000 words, about 3–4 pages) are used per session. The document is cached after the first AI call so it is not re-billed on every cue.</p>

          <p class="settings-label">SESSIONS & SUMMARIES</p>
          <p style="color:var(--text-dim);margin-bottom:4px">Completed sessions appear in the Sessions tab. Open any session to view its transcript and AI cues.</p>
          <p style="color:var(--text-dim);margin-bottom:12px">Tap <strong>Generate Summary</strong> to have the AI produce a structured summary from the transcript and cues. Summary detail and action-item extraction are controlled in Settings → Summary. The summary is saved to the session and can be included in exports.</p>

          <p class="settings-label">EXPORT / SHARE</p>
          <p style="color:var(--text-dim);margin-bottom:12px">From a session detail, choose what to include — Transcript, Summary, AI Cues, and optionally the AI Prompt — then tap Share / Copy. The AI Prompt option appends the export prompt so you can paste the whole thing into any AI assistant for instant structured analysis that incorporates your meeting's cues.</p>

          <p class="settings-label">PHONE CONTROLS</p>
          <p style="color:var(--text-dim);margin-bottom:4px">Everything can be done from your phone — the glasses are optional. The phone app is organized into five tabs at the bottom:</p>
          <p style="color:var(--text-dim);margin-bottom:4px"><strong>Session</strong> — Start and stop recordings. Shows a live timer, cue count, real-time transcript, and a cue drawer when cues fire. The Cue button triggers a manual cue; Ask opens the Ask tab mid-session.</p>
          <p style="color:var(--text-dim);margin-bottom:4px"><strong>Sessions</strong> — Browse all saved sessions. Tap a session to view its transcript and AI cues, generate a summary, and export or share.</p>
          <p style="color:var(--text-dim);margin-bottom:4px"><strong>Context</strong> — Upload and manage context documents. Tap Use to select one as the active context for your next session.</p>
          <p style="color:var(--text-dim);margin-bottom:4px"><strong>Ask</strong> — Ask Claude anything about the current or most recent meeting. Questions and answers are part of the same conversation thread as the session's cues.</p>
          <p style="color:var(--text-dim);margin-bottom:12px"><strong>Settings</strong> — All configuration. Keys, models, cue behavior, display toggles, export prompt, summary options, and this help screen.</p>

          <p class="settings-label">GLASSES GESTURES</p>
          <p style="color:var(--text-dim);margin-bottom:8px"><strong>Home screen</strong></p>
          <p style="color:var(--text-dim);margin-bottom:4px">● press — Start new session</p>
          <p style="color:var(--text-dim);margin-bottom:12px">○○ double-press — Exit app (shows confirmation)</p>
          <p style="color:var(--text-dim);margin-bottom:8px"><strong>During a session</strong></p>
          <p style="color:var(--text-dim);margin-bottom:4px">● press — Trigger a manual cue</p>
          <p style="color:var(--text-dim);margin-bottom:12px">○○ double-press — End session and return to home</p>
          <p style="color:var(--text-dim);margin-bottom:8px"><strong>Viewing a cue</strong></p>
          <p style="color:var(--text-dim);margin-bottom:4px">▲ swipe up / ▼ swipe down — Navigate between cue pages</p>
          <p style="color:var(--text-dim);margin-bottom:12px">● press or ○○ double-press — Dismiss cue</p>
          <p style="color:var(--text-dim);margin-bottom:12px">Ask Claude is phone-only — use the Ask tab or the ? button during an active session.</p>

        </div>
      </div>
    </div>

    <!-- Bottom nav -->
    <nav class="nav-bar">
      <button class="nav-tab active" data-screen="session">
        <span class="nav-tab-icon">●</span>
        <span>Session</span>
      </button>
      <button class="nav-tab" data-screen="sessions">
        <span class="nav-tab-icon">≡</span>
        <span>Sessions</span>
      </button>
      <button class="nav-tab" data-screen="context">
        <span class="nav-tab-icon">◈</span>
        <span>Context</span>
      </button>
      <button class="nav-tab" data-screen="ask">
        <span class="nav-tab-icon">?</span>
        <span>Ask</span>
      </button>
      <button class="nav-tab" data-screen="settings">
        <span class="nav-tab-icon">⚙</span>
        <span>Settings</span>
      </button>
    </nav>

    <!-- Doc import modal -->
    <div class="doc-import-modal" id="doc-import-modal">
      <div class="doc-import-sheet">
        <p class="modal-title">Add Context Document</p>
        <label class="file-pick-btn" id="doc-file-label">
          <input type="file" id="doc-file-input" accept=".txt,.md,.csv,.json,.rtf,.pdf,text/plain,text/markdown,application/pdf" style="display:none" />
          📄 Choose file
        </label>
        <p class="modal-size-hint" style="margin-top:4px">Supported: .pdf, .txt, .md, .csv, .json — or paste text below</p>
        <input class="modal-input" id="doc-name-input" placeholder="Document name" style="margin-top:8px" />
        <textarea class="modal-input" id="doc-text-input" rows="5" placeholder="Paste document text here…"></textarea>
        <p class="modal-size-hint">Max 5 MB per document. Up to 5 documents total.</p>
        <div class="modal-actions">
          <button class="modal-cancel" id="doc-cancel-btn">Cancel</button>
          <button class="modal-confirm" id="doc-confirm-btn">Add Document</button>
        </div>
        <p class="modal-error" id="doc-import-error"></p>
      </div>
    </div>
  `
}
