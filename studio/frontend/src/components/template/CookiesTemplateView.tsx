type CookieRow = {
  name: string
  value: string
  domain: string
  path: string
  expires: string
  flags: string
}

export function CookiesTemplateView({ headers }: { headers: Record<string, string[]> }) {
  const rows = parseCookiesFromHeaders(headers)
  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-hidden rounded-xl border border-ui-border dark:border-ui-borderDark">
        <div className="grid grid-cols-[minmax(0,0.85fr)_minmax(0,1.55fr)_minmax(0,0.85fr)_minmax(0,0.7fr)_minmax(0,0.8fr)_minmax(0,0.75fr)] border-b border-ui-border bg-surface-50 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400 dark:border-ui-borderDark dark:bg-surface-900 dark:text-gray-500">
          <div>Name</div>
          <div>Value</div>
          <div>Domain</div>
          <div>Path</div>
          <div>Expires</div>
          <div>Flags</div>
        </div>
        <div className="divide-y divide-ui-border dark:divide-ui-borderDark">
          {rows.length ? (
            rows.map((r) => (
              <div
                key={`${r.name}:${r.value}`}
                className="grid grid-cols-[minmax(0,0.85fr)_minmax(0,1.55fr)_minmax(0,0.85fr)_minmax(0,0.7fr)_minmax(0,0.8fr)_minmax(0,0.75fr)] px-4 py-3"
              >
                <div className="font-mono text-[12px] text-gray-900 dark:text-gray-100">{r.name}</div>
                <div className="truncate font-mono text-[12px] text-gray-600 dark:text-gray-300">{r.value}</div>
                <div className="font-mono text-[12px] text-gray-600 dark:text-gray-300">{r.domain}</div>
                <div className="font-mono text-[12px] text-gray-600 dark:text-gray-300">{r.path}</div>
                <div className="font-mono text-[12px] text-gray-600 dark:text-gray-300">{r.expires}</div>
                <div className="text-[12px] text-gray-600 dark:text-gray-300">{r.flags}</div>
              </div>
            ))
          ) : (
            <div className="px-4 py-3 text-[12px] text-gray-500 dark:text-gray-400">No cookies.</div>
          )}
        </div>
      </div>
    </div>
  )
}

export function cookieCount(headers: Record<string, string[]> | undefined): number {
  if (!headers) return 0
  return parseCookiesFromHeaders(headers).length
}

function parseCookiesFromHeaders(headers: Record<string, string[]>): CookieRow[] {
  const entries = Object.entries(headers || {})
  const setCookie = entries.find(([k]) => k.toLowerCase() === 'set-cookie')?.[1] ?? []
  return setCookie.map(parseSetCookie).filter((c) => c.name)
}

function parseSetCookie(raw: string): CookieRow {
  const parts = (raw || '').split(';').map((p) => p.trim()).filter(Boolean)
  const first = parts[0] || ''
  const eq = first.indexOf('=')
  const name = eq >= 0 ? first.slice(0, eq) : first
  const value = eq >= 0 ? first.slice(eq + 1) : ''

  let domain = ''
  let path = ''
  let expires = ''
  const flags: string[] = []

  for (const p of parts.slice(1)) {
    const idx = p.indexOf('=')
    const k = (idx >= 0 ? p.slice(0, idx) : p).trim()
    const v = (idx >= 0 ? p.slice(idx + 1) : '').trim()
    const lk = k.toLowerCase()
    if (lk === 'domain') domain = v
    else if (lk === 'path') path = v
    else if (lk === 'expires') expires = v
    else if (lk === 'max-age') expires = v ? `${v}s` : expires
    else if (lk === 'samesite') flags.push(v ? `SameSite=${v}` : 'SameSite')
    else if (lk === 'httponly') flags.push('HttpOnly')
    else if (lk === 'secure') flags.push('Secure')
    else flags.push(v ? `${k}=${v}` : k)
  }

  return {
    name,
    value,
    domain,
    path,
    expires: expires || 'Session',
    flags: flags.join(', '),
  }
}

