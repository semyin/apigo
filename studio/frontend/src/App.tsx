import clsx from 'clsx'
import { useEffect, useMemo, useRef, useState } from 'react'

import { backend } from './api/backend'
import type { BootstrapData, Environment, KV, KVType, Request, SendResult, Settings } from './api/types'
import { TreeView } from './components/TreeView'
import { AuthTemplateEditor } from './components/template/AuthTemplateEditor'
import { BodyTemplateEditor } from './components/template/BodyTemplateEditor'
import { CookiesTemplateView, cookieCount } from './components/template/CookiesTemplateView'
import { HeadersTemplateView } from './components/template/HeadersTemplateView'
import { KVFlexTable } from './components/template/KVFlexTable'
import { copyToClipboard, headerCount, renderBodyAsHtml } from './components/template/responseFormat'
import { applyThemeClass, getStoredTheme, resolveTheme, storeTheme, type Theme } from './lib/theme'
import { formatBytes, normalizeRequest } from './lib/normalize'
import { i18n } from './i18n'

type ReqTab = 'params' | 'headers' | 'body' | 'auth'
type ResTab = 'body' | 'headers' | 'cookies'

export default function App() {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [themePref, setThemePref] = useState<Theme>('system')
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('dark')

  const [tree, setTree] = useState<BootstrapData['tree']>([])
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [activeProjectId, setActiveProjectId] = useState<string>('')
  const [envs, setEnvs] = useState<BootstrapData['environments']>([])
  const [activeEnvId, setActiveEnvId] = useState<string>('')

  const [selectedRequestId, setSelectedRequestId] = useState<string>('')
  const [req, setReq] = useState<Request | null>(null)
  const [dirty, setDirty] = useState(false)

  const [reqTab, setReqTab] = useState<ReqTab>('params')
  const [resTab, setResTab] = useState<ResTab>('body')
  const [response, setResponse] = useState<SendResult | null>(null)

  const [sending, setSending] = useState(false)
  const [saving, setSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string>('')

  const saveTimer = useRef<number | null>(null)

  const urlInputRef = useRef<HTMLInputElement | null>(null)
  const [urlText, setUrlText] = useState('')
  const [envMenuOpen, setEnvMenuOpen] = useState(false)
  const [methodMenuOpen, setMethodMenuOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsDraft, setSettingsDraft] = useState<Settings | null>(null)

  const [sidebarFilter, setSidebarFilter] = useState('')

  const activeEnv = useMemo(
    () => envs.find((e) => e.id === activeEnvId) ?? null,
    [envs, activeEnvId]
  )

  // Close floating menus on outside click.
  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      const target = e.target as Node | null
      if (!target) return

      if (envMenuOpen) {
        const btn = document.getElementById('envDropdownBtn')
        const menu = document.getElementById('envDropdownMenu')
        if (btn && menu && !btn.contains(target) && !menu.contains(target)) {
          setEnvMenuOpen(false)
        }
      }

      if (methodMenuOpen) {
        const root = document.getElementById('methodDropdownRoot')
        if (root && !root.contains(target)) setMethodMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [envMenuOpen, methodMenuOpen])

  useEffect(() => {
    let cancelled = false

    backend
      .bootstrap()
      .then((data) => {
        if (cancelled) return
        applyBootstrapData(data)
      })
      .catch((err) => {
        if (cancelled) return
        setErrorMsg(String(err?.message ?? err))
      })

    return () => {
      cancelled = true
    }
  }, [])

  function applyBootstrapData(data: BootstrapData) {
    setSettings(data.settings)
    setTree(data.tree)
    setActiveProjectId(data.activeProjectId)
    setEnvs(data.environments)
    setActiveEnvId(data.activeEnvId)
    setSelectedRequestId(data.selectedRequestId)
    setReq(normalizeRequest(data.selectedRequest))
    setDirty(false)

    const stored = getStoredTheme()
    const pref: Theme = stored ?? (data.settings.theme || 'system')
    setThemePref(pref)
    storeTheme(pref)
    const resolved = resolveTheme(pref)
    setResolvedTheme(resolved)
    applyThemeClass(resolved)

    const lang = data.settings.language || 'zh'
    i18n.changeLanguage(lang)
  }

  // Keep URL input in sync, unless user is actively editing it.
  useEffect(() => {
    if (!req) return
    const next = computeDisplayURL(req, activeEnv)
    const focused = urlInputRef.current && document.activeElement === urlInputRef.current
    if (!focused) setUrlText(next)
  }, [req, activeEnv?.baseUrl])

  // Auto-save
  useEffect(() => {
    if (!req || !settings) return
    if (!dirty) return
    if (!settings.autoSave) return

    if (saveTimer.current) window.clearTimeout(saveTimer.current)
    saveTimer.current = window.setTimeout(async () => {
      setSaving(true)
      try {
        await backend.saveRequest(req)
        setDirty(false)
      } catch (err: any) {
        setErrorMsg(String(err?.message ?? err))
      } finally {
        setSaving(false)
      }
    }, 600)

    return () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current)
    }
  }, [req, dirty, settings])

  function updateReq(mutator: (r: Request) => Request) {
    setReq((prev) => {
      if (!prev) return prev
      return normalizeRequest(mutator(prev))
    })
    setDirty(true)
  }

  async function selectRequest(requestId: string) {
    if (!requestId) return
    setErrorMsg('')

    if (req && dirty && settings?.autoSave === false) {
      setSaving(true)
      try {
        await backend.saveRequest(req)
        setDirty(false)
      } catch (err: any) {
        setErrorMsg(String(err?.message ?? err))
      } finally {
        setSaving(false)
      }
    }

    try {
      const r = await backend.getRequest(requestId)
      setSelectedRequestId(requestId)
      setReq(normalizeRequest(r))
      setDirty(false)
      setResponse(null)
    } catch (err: any) {
      setErrorMsg(String(err?.message ?? err))
    }
  }

  async function send() {
    if (!req) return
    setErrorMsg('')

    const prepared = applyUrlTextToRequest(req, urlText, activeEnv)
    const urlChanged = fingerprintURL(prepared) !== fingerprintURL(req)
    const requestId = selectedRequestId || req.id

    if (dirty || urlChanged) {
      setSaving(true)
      try {
        await backend.saveRequest(prepared)
        setReq(prepared)
        setDirty(false)
      } catch (err: any) {
        setErrorMsg(String(err?.message ?? err))
        setSaving(false)
        return
      }
      setSaving(false)
    }

    setSending(true)
    try {
      const res = await backend.sendRequest(requestId)
      setResponse(res)
      setResTab('body')
    } catch (err: any) {
      setErrorMsg(String(err?.message ?? err))
    } finally {
      setSending(false)
    }
  }

  async function saveNow() {
    if (!req) return
    setErrorMsg('')
    const prepared = applyUrlTextToRequest(req, urlText, activeEnv)
    setSaving(true)
    try {
      await backend.saveRequest(prepared)
      setReq(prepared)
      setDirty(false)
    } catch (err: any) {
      setErrorMsg(String(err?.message ?? err))
    } finally {
      setSaving(false)
    }
  }

  async function changeTheme(next: Theme) {
    setThemePref(next)
    storeTheme(next)
    const resolved = resolveTheme(next)
    setResolvedTheme(resolved)
    applyThemeClass(resolved)

    if (!settings) return
    const updated: Settings = { ...settings, theme: next }
    setSettings(updated)
    try {
      await backend.saveSettings(updated)
    } catch {
      // Non-fatal.
    }
  }

  function toggleTheme() {
    const next: Theme = resolvedTheme === 'dark' ? 'light' : 'dark'
    changeTheme(next)
  }

  async function changeActiveEnv(envId: string) {
    if (!envId || !activeProjectId) return
    setActiveEnvId(envId)
    try {
      await backend.setActiveEnv(activeProjectId, envId)
    } catch (err: any) {
      setErrorMsg(String(err?.message ?? err))
    }
  }

  async function reloadBootstrap() {
    setErrorMsg('')
    try {
      const data = await backend.bootstrap()
      applyBootstrapData(data)
    } catch (err: any) {
      setErrorMsg(String(err?.message ?? err))
    }
  }

  async function importPostman() {
    setErrorMsg('')
    try {
      const projectId = await backend.importPostmanFromDialog()
      if (projectId) await reloadBootstrap()
    } catch (err: any) {
      setErrorMsg(String(err?.message ?? err))
    }
  }

  async function exportPostman() {
    if (!activeProjectId) return
    setErrorMsg('')
    try {
      const savePath = await backend.exportPostmanFromDialog(activeProjectId)
      if (savePath) window.alert(`Exported: ${savePath}`)
    } catch (err: any) {
      setErrorMsg(String(err?.message ?? err))
    }
  }

  async function exportOpenAPI() {
    if (!activeProjectId) return
    setErrorMsg('')
    try {
      const savePath = await backend.exportOpenAPIFromDialog(activeProjectId)
      if (savePath) window.alert(`Exported: ${savePath}`)
    } catch (err: any) {
      setErrorMsg(String(err?.message ?? err))
    }
  }

  async function saveSettingsDraft() {
    if (!settingsDraft) {
      setSettingsOpen(false)
      return
    }
    setErrorMsg('')
    try {
      await backend.saveSettings(settingsDraft)
    } catch (err: any) {
      setErrorMsg(String(err?.message ?? err))
      return
    }
    setSettings(settingsDraft)
    setSettingsOpen(false)

    // Apply immediately.
    setThemePref(settingsDraft.theme)
    storeTheme(settingsDraft.theme)
    const resolved = resolveTheme(settingsDraft.theme)
    setResolvedTheme(resolved)
    applyThemeClass(resolved)
    i18n.changeLanguage(settingsDraft.language)
  }

  const filteredTree = useMemo(() => {
    const q = sidebarFilter.trim().toLowerCase()
    if (!q) return tree
    return filterTree(tree, q)
  }, [tree, sidebarFilter])

  // TODO(template): render the template-matched UI here.
  return (
    <div className="h-screen w-screen bg-surface-50 dark:bg-surface-900 text-gray-800 dark:text-gray-300 flex overflow-hidden text-[13px] transition-colors duration-200">
      <aside className="w-72 bg-surface-50 dark:bg-surface-900 border-r border-ui-border dark:border-ui-borderDark flex flex-col z-10">
        <div className="h-[46px] px-4 flex items-center shrink-0">
          <div className="font-semibold text-[14px] text-gray-900 dark:text-gray-100 flex items-center tracking-tight">
            <div className="w-6 h-6 rounded bg-gradient-to-br from-ui-primary to-blue-400 text-white flex items-center justify-center mr-2 shadow-sm">
              <i className="fa-solid fa-bolt text-[10px]" />
            </div>
            Studio
          </div>
        </div>

        <div className="px-3 pb-2">
          <div className="bg-white dark:bg-surface-800 flex items-center px-2 py-1.5 rounded-md border border-ui-border dark:border-ui-borderDark focus-within:border-ui-primary dark:focus-within:border-ui-primary focus-within:ring-1 focus-within:ring-ui-primary/20 transition-all shadow-subtle">
            <i className="fa-solid fa-magnifying-glass text-gray-400 text-[11px] mr-2" />
            <input
              type="text"
              placeholder="Search..."
              className="bg-transparent w-full placeholder-gray-400 text-gray-800 dark:text-gray-200"
              value={sidebarFilter}
              onChange={(e) => setSidebarFilter(e.target.value)}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-2 pb-2 select-none">
          <TreeView
            nodes={filteredTree}
            collapsed={collapsed}
            onToggleFolder={(id) => setCollapsed((p) => ({ ...p, [id]: !(p[id] ?? false) }))}
            selectedRequestId={selectedRequestId}
            onSelectRequest={selectRequest}
          />
        </div>
      </aside>

      <div
        id="sidebarContextMenu"
        className="hidden fixed min-w-[172px] bg-white dark:bg-surface-800 border border-ui-border dark:border-ui-borderDark rounded-md shadow-float dark:shadow-floatDark py-1 z-[140]"
      />

      <main className="flex-1 flex flex-col min-w-0 bg-white dark:bg-[#1e1e1e] transition-colors duration-200">
        <header className="h-[46px] border-b border-ui-border dark:border-ui-borderDark flex items-center justify-between px-4 bg-white dark:bg-surface-900 z-20">
          <div className="flex items-center space-x-2 relative">
            <button
              id="envDropdownBtn"
              className="flex items-center text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white bg-surface-100 dark:bg-surface-800 px-2.5 py-1 rounded cursor-pointer transition-colors font-medium"
              onClick={() => setEnvMenuOpen((v) => !v)}
              type="button"
            >
              <div className={clsx('w-2 h-2 rounded-full mr-2', envToneDot(activeEnv?.name || ''))} />
              {activeEnv?.name || 'Development'}
              <i className="fa-solid fa-chevron-down ml-2 text-[10px] opacity-50" />
            </button>
            <div
              id="envDropdownMenu"
              className={clsx(
                'absolute top-9 left-0 w-full bg-white dark:bg-surface-800 border border-ui-border dark:border-ui-borderDark rounded-md shadow-float dark:shadow-floatDark py-1 z-50',
                envMenuOpen ? '' : 'hidden'
              )}
            >
              {envs.map((e) => (
                <div
                  key={e.id}
                  className="px-3 py-1.5 hover:bg-surface-100 dark:hover:bg-surface-900 cursor-pointer flex items-center text-gray-800 dark:text-gray-200"
                  onClick={() => {
                    setEnvMenuOpen(false)
                    changeActiveEnv(e.id)
                  }}
                >
                  <div className={clsx('w-2 h-2 rounded-full mr-2', envToneDot(e.name))} /> {e.name}
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              id="themeToggleBtn"
              className="w-7 h-7 flex items-center justify-center rounded text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
              onClick={toggleTheme}
              type="button"
              title="Toggle theme"
            >
              <i id="themeIcon" className={clsx('fa-solid text-[14px]', resolvedTheme === 'dark' ? 'fa-sun' : 'fa-moon')} />
            </button>
            <button
              id="settingsBtn"
              className="w-7 h-7 flex items-center justify-center rounded text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
              onClick={() => {
                setSettingsDraft(
                  settings
                    ? { ...settings }
                    : { theme: 'system', language: 'zh', requestTimeoutMs: 10000, autoSave: true }
                )
                setSettingsOpen(true)
              }}
              type="button"
              title="Preferences"
            >
              <i className="fa-solid fa-gear text-[14px]" />
            </button>
          </div>
        </header>

        <div className="p-4 pb-3">
          <div className="flex items-stretch gap-2">
            <div className="flex flex-1 items-stretch border border-ui-border dark:border-ui-borderDark rounded-md shadow-subtle focus-within:border-ui-primary dark:focus-within:border-ui-primary focus-within:ring-2 focus-within:ring-ui-primary/20 transition-all bg-white dark:bg-surface-800/50 h-[38px] min-w-0">
              <div className="relative flex items-center border-r border-ui-border dark:border-ui-borderDark rounded-l-md px-1">
                <div id="methodDropdownRoot" className="relative">
                  <button
                    type="button"
                    className="flex items-center w-[104px] h-[30px] px-3 rounded cursor-pointer transition-colors hover:bg-surface-100 dark:hover:bg-surface-800"
                    onClick={() => setMethodMenuOpen((v) => !v)}
                    disabled={!req}
                  >
                    <span className={clsx(methodToneClass(req?.method || 'GET'), 'font-mono font-bold')}>
                      {(req?.method || 'GET').toUpperCase()}
                    </span>
                    <i
                      className={clsx(
                        'fa-solid fa-chevron-down ml-auto text-[10px] text-gray-400 transition-transform duration-200',
                        methodMenuOpen ? 'rotate-180' : ''
                      )}
                    />
                  </button>
                  <div className={clsx('custom-dropdown-menu w-full', methodMenuOpen ? '' : 'hidden')}>
                    {(['GET', 'POST', 'PUT', 'DELETE', 'PATCH'] as const).map((m) => (
                      <button
                        key={m}
                        type="button"
                        className="custom-dropdown-item"
                        onClick={() => {
                          setMethodMenuOpen(false)
                          updateReq((r) => ({ ...r, method: m }))
                        }}
                      >
                        <span className={clsx('inline-flex h-2 w-2 rounded-full mr-2', methodToneDotClass(m))} />
                        <span className={clsx('font-mono font-semibold text-[11px]', methodToneClass(m))}>{m}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <input
                ref={urlInputRef}
                type="text"
                value={urlText}
                onChange={(e) => setUrlText(e.target.value)}
                onBlur={() => {
                  if (!req) return
                  updateReq((r) => applyUrlTextToRequest(r, urlText, activeEnv))
                }}
                placeholder="Enter request URL"
                className="flex-1 min-w-0 bg-transparent px-3 text-gray-900 dark:text-gray-100 font-mono text-[13px]"
                disabled={!req}
              />
            </div>

            <button
              className={clsx(
                'h-[38px] shrink-0 text-white font-medium px-5 transition-colors flex items-center rounded-md shadow-subtle',
                sending ? 'bg-gray-400 cursor-not-allowed' : 'bg-ui-primary hover:bg-ui-primaryHover'
              )}
              onClick={send}
              disabled={!req || sending}
              type="button"
            >
              <i className="fa-solid fa-paper-plane mr-1.5 text-[12px] opacity-90" /> Send
            </button>
            <button
              className={clsx(
                'h-[38px] shrink-0 border border-ui-border dark:border-ui-borderDark bg-surface-100 hover:bg-surface-200 dark:bg-surface-800 dark:hover:bg-surface-700 text-gray-700 dark:text-gray-200 font-medium px-4 transition-colors flex items-center rounded-md',
                saving ? 'opacity-70 cursor-not-allowed' : ''
              )}
              onClick={saveNow}
              disabled={!req || saving}
              type="button"
            >
              <i className="fa-regular fa-floppy-disk mr-1.5 text-[12px] opacity-70" /> Save
            </button>
          </div>
        </div>

        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Upper: request config */}
          <div className="flex-1 flex flex-col min-h-[150px]">
            <div className="flex px-4 border-b border-ui-border dark:border-ui-borderDark bg-white dark:bg-[#1e1e1e]">
              <div className="flex space-x-6 relative">
                <button
                  type="button"
                  className={clsx(
                    'req-tab-btn pb-2 pt-1 font-medium relative after:absolute after:bottom-0 after:left-0 after:w-full after:h-[2px] after:rounded-t-sm transition-colors',
                    reqTab === 'params'
                      ? 'active text-ui-primary after:bg-ui-primary'
                      : 'text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 after:bg-transparent'
                  )}
                  onClick={() => setReqTab('params')}
                >
                  Params
                </button>
                <button
                  type="button"
                  className={clsx(
                    'req-tab-btn pb-2 pt-1 font-medium relative after:absolute after:bottom-0 after:left-0 after:w-full after:h-[2px] after:rounded-t-sm transition-colors',
                    reqTab === 'headers'
                      ? 'active text-ui-primary after:bg-ui-primary'
                      : 'text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 after:bg-transparent'
                  )}
                  onClick={() => setReqTab('headers')}
                >
                  Headers{' '}
                  <span className="ml-1 text-[11px] px-1.5 py-0.5 rounded-full bg-surface-100 dark:bg-surface-800 text-gray-500">
                    {req?.headers?.length ?? 0}
                  </span>
                </button>
                <button
                  type="button"
                  className={clsx(
                    'req-tab-btn pb-2 pt-1 font-medium relative after:absolute after:bottom-0 after:left-0 after:w-full after:h-[2px] after:rounded-t-sm transition-colors',
                    reqTab === 'body'
                      ? 'active text-ui-primary after:bg-ui-primary'
                      : 'text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 after:bg-transparent'
                  )}
                  onClick={() => setReqTab('body')}
                >
                  Body
                </button>
                <button
                  type="button"
                  className={clsx(
                    'req-tab-btn pb-2 pt-1 font-medium relative after:absolute after:bottom-0 after:left-0 after:w-full after:h-[2px] after:rounded-t-sm transition-colors',
                    reqTab === 'auth'
                      ? 'active text-ui-primary after:bg-ui-primary'
                      : 'text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 after:bg-transparent'
                  )}
                  onClick={() => setReqTab('auth')}
                >
                  Auth
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto bg-white dark:bg-[#1e1e1e] p-4">
              <div
                id="req-params"
                className={clsx(
                  'req-tab-content h-full min-h-0 flex-col overflow-hidden',
                  reqTab === 'params' ? 'flex' : 'hidden'
                )}
                data-display="flex"
              >
                <KVFlexTable
                  idPrefix="params"
                  resetKey={req?.id ?? ''}
                  rows={req?.queryParams ?? []}
                  onChange={(rows) => updateReq((r) => ({ ...r, queryParams: rows }))}
                />
              </div>

              <div
                id="req-headers"
                className={clsx(
                  'req-tab-content h-full min-h-0 flex-col overflow-hidden',
                  reqTab === 'headers' ? 'flex' : 'hidden'
                )}
                data-display="flex"
              >
                <KVFlexTable
                  idPrefix="headers"
                  resetKey={req?.id ?? ''}
                  rows={req?.headers ?? []}
                  onChange={(rows) => updateReq((r) => ({ ...r, headers: rows }))}
                />
              </div>

              <div
                id="req-body"
                className={clsx('req-tab-content h-full flex-col', reqTab === 'body' ? 'flex' : 'hidden')}
                data-display="flex"
              >
                <BodyTemplateEditor
                  body={req?.body}
                  onChange={(body) => updateReq((r) => ({ ...r, body }))}
                />
              </div>

              <div
                id="req-auth"
                className={clsx('req-tab-content h-full', reqTab === 'auth' ? 'block' : 'hidden')}
                data-display="flex"
              >
                <AuthTemplateEditor
                  auth={req?.auth}
                  onChange={(auth) => updateReq((r) => ({ ...r, auth }))}
                />
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className="h-[1px] bg-ui-border dark:bg-ui-borderDark relative cursor-row-resize hover:bg-ui-primary dark:hover:bg-ui-primary transition-colors z-10">
            <div className="absolute -top-1 -bottom-1 left-0 right-0" />
          </div>

          {/* Lower: response */}
          <div className="flex-1 flex flex-col min-h-[150px] bg-white dark:bg-surface-950">
            <div className="flex items-center justify-between px-4 border-b border-ui-border dark:border-ui-borderDark bg-surface-50/50 dark:bg-[#1e1e1e]">
              <div className="flex space-x-6 relative">
                <button
                  type="button"
                  className={clsx(
                    'res-tab-btn pb-2 pt-2 font-medium relative after:absolute after:bottom-0 after:left-0 after:w-full after:h-[2px] after:rounded-t-sm',
                    resTab === 'body'
                      ? 'active text-ui-primary after:bg-ui-primary'
                      : 'text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 after:bg-transparent'
                  )}
                  onClick={() => setResTab('body')}
                >
                  Response
                </button>
                <button
                  type="button"
                  className={clsx(
                    'res-tab-btn pb-2 pt-2 font-medium relative after:absolute after:bottom-0 after:left-0 after:w-full after:h-[2px] after:rounded-t-sm',
                    resTab === 'headers'
                      ? 'active text-ui-primary after:bg-ui-primary'
                      : 'text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 after:bg-transparent'
                  )}
                  onClick={() => setResTab('headers')}
                >
                  Headers <span className="ml-1 text-[11px] text-gray-400">{headerCount(response?.headers)}</span>
                </button>
                <button
                  type="button"
                  className={clsx(
                    'res-tab-btn pb-2 pt-2 font-medium relative after:absolute after:bottom-0 after:left-0 after:w-full after:h-[2px] after:rounded-t-sm',
                    resTab === 'cookies'
                      ? 'active text-ui-primary after:bg-ui-primary'
                      : 'text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 after:bg-transparent'
                  )}
                  onClick={() => setResTab('cookies')}
                >
                  Cookies <span className="ml-1 text-[11px] text-gray-400">{cookieCount(response?.headers)}</span>
                </button>
              </div>

              <div className="flex items-center space-x-4 font-mono text-[12px]">
                {response?.ok ? (
                  <>
                    <span className="text-gray-500 dark:text-gray-400">
                      Status:{' '}
                      <span className={clsx(statusToneClass(response.status), 'font-semibold ml-1')}>
                        {response.statusText || String(response.status)}
                      </span>
                    </span>
                    <span className="text-gray-500 dark:text-gray-400">
                      Time:{' '}
                      <span className={clsx(statusToneClass(response.status), 'font-semibold ml-1')}>
                        {response.durationMs} ms
                      </span>
                    </span>
                    <span className="text-gray-500 dark:text-gray-400">
                      Size:{' '}
                      <span className={clsx(statusToneClass(response.status), 'font-semibold ml-1')}>
                        {formatBytes(response.sizeBytes)}
                      </span>
                    </span>
                  </>
                ) : null}
              </div>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto p-4 relative group">
              {!response ? (
                <div className="text-[12px] text-gray-500 dark:text-gray-400">No response yet.</div>
              ) : !response.ok ? (
                <div className="text-[12px] text-red-600 dark:text-red-300">{response.error || 'Request failed.'}</div>
              ) : (
                <>
                  <div id="res-body" className={clsx('res-tab-content h-full', resTab === 'body' ? 'block' : 'hidden')}>
                    <div className="absolute right-4 top-4 flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        type="button"
                        className="w-6 h-6 rounded bg-surface-100 hover:bg-surface-200 dark:bg-surface-800 dark:hover:bg-surface-700 text-gray-500 dark:text-gray-300 flex items-center justify-center border border-ui-border dark:border-ui-borderDark"
                        title="Copy"
                        onClick={() => copyToClipboard(response.body ?? '')}
                      >
                        <i className="fa-regular fa-copy text-[11px]" />
                      </button>
                    </div>
                    <pre
                      className="font-mono text-[13px] leading-[1.6] overflow-x-auto pb-4"
                      dangerouslySetInnerHTML={{ __html: renderBodyAsHtml(response.body ?? '') }}
                    />
                  </div>

                  <div id="res-headers" className={clsx('res-tab-content min-h-full', resTab === 'headers' ? 'block' : 'hidden')}>
                    <HeadersTemplateView headers={response.headers ?? {}} />
                  </div>

                  <div id="res-cookies" className={clsx('res-tab-content min-h-full', resTab === 'cookies' ? 'block' : 'hidden')}>
                    <CookiesTemplateView headers={response.headers ?? {}} />
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Settings modal (template-inspired) */}
      <div
        id="settingsModalOverlay"
        className={clsx(
          'fixed inset-0 bg-gray-900/20 dark:bg-black/40 backdrop-blur-sm z-50 hidden flex items-center justify-center opacity-0 transition-opacity duration-200',
          settingsOpen ? 'flex opacity-100' : 'hidden opacity-0'
        )}
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) setSettingsOpen(false)
        }}
      >
        <div
          id="settingsModalBox"
          className="bg-white dark:bg-[#1e1e1e] w-full max-w-2xl rounded-xl shadow-float dark:shadow-floatDark border border-ui-border dark:border-[#333] flex flex-col overflow-hidden transform scale-100 transition-transform duration-200"
        >
          <div className="flex justify-between items-center px-5 py-3 border-b border-ui-border dark:border-ui-borderDark bg-surface-50 dark:bg-surface-900">
            <h2 className="font-semibold text-gray-800 dark:text-gray-100">Preferences</h2>
            <button
              id="closeSettingsBtn"
              className="w-8 h-8 rounded-md flex items-center justify-center text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
              onClick={() => setSettingsOpen(false)}
              type="button"
              title="Close"
            >
              <i className="fa-solid fa-xmark" />
            </button>
          </div>

          <div className="flex min-h-0">
            <div className="w-52 border-r border-ui-border dark:border-ui-borderDark p-4 bg-surface-50 dark:bg-surface-900">
              <div className="flex flex-col space-y-1">
                <div className="px-3 py-1.5 text-ui-primary font-medium bg-ui-primary/10 rounded-md cursor-pointer text-[13px]">
                  General
                </div>
                <div className="px-3 py-1.5 text-gray-600 dark:text-gray-400 hover:bg-surface-200 dark:hover:bg-surface-800 rounded-md cursor-pointer text-[13px]">
                  Appearance
                </div>
                <div className="px-3 py-1.5 text-gray-600 dark:text-gray-400 hover:bg-surface-200 dark:hover:bg-surface-800 rounded-md cursor-pointer text-[13px]">
                  Data
                </div>
              </div>
            </div>

            <div className="flex-1 p-6 overflow-y-auto">
              <div className="mb-5">
                <label className="block text-gray-700 dark:text-gray-300 font-medium mb-1.5 text-[12px]">
                  Request Timeout (ms)
                </label>
                <input
                  type="number"
                  value={settingsDraft?.requestTimeoutMs ?? settings?.requestTimeoutMs ?? 10000}
                  onChange={(e) =>
                    setSettingsDraft((prev) => {
                      const base = prev ?? (settings ? { ...settings } : null)
                      if (!base) return prev
                      return { ...base, requestTimeoutMs: Number(e.target.value || 0) }
                    })
                  }
                  className="w-full bg-surface-50 dark:bg-surface-900 border border-ui-border dark:border-[#333] rounded-md px-3 py-1.5 text-gray-800 dark:text-gray-200 focus:border-ui-primary dark:focus:border-ui-primary focus:ring-2 focus:ring-ui-primary/20 transition-all outline-none font-mono"
                />
              </div>

              <div className="mb-5">
                <label className="block text-gray-700 dark:text-gray-300 font-medium mb-1.5 text-[12px]">Theme</label>
                <select
                  value={settingsDraft?.theme ?? settings?.theme ?? 'system'}
                  onChange={(e) =>
                    setSettingsDraft((prev) => {
                      const base = prev ?? (settings ? { ...settings } : null)
                      if (!base) return prev
                      return { ...base, theme: e.target.value as Theme }
                    })
                  }
                  className="w-full bg-surface-50 dark:bg-surface-900 border border-ui-border dark:border-[#333] rounded-md px-3 py-1.5 text-gray-800 dark:text-gray-200 focus:border-ui-primary dark:focus:border-ui-primary focus:ring-2 focus:ring-ui-primary/20 transition-all outline-none"
                >
                  <option value="system">System</option>
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                </select>
              </div>

              <div className="mb-5">
                <label className="block text-gray-700 dark:text-gray-300 font-medium mb-1.5 text-[12px]">Language</label>
                <select
                  value={settingsDraft?.language ?? settings?.language ?? 'zh'}
                  onChange={(e) =>
                    setSettingsDraft((prev) => {
                      const base = prev ?? (settings ? { ...settings } : null)
                      if (!base) return prev
                      return { ...base, language: e.target.value as 'zh' | 'en' }
                    })
                  }
                  className="w-full bg-surface-50 dark:bg-surface-900 border border-ui-border dark:border-[#333] rounded-md px-3 py-1.5 text-gray-800 dark:text-gray-200 focus:border-ui-primary dark:focus:border-ui-primary focus:ring-2 focus:ring-ui-primary/20 transition-all outline-none"
                >
                  <option value="zh">中文</option>
                  <option value="en">English</option>
                </select>
              </div>

              <div className="mb-5">
                <label className="flex items-center cursor-pointer group">
                  <div className="relative flex items-center justify-center w-4 h-4 mr-2">
                    <input
                      type="checkbox"
                      checked={settingsDraft?.autoSave ?? settings?.autoSave ?? true}
                      onChange={(e) =>
                        setSettingsDraft((prev) => {
                          const base = prev ?? (settings ? { ...settings } : null)
                          if (!base) return prev
                          return { ...base, autoSave: e.target.checked }
                        })
                      }
                      className="peer appearance-none w-4 h-4 border border-gray-300 dark:border-[#555] rounded-[3px] checked:bg-ui-primary checked:border-ui-primary transition-colors cursor-pointer"
                    />
                    <i className="fa-solid fa-check absolute text-white text-[10px] opacity-0 peer-checked:opacity-100 pointer-events-none" />
                  </div>
                  <span className="text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white transition-colors">
                    Auto-save requests
                  </span>
                </label>
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-ui-border dark:border-ui-borderDark">
                <button
                  type="button"
                  className="px-3 py-1.5 border border-ui-border dark:border-ui-borderDark rounded-md hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors font-medium"
                  onClick={importPostman}
                >
                  Import Postman
                </button>
                <button
                  type="button"
                  className="px-3 py-1.5 border border-ui-border dark:border-ui-borderDark rounded-md hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors font-medium"
                  onClick={exportPostman}
                  disabled={!activeProjectId}
                >
                  Export Postman
                </button>
                <button
                  type="button"
                  className="px-3 py-1.5 border border-ui-border dark:border-ui-borderDark rounded-md hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors font-medium"
                  onClick={exportOpenAPI}
                  disabled={!activeProjectId}
                >
                  Export OpenAPI
                </button>
              </div>

              {errorMsg ? <div className="mt-4 text-[12px] text-red-600 dark:text-red-300">{errorMsg}</div> : null}
            </div>
          </div>

          <div className="px-5 py-3 border-t border-ui-border dark:border-ui-borderDark flex justify-end bg-surface-50 dark:bg-surface-900 gap-2">
            <button
              id="cancelSettingsBtn"
              className="px-4 py-1.5 text-gray-600 dark:text-gray-300 hover:bg-surface-200 dark:hover:bg-surface-800 rounded-md transition-colors font-medium"
              onClick={() => {
                setSettingsDraft(null)
                setSettingsOpen(false)
              }}
              type="button"
            >
              Cancel
            </button>
            <button
              className="px-4 py-1.5 bg-ui-primary hover:bg-ui-primaryHover text-white rounded-md transition-colors shadow-sm font-medium"
              type="button"
              onClick={saveSettingsDraft}
            >
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function envToneDot(name: string): string {
  const n = (name || '').toLowerCase()
  if (n.includes('stag')) return 'bg-http-post'
  if (n.includes('prod')) return 'bg-http-delete'
  return 'bg-http-get'
}

function methodToneClass(method: string): string {
  const m = (method || '').toUpperCase()
  if (m === 'POST') return 'text-http-post'
  if (m === 'PUT') return 'text-http-put'
  if (m === 'DELETE') return 'text-http-delete'
  if (m === 'PATCH') return 'text-http-patch'
  return 'text-http-get'
}

function methodToneDotClass(method: string): string {
  const m = (method || '').toUpperCase()
  if (m === 'POST') return 'bg-http-post'
  if (m === 'PUT') return 'bg-http-put'
  if (m === 'DELETE') return 'bg-http-delete'
  if (m === 'PATCH') return 'bg-http-patch'
  return 'bg-http-get'
}

function statusToneClass(status: number): string {
  if (status >= 200 && status < 300) return 'text-http-get'
  if (status >= 400) return 'text-http-delete'
  return 'text-http-post'
}

function fingerprintURL(req: Request): string {
  return `${req.urlMode}|${req.urlFull}|${req.path}|${JSON.stringify(req.queryParams ?? [])}`
}

function computeDisplayURL(req: Request, env: Environment | null): string {
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

function computeBaseURL(req: Request, env: Environment | null): string {
  if (req.urlMode === 'basepath') {
    const base = env?.baseUrl?.trim()
    const p = (req.path || '/').trim()
    if (base) {
      try {
        const u = new URL(p, base)
        u.search = ''
        u.hash = ''
        return u.toString()
      } catch {
        // ignore
      }
    }
  }
  return (req.urlFull || '').trim()
}

function applyUrlTextToRequest(req: Request, urlText: string, env: Environment | null): Request {
  const trimmed = (urlText || '').trim()
  if (!trimmed) return req

  const prev = normalizeRequest(req)
  const prevByKey = new Map<string, KV>()
  for (const kv of prev.queryParams ?? []) {
    if (!kv.key) continue
    if (!prevByKey.has(kv.key)) prevByKey.set(kv.key, kv)
  }

  try {
    const u = trimmed.includes('://')
      ? new URL(trimmed)
      : env?.baseUrl?.trim()
        ? new URL(trimmed, env.baseUrl.trim())
        : (() => {
            throw new Error('relative without base')
          })()

    const nextQuery: KV[] = []
    u.searchParams.forEach((value, key) => {
      const prevRow = prevByKey.get(key)
      nextQuery.push({
        enabled: true,
        key,
        value,
        type: (prevRow?.type as KVType) || 'String',
        description: prevRow?.description || '',
      })
    })
    u.search = ''
    u.hash = ''
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

function filterTree(nodes: BootstrapData['tree'], q: string): BootstrapData['tree'] {
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
