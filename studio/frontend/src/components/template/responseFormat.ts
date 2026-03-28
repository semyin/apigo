export function copyToClipboard(text: string) {
  const t = text ?? ''
  if (!t) return
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(t).catch(() => fallbackCopy(t))
    return
  }
  fallbackCopy(t)
}

function fallbackCopy(text: string) {
  const el = document.createElement('textarea')
  el.value = text
  el.style.position = 'fixed'
  el.style.left = '-9999px'
  el.style.top = '0'
  document.body.appendChild(el)
  el.focus()
  el.select()
  try {
    document.execCommand('copy')
  } catch {
    // ignore
  } finally {
    document.body.removeChild(el)
  }
}

export function headerCount(headers: Record<string, string[]> | undefined): number {
  if (!headers) return 0
  return Object.keys(headers).length
}

function escapeHtml(text: string): string {
  return (text || '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
}

export type ResponseBodyView = 'pretty' | 'raw'

export function tryFormatJson(body: string): { ok: boolean; pretty: string } {
  const trimmed = (body || '').trim()
  if (!trimmed) return { ok: false, pretty: '' }
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return { ok: false, pretty: '' }

  try {
    const parsed = JSON.parse(trimmed)
    return { ok: true, pretty: JSON.stringify(parsed, null, 2) }
  } catch {
    return { ok: false, pretty: '' }
  }
}

export function bodyTextForView(body: string, view: ResponseBodyView): string {
  const raw = body ?? ''
  if (view === 'raw') return raw

  const formatted = tryFormatJson(raw)
  return formatted.ok ? formatted.pretty : raw
}

export function renderBodyAsHtml(body: string, view: ResponseBodyView = 'pretty'): string {
  const raw = body ?? ''

  if (view === 'raw') {
    return escapeHtml(raw)
  }

  const formatted = tryFormatJson(raw)
  if (formatted.ok) return highlightJson(formatted.pretty)
  return escapeHtml(raw)
}

function highlightJson(text: string): string {
  const s = text || ''
  let out = ''
  let i = 0
  while (i < s.length) {
    const ch = s[i]

    if (ch === ' ' || ch === '\n' || ch === '\r' || ch === '\t') {
      out += ch
      i++
      continue
    }

    if (ch === '"') {
      let j = i + 1
      while (j < s.length) {
        const c = s[j]
        if (c === '\\\\') {
          j += 2
          continue
        }
        if (c === '"') break
        j++
      }
      const raw = s.slice(i, Math.min(j + 1, s.length))
      let k = j + 1
      while (k < s.length && (s[k] === ' ' || s[k] === '\n' || s[k] === '\r' || s[k] === '\t')) k++
      const isKey = s[k] === ':'
      const cls = isKey ? 'text-[#0284c7] dark:text-[#38bdf8]' : 'text-[#16a34a] dark:text-[#4ade80]'
      out += `<span class="${cls}">${escapeHtml(raw)}</span>`
      i = Math.min(j + 1, s.length)
      continue
    }

    if (ch === '-' || (ch >= '0' && ch <= '9')) {
      let j = i + 1
      while (j < s.length) {
        const c = s[j]
        if ((c >= '0' && c <= '9') || c === '.' || c === 'e' || c === 'E' || c === '+' || c === '-') {
          j++
          continue
        }
        break
      }
      const raw = s.slice(i, j)
      out += `<span class="text-[#059669] dark:text-[#a3e635]">${escapeHtml(raw)}</span>`
      i = j
      continue
    }

    if (s.startsWith('true', i) || s.startsWith('false', i) || s.startsWith('null', i)) {
      const raw = s.startsWith('true', i) ? 'true' : s.startsWith('false', i) ? 'false' : 'null'
      out += `<span class="text-[#c026d3] dark:text-[#c084fc]">${raw}</span>`
      i += raw.length
      continue
    }

    if ('{}[],:'.includes(ch)) {
      out += `<span class="text-gray-400">${escapeHtml(ch)}</span>`
      i++
      continue
    }

    out += escapeHtml(ch)
    i++
  }
  return out
}
