import type { BootstrapData, Environment, KV, KVType, Request } from '../api/types'

import { normalizeRequest } from './normalize'

export function envToneDot(name: string): string {
  const n = (name || '').toLowerCase()
  if (n.includes('stag')) return 'bg-http-post'
  if (n.includes('prod')) return 'bg-http-delete'
  return 'bg-http-get'
}

export function methodToneClass(method: string): string {
  const m = (method || '').toUpperCase()
  if (m === 'POST') return 'text-http-post'
  if (m === 'PUT') return 'text-http-put'
  if (m === 'DELETE') return 'text-http-delete'
  if (m === 'PATCH') return 'text-http-patch'
  return 'text-http-get'
}

export function methodToneDotClass(method: string): string {
  const m = (method || '').toUpperCase()
  if (m === 'POST') return 'bg-http-post'
  if (m === 'PUT') return 'bg-http-put'
  if (m === 'DELETE') return 'bg-http-delete'
  if (m === 'PATCH') return 'bg-http-patch'
  return 'bg-http-get'
}

export function methodShort(method: string): string {
  const m = (method || '').toUpperCase()
  if (m === 'DELETE') return 'DEL'
  return m || 'GET'
}

export function statusToneClass(status: number): string {
  if (status >= 200 && status < 300) return 'text-http-get'
  if (status >= 400) return 'text-http-delete'
  return 'text-http-post'
}

export function joinURLPath(basePath: string, addPath: string): string {
  const a = (basePath || '').replace(/\/+$/, '')
  const b = (addPath || '').replace(/^\/+/, '')
  if (!a) return '/' + b
  if (!b) return a
  return a + '/' + b
}

export function fingerprintURL(req: Request): string {
  return `${req.urlMode}|${req.urlFull}|${req.path}|${JSON.stringify(req.queryParams ?? [])}`
}

export function computeDisplayURL(req: Request, env: Environment | null): string {
  // When an environment baseUrl is configured and the request is in basepath mode,
  // the address bar should only show the relative path (ApiFox-style).
  const envBaseRaw = (env?.baseUrl || '').trim()
  if (req.urlMode === 'basepath' && envBaseRaw) {
    const p = (req.path || '').trim() || '/'
    const q = new URLSearchParams()
    for (const kv of req.queryParams ?? []) {
      if (!kv.enabled) continue
      if (!kv.key?.trim()) continue
      q.append(kv.key, kv.value ?? '')
    }
    const qs = q.toString()
    return qs ? `${p}?${qs}` : p
  }

  const base = computeBaseURL(req, env)
  if (!base) return ''

  try {
    const u = new URL(base)
    const q = new URLSearchParams(u.search)
    for (const kv of req.queryParams ?? []) {
      if (!kv.enabled) continue
      if (!kv.key?.trim()) continue
      q.append(kv.key, kv.value ?? '')
    }
    u.search = q.toString()
    return u.toString()
  } catch {
    return base
  }
}

export function computeBaseURL(req: Request, env: Environment | null): string {
  if (req.urlMode !== 'basepath') return (req.urlFull || '').trim()

  const baseRaw = (env?.baseUrl || '').trim()
  // When base URL is missing, fall back to the stored full URL (so sends still work).
  if (!baseRaw) return (req.urlFull || '').trim()

  try {
    const u = new URL(baseRaw)
    const p = (req.path || '/').trim() || '/'
    u.pathname = joinURLPath(u.pathname, p)
    u.search = ''
    u.hash = ''
    return u.toString()
  } catch {
    return (req.urlFull || '').trim()
  }
}

