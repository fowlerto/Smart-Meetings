import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs'
import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl

export async function extractPdfText(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer, useWorkerFetch: false, useSystemFonts: true }).promise
  const pages: string[] = []
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    let pageText = ''
    let lastY: number | null = null
    for (const item of content.items as any[]) {
      if (!('str' in item)) continue
      // Insert newline when Y position changes significantly (new line in PDF)
      const y = item.transform?.[5]
      if (lastY !== null && Math.abs(y - lastY) > 5) pageText += '\n'
      pageText += item.str + (item.hasEOL ? '\n' : '')
      lastY = y
    }
    if (pageText.trim()) pages.push(pageText.trim())
  }
  return pages.join('\n\n')
}
