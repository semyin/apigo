import type { Body, KV, Request } from '../api/types'

export function emptyKV(): KV {
  return { enabled: true, key: '', value: '', type: 'String', description: '' }
}

export function normalizeBody(body: Body | undefined): Body {
  const b: Body = body ?? { type: 'none' }
  if (!b.type) return { type: 'none' }
  if (b.type === 'multipart' || b.type === 'urlencoded') {
    return {
      ...b,
      fields: (b.fields ?? []).map((f) => ({
        ...f,
        enabled: f.enabled ?? true,
        key: f.key ?? '',
        value: f.value ?? '',
      })),
    }
  }
  return b
}

export function normalizeAuth(auth: Request['auth'] | undefined): Request['auth'] {
  const a = auth ?? { type: 'none' }
  if (!a.type) return { type: 'none' }
  return a
}

export function normalizeRequest(req: Request): Request {
  return {
    ...req,
    queryParams: req.queryParams ?? [],
    headers: req.headers ?? [],
    body: normalizeBody(req.body),
    auth: normalizeAuth(req.auth),
    urlMode: req.urlMode ?? 'full',
    urlFull: req.urlFull ?? '',
    path: req.path ?? '',
    method: req.method ?? 'GET',
    description: req.description ?? '',
  }
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  let v = bytes
  let i = 0
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i++
  }
  return `${v.toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}