export function applyUrlTextToRequest(req: Request, urlText: string, env: Environment | null): Request {
  const trimmed = (urlText || '').trim()
  if (!trimmed) return req

  const prev = normalizeRequest(req)
  const prevByKey = new Map<string, KV>()
  for (const kv of prev.queryParams ?? []) {
    if (!kv.key) continue
    if (!prevByKey.has(kv.key)) prevByKey.set(kv.key, kv)
  }

  const envBaseRaw = (env?.baseUrl || '').trim()

  function kvFromSearchParams(sp: URLSearchParams): KV[] {
    const nextQuery: KV[] = []
    sp.forEach((value, key) => {
      const prevRow = prevByKey.get(key)
      nextQuery.push({
        enabled: true,
        key,
        value,
        type: (prevRow?.type as KVType) || 'String',
        description: prevRow?.description || '',
      })
    })
    return nextQuery
  }

  function computeFullFromBasePath(baseRaw: string, pathRaw: string): string {
    try {
      const u = new URL(baseRaw)
      u.pathname = joinURLPath(u.pathname, pathRaw || '/')
      u.search = ''
      u.hash = ''
      return u.toString()
    } catch {
      return ''
    }
  }

  function tryExtractPathFromFullURL(u: URL, baseRaw: string): string | null {
    if (!baseRaw) return null
    try {
      const base = new URL(baseRaw)
      if (u.origin !== base.origin) return null

      const basePath = base.pathname.replace(/\/+$/, '')
      const fullPath = u.pathname || '/'
      if (basePath) {
        if (fullPath === basePath) return '/'
        if (!fullPath.startsWith(basePath + '/')) return null
        const rest = fullPath.slice(basePath.length)
        return rest || '/'
      }
      return fullPath || '/'
    } catch {
      return null
    }
  }

  // Absolute URL input.
  if (trimmed.includes('://')) {
    try {
      const u = new URL(trimmed)
      const nextQuery = kvFromSearchParams(u.searchParams)
      u.search = ''
      u.hash = ''

      const extracted = tryExtractPathFromFullURL(u, envBaseRaw)
      if (extracted && envBaseRaw) {
        const urlFull = u.toString()
        return normalizeRequest({
          ...prev,
          urlMode: 'basepath',
          urlFull,
          path: extracted,
          queryParams: nextQuery,
        })
      }

      return normalizeRequest({
        ...prev,
        urlMode: 'full',
        urlFull: u.toString(),
        queryParams: nextQuery,
      })
    } catch {
      return normalizeRequest({ ...prev, urlMode: 'full', urlFull: trimmed })
    }
  }

  // Relative path input (when env base URL exists, store as basepath).
  const qIdx = trimmed.indexOf('?')
  const rawPath = (qIdx >= 0 ? trimmed.slice(0, qIdx) : trimmed).trim()
  const rawQuery = qIdx >= 0 ? trimmed.slice(qIdx + 1) : ''
  const nextQuery = kvFromSearchParams(new URLSearchParams(rawQuery))

  if (envBaseRaw) {
    const path = rawPath || '/'
    const urlFull = computeFullFromBasePath(envBaseRaw, path)
    return normalizeRequest({
      ...prev,
      urlMode: 'basepath',
      urlFull: urlFull || prev.urlFull,
      path,
      queryParams: nextQuery,
    })
  }

  const baseOnly = rawPath || trimmed
  return normalizeRequest({ ...prev, urlMode: 'full', urlFull: baseOnly, queryParams: nextQuery })
}

export function filterTree(nodes: BootstrapData['tree'], q: string): BootstrapData['tree'] {
  const out: BootstrapData['tree'] = []
  for (const n of nodes) {
    const nameHit = (n.name || '').toLowerCase().includes(q)
    if (n.type === 'request') {
      if (nameHit) out.push(n)
      continue
    }
    const kids = n.children ? filterTree(n.children, q) : []
    if (nameHit || kids.length) out.push({ ...n, children: kids })
  }
  return out
}

export function sortEnvsForDisplay(envs: Environment[]): Environment[] {
  function rank(name: string): number {
    const n = (name || '').toLowerCase()
    if (n.includes('dev')) return 0
    if (n.includes('stag')) return 1
    if (n.includes('prod')) return 2
    return 100
  }
  return envs
    .slice()
    .sort((a, b) => rank(a.name) - rank(b.name) || (a.name || '').localeCompare(b.name || ''))
}

export type FolderOption = { id: string; name: string; depth: number }

export function flattenFolderOptions(nodes: BootstrapData['tree']): FolderOption[] {
  const out: FolderOption[] = []
  function walk(list: BootstrapData['tree'], depth: number) {
    for (const n of list) {
      if (n.type !== 'folder') continue
      out.push({ id: n.id, name: n.name, depth })
      if (n.children?.length) walk(n.children, depth + 1)
    }
  }
  walk(nodes, 0)
  return out
}

export function findNodeDepth(nodes: BootstrapData['tree'], nodeId: string): number {
  function walk(list: BootstrapData['tree'], depth: number): number {
    for (const n of list) {
      if (n.type === 'folder' && n.id === nodeId) return depth
      if (n.type === 'folder' && n.children?.length) {
        const d = walk(n.children, depth + 1)
        if (d) return d
      }
    }
    return 0
  }
  return walk(nodes, 1)
}

export function findNodeWithParentByNodeId(
  nodes: BootstrapData['tree'],
  nodeId: string
): { node: BootstrapData['tree'][number]; parentId: string | null } | null {
  function walk(
    list: BootstrapData['tree'],
    parentId: string | null
  ): { node: BootstrapData['tree'][number]; parentId: string | null } | null {
    for (const n of list) {
      if (n.id === nodeId) return { node: n, parentId }
      if (n.type === 'folder' && n.children?.length) {
        const hit = walk(n.children, n.id)
        if (hit) return hit
      }
    }
    return null
  }
  return walk(nodes, null)
}

export function findNodeWithParentByRequestId(
  nodes: BootstrapData['tree'],
  requestId: string
): { node: BootstrapData['tree'][number]; parentId: string | null } | null {
  function walk(
    list: BootstrapData['tree'],
    parentId: string | null
  ): { node: BootstrapData['tree'][number]; parentId: string | null } | null {
    for (const n of list) {
      if (n.type === 'request' && n.requestId === requestId) return { node: n, parentId }
      if (n.type === 'folder' && n.children?.length) {
        const hit = walk(n.children, n.id)
        if (hit) return hit
      }
    }
    return null
  }
  return walk(nodes, null)
}

export function findFirstRequestId(nodes: BootstrapData['tree']): string {
  for (const n of nodes) {
    if (n.type === 'request' && n.requestId) return n.requestId
    if (n.type === 'folder' && n.children?.length) {
      const hit = findFirstRequestId(n.children)
      if (hit) return hit
    }
  }
  return ''
}
