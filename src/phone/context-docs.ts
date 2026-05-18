import type { ContextDoc } from '../types.ts'
import {
  saveContextDoc,
  loadContextIndex,
  deleteContextDoc,
  formatBytes,
  generateId,
} from '../storage.ts'

const MAX_DOC_BYTES = 5 * 1024 * 1024

export async function importTextDoc(name: string, text: string): Promise<{ ok: boolean; error?: string }> {
  const sizeBytes = new TextEncoder().encode(text).length
  if (sizeBytes > MAX_DOC_BYTES) {
    return { ok: false, error: 'Document exceeds the 5 MB limit. Please use a smaller file or paste a shorter excerpt.' }
  }

  const doc: ContextDoc = {
    id: generateId(),
    name,
    chunkCount: 0,
    sizeBytes,
  }

  return saveContextDoc(doc, text)
}

export async function removeDoc(doc: ContextDoc): Promise<void> {
  await deleteContextDoc(doc.id, doc.chunkCount)
}

export function renderDocsList(
  docs: ContextDoc[],
  activeDocId: string | null,
  onSelect: (id: string) => void,
): void {
  const listEl = document.getElementById('context-docs-list')
  if (!listEl) return

  if (!docs.length) {
    listEl.innerHTML = '<p class="empty-state">No context documents yet. Add up to 5 documents to enhance AI cues.</p>'
    return
  }

  listEl.innerHTML = docs
    .map(doc => {
      const isActive = doc.id === activeDocId
      return `
      <div class="doc-row${isActive ? ' doc-row--active' : ''}" data-id="${doc.id}">
        <div class="doc-info">
          <div class="doc-name">${escapeHtml(doc.name)}${isActive ? ' <span class="doc-active-badge">ACTIVE</span>' : ''}</div>
          <div class="doc-meta">${formatBytes(doc.sizeBytes)}</div>
        </div>
        <div class="doc-actions">
          <button class="doc-select btn-small${isActive ? ' btn-active' : ''}" data-action="select" data-id="${doc.id}">${isActive ? 'Selected' : 'Use'}</button>
          <button class="doc-delete btn-small btn-danger" data-action="delete" data-id="${doc.id}">✕</button>
        </div>
      </div>`
    })
    .join('')

  // Wire select buttons
  listEl.querySelectorAll<HTMLElement>('[data-action="select"]').forEach(btn => {
    btn.addEventListener('click', () => onSelect(btn.dataset.id!))
  })
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

export { loadContextIndex }
