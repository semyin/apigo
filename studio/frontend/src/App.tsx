import clsx from 'clsx'
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react'
import { useTranslation } from 'react-i18next'

import { backend } from './api/backend'
import type { BootstrapData, Environment, HistoryItem, KV, Request, SendResult, Settings } from './api/types'
import { TreeView } from './components/TreeView'
import { useToast } from './components/ToastProvider'
import { AuthTemplateEditor } from './components/template/AuthTemplateEditor'
import { BodyTemplateEditor } from './components/template/BodyTemplateEditor'
import { CookiesTemplateView, cookieCount } from './components/template/CookiesTemplateView'
import { useDropdown } from './components/template/DropdownContext'
import { HeadersTemplateView } from './components/template/HeadersTemplateView'
import { KVFlexTable } from './components/template/KVFlexTable'
import { copyToClipboard, headerCount, renderBodyAsHtml } from './components/template/responseFormat'
import { applyThemeClass, getStoredTheme, resolveTheme, storeTheme, type Theme } from './lib/theme'
import { formatBytes, normalizeRequest } from './lib/normalize'
import {
  applyUrlTextToRequest,
  computeBaseURL,
  computeDisplayURL,
  envToneDot,
  filterTree,
  fingerprintURL,
  flattenFolderOptions,
  findFirstRequestId,
  findNodeDepth,
  findNodeWithParentByNodeId,
  findNodeWithParentByRequestId,
  methodShort,
  methodToneClass,
  methodToneDotClass,
  sortEnvsForDisplay,
  statusToneClass,
} from './lib/studioUtils'
import { i18n } from './i18n'
import { RenameDialog } from './components/studio/RenameDialog'
import { SaveRequestDialog } from './components/studio/SaveRequestDialog'
import { NewFolderDialog } from './components/studio/NewFolderDialog'
import { ConfirmDialog } from './components/studio/ConfirmDialog'
import { SettingsDialog } from './components/studio/SettingsDialog'

type ReqTab = 'params' | 'headers' | 'body' | 'auth'
type ResTab = 'body' | 'headers' | 'cookies'

type SidebarContextKind = 'folder' | 'request' | 'blank' | 'history' | 'tab'
type SidebarContextMenu = {
  kind: SidebarContextKind
  nodeId: string | null
  requestId?: string
  historyId?: string
  left: number
  top: number
}

export default function App() {
  const toast = useToast()
  const dd = useDropdown()
  const { t } = useTranslation()

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
  const ensureDraftBusyRef = useRef(false)

  const tabsScrollRef = useRef<HTMLDivElement | null>(null)
  const urlInputRef = useRef<HTMLInputElement | null>(null)
  const [urlText, setUrlText] = useState('')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsDraft, setSettingsDraft] = useState<Settings | null>(null)
  const [envDrafts, setEnvDrafts] = useState<Environment[] | null>(null)

  const [sidebarFilter, setSidebarFilter] = useState('')

  const [ctxMenu, setCtxMenu] = useState<SidebarContextMenu | null>(null)
  const ctxMenuRef = useRef<HTMLDivElement | null>(null)

  const [renameOpen, setRenameOpen] = useState(false)
  const [renameNodeId, setRenameNodeId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const renameInputRef = useRef<HTMLInputElement | null>(null)

  const [openTabs, setOpenTabs] = useState<string[]>([])

  const [confirmBusy, setConfirmBusy] = useState(false)
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string
    message: string
    confirmLabel?: string
    danger?: boolean
    onConfirm: () => Promise<void> | void
  } | null>(null)

  const [saveDialogOpen, setSaveDialogOpen] = useState(false)
  const [saveDialogMode, setSaveDialogMode] = useState<'save' | 'saveAs'>('save')
  const [saveName, setSaveName] = useState('')
  const [saveParentId, setSaveParentId] = useState<string | null>(null)
  const [saveBusy, setSaveBusy] = useState(false)
  const saveNameInputRef = useRef<HTMLInputElement | null>(null)

  const [newFolderOpen, setNewFolderOpen] = useState(false)
  const [newFolderParentId, setNewFolderParentId] = useState<string | null>(null)
  const [newFolderName, setNewFolderName] = useState('New Folder')
  const [newFolderBusy, setNewFolderBusy] = useState(false)
  const newFolderNameInputRef = useRef<HTMLInputElement | null>(null)

  const [historyCollapsed, setHistoryCollapsed] = useState(false)
  const [history, setHistory] = useState<HistoryItem[]>([])

  const splitRootRef = useRef<HTMLDivElement | null>(null)
  const upperPaneRef = useRef<HTMLDivElement | null>(null)
  const [upperPx, setUpperPx] = useState<number | null>(null)

  const activeEnv = useMemo(
    () => envs.find((e) => e.id === activeEnvId) ?? null,
    [envs, activeEnvId]
  )

  const displayEnvs = useMemo(() => sortEnvsForDisplay(envs), [envs])

  useEffect(() => {
    if (!renameOpen) return
    requestAnimationFrame(() => {
      renameInputRef.current?.focus()
      renameInputRef.current?.select()
    })
  }, [renameOpen])

  useEffect(() => {
    if (!saveDialogOpen) return
    requestAnimationFrame(() => {
      saveNameInputRef.current?.focus()
      saveNameInputRef.current?.select()
    })
  }, [saveDialogOpen])

  useEffect(() => {
    if (!newFolderOpen) return
    requestAnimationFrame(() => {
      newFolderNameInputRef.current?.focus()
      newFolderNameInputRef.current?.select()
    })
  }, [newFolderOpen])

  useEffect(() => {
    if (!ctxMenu) return
    function close() {
      setCtxMenu(null)
    }

    function onMouseDown(e: MouseEvent) {
      const el = ctxMenuRef.current
      const target = e.target as Node | null
      if (el && target && el.contains(target)) return
      close()
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') close()
    }

    window.addEventListener('resize', close)
    window.addEventListener('scroll', close, true)
    document.addEventListener('mousedown', onMouseDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('resize', close)
      window.removeEventListener('scroll', close, true)
      document.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [ctxMenu])

  useLayoutEffect(() => {
    if (!ctxMenu) return
    const el = ctxMenuRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const padding = 12
    const left = Math.max(padding, Math.min(ctxMenu.left, window.innerWidth - rect.width - padding))
    const top = Math.max(padding, Math.min(ctxMenu.top, window.innerHeight - rect.height - padding))
    if (left === ctxMenu.left && top === ctxMenu.top) return
    setCtxMenu((prev) => (prev ? { ...prev, left, top } : prev))
  }, [ctxMenu?.kind, ctxMenu?.nodeId, ctxMenu?.left, ctxMenu?.top])

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
    setOpenTabs(data.selectedRequestId ? [data.selectedRequestId] : [])
    setCtxMenu(null)
    setResponse(null)

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

  useEffect(() => {
    if (!activeProjectId) return
    backend
      .listHistory(activeProjectId, 30)
      .then((items) => setHistory(items))
      .catch(() => {
        // Ignore history errors; the main UI should still work.
      })
  }, [activeProjectId])

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

  async function ensureDraftTab() {
    if (!activeProjectId) return
    if (ensureDraftBusyRef.current) return
    ensureDraftBusyRef.current = true
    setErrorMsg('')
    try {
      const created = await backend.createDraftRequest(activeProjectId)
      setSelectedRequestId(created.request.id)
      setOpenTabs([created.request.id])
      setReq(normalizeRequest(created.request))
      setDirty(false)
      setResponse(null)
      setReqTab('params')
    } catch (err: any) {
      setErrorMsg(String(err?.message ?? err))
    } finally {
      ensureDraftBusyRef.current = false
    }
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
      setOpenTabs((prev) => {
        if (!requestId) return prev
        if (prev.includes(requestId)) return prev
        return [...prev, requestId]
      })
      setReq(normalizeRequest(r))
      setDirty(false)
      setResponse(null)
    } catch (err: any) {
      setErrorMsg(String(err?.message ?? err))
    }
  }

  useEffect(() => {
    if (!activeProjectId) return
    if (openTabs.length) return
    void ensureDraftTab()
  }, [activeProjectId, openTabs.length])

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
      await refreshHistory()
    } catch (err: any) {
      setErrorMsg(String(err?.message ?? err))
    } finally {
      setSending(false)
    }
  }

  async function saveNow(): Promise<boolean> {
    if (!req) return false
    setErrorMsg('')
    const prepared = applyUrlTextToRequest(req, urlText, activeEnv)
    setSaving(true)
    try {
      await backend.saveRequest(prepared)
      setReq(prepared)
      setDirty(false)
      return true
    } catch (err: any) {
      setErrorMsg(String(err?.message ?? err))
      return false
    } finally {
      setSaving(false)
    }
  }

  async function saveFromToolbar() {
    if (!req) return
    dd.close()
    setCtxMenu(null)

    const saved = !!findNodeWithParentByRequestId(tree, req.id)
    if (!saved) {
      openSaveDialog('save')
      return
    }

    const ok = await saveNow()
    if (ok) {
      toast.show(t('saved'), 'success')
      void refreshTree()
    }
  }

  function closeAllTabsNow() {
    setOpenTabs([])
    setSelectedRequestId('')
    setReq(null)
    setResponse(null)
    setDirty(false)
  }

  function closeAllTabs() {
    dd.close()
    setCtxMenu(null)

    if (selectedRequestId && dirty && settings?.autoSave === false) {
      setConfirmDialog({
        title: t('unsavedChangesTitle'),
        message: t('unsavedChangesCloseAll'),
        confirmLabel: t('saveAndClose'),
        danger: false,
        onConfirm: async () => {
          await saveNow()
          closeAllTabsNow()
        },
      })
      return
    }

    closeAllTabsNow()
  }

  function isTabSaved(requestId: string): boolean {
    const saved = !!findNodeWithParentByRequestId(tree, requestId)
    if (!saved) return false
    if (requestId === selectedRequestId) return !dirty
    return true
  }

  async function closeSavedTabs() {
    dd.close()
    setCtxMenu(null)

    if (!openTabs.length) return
    const savedIds = openTabs.filter((id) => isTabSaved(id))
    if (!savedIds.length) return

    const remaining = openTabs.filter((id) => !savedIds.includes(id))
    setOpenTabs(remaining)

    if (!remaining.length) {
      setSelectedRequestId('')
      setReq(null)
      setResponse(null)
      setDirty(false)
      return
    }

    if (!remaining.includes(selectedRequestId)) {
      try {
        await loadRequestInPlace(remaining[0])
      } catch (err: any) {
        toast.show(String(err?.message ?? err), 'error')
      }
    }
  }

  async function closeOtherTabs(targetRequestId: string) {
    if (!targetRequestId) return
    dd.close()
    setCtxMenu(null)

    const doClose = async () => {
      if (targetRequestId !== selectedRequestId) await loadRequestInPlace(targetRequestId)
      setOpenTabs([targetRequestId])
    }

    if (targetRequestId !== selectedRequestId && dirty && settings?.autoSave === false) {
      setConfirmDialog({
        title: t('unsavedChangesTitle'),
        message: t('unsavedChangesCloseOthers'),
        confirmLabel: t('saveAndCloseOthers'),
        danger: false,
        onConfirm: async () => {
          const ok = await saveNow()
          if (!ok) return
          try {
            await doClose()
          } catch (err: any) {
            toast.show(String(err?.message ?? err), 'error')
            setOpenTabs([])
            setSelectedRequestId('')
            setReq(null)
            setResponse(null)
            setDirty(false)
          }
        },
      })
      return
    }

    try {
      await doClose()
    } catch (err: any) {
      toast.show(String(err?.message ?? err), 'error')
      setOpenTabs([])
      setSelectedRequestId('')
      setReq(null)
      setResponse(null)
      setDirty(false)
    }
  }

  async function refreshTree() {
    if (!activeProjectId) return []
    const next = await backend.getTree(activeProjectId)
    setTree(next)
    return next
  }

  async function refreshHistory() {
    if (!activeProjectId) return []
    const items = await backend.listHistory(activeProjectId, 30)
    setHistory(items)
    return items
  }

  function deleteHistoryById(historyId: string) {
    if (!historyId) return
    dd.close()
    setCtxMenu(null)
    setConfirmDialog({
      title: t('deleteHistoryTitle'),
      message: t('deleteHistoryMessage'),
      confirmLabel: t('delete'),
      danger: true,
      onConfirm: async () => {
        setErrorMsg('')
        await backend.deleteHistory(historyId)
        await refreshHistory()
        toast.show(t('deleted'), 'success')
      },
    })
  }

  async function loadRequestInPlace(requestId: string) {
    if (!requestId) return
    const r = await backend.getRequest(requestId)
    setSelectedRequestId(requestId)
    setOpenTabs((prev) => {
      if (!requestId) return prev
      if (prev.includes(requestId)) return prev
      return [...prev, requestId]
    })
    setReq(normalizeRequest(r))
    setDirty(false)
    setResponse(null)
  }

  function openSidebarContextMenu(args: {
    kind: Exclude<SidebarContextKind, 'blank' | 'history' | 'tab'>
    nodeId: string
    requestId?: string
    clientX: number
    clientY: number
  }) {
    dd.close()
    setCtxMenu({
      kind: args.kind,
      nodeId: args.nodeId,
      requestId: args.requestId,
      left: args.clientX,
      top: args.clientY,
    })
  }

  function openBlankContextMenu(clientX: number, clientY: number) {
    dd.close()
    setCtxMenu({ kind: 'blank', nodeId: null, left: clientX, top: clientY })
  }

  function openHistoryContextMenu(historyId: string, clientX: number, clientY: number) {
    dd.close()
    setCtxMenu({ kind: 'history', nodeId: null, historyId, left: clientX, top: clientY })
  }

  function openTabContextMenu(requestId: string, clientX: number, clientY: number) {
    dd.close()
    setCtxMenu({ kind: 'tab', nodeId: null, requestId, left: clientX, top: clientY })
  }

  function openRenameDialog(nodeId: string) {
    dd.close()
    setCtxMenu(null)
    const found = findNodeWithParentByNodeId(tree, nodeId)
    setRenameNodeId(nodeId)
    setRenameValue(found?.node.name ?? '')
    setRenameOpen(true)
  }

  function openNewFolderDialog(parentId: string | null) {
    if (!activeProjectId) return
    dd.close()
    setCtxMenu(null)

    if (parentId) {
      const d = findNodeDepth(tree, parentId)
      if (d >= 4) {
        toast.show(t('maxFolderDepthIs4'), 'error')
        return
      }
    }

    setNewFolderParentId(parentId)
    setNewFolderName(t('newFolder'))
    setNewFolderOpen(true)
  }

  async function confirmNewFolder() {
    if (!activeProjectId) return
    const name = newFolderName.trim()
    if (!name) {
      toast.show(t('nameRequired'), 'error')
      return
    }

    const parentId = newFolderParentId
    if (parentId) {
      const d = findNodeDepth(tree, parentId)
      if (d >= 4) {
        toast.show(t('maxFolderDepthIs4'), 'error')
        return
      }
    }

    setErrorMsg('')
    setNewFolderBusy(true)
    try {
      await backend.createFolder(activeProjectId, parentId, name)
      setNewFolderOpen(false)
      setNewFolderParentId(null)
      if (parentId) setCollapsed((p) => ({ ...p, [parentId]: false }))
      await refreshTree()
      toast.show(t('folderCreated'), 'success')
    } catch (err: any) {
      setErrorMsg(String(err?.message ?? err))
    } finally {
      setNewFolderBusy(false)
    }
  }

  async function confirmRename() {
    const nodeId = renameNodeId
    const name = renameValue.trim()
    if (!nodeId) return
    if (!name) {
      toast.show(t('nameRequired'), 'error')
      return
    }

    setErrorMsg('')
    try {
      await backend.renameNode(nodeId, name)
      setRenameOpen(false)
      setRenameNodeId(null)
      setCtxMenu(null)
      await refreshTree()
      toast.show(t('renamed'), 'success')
    } catch (err: any) {
      setErrorMsg(String(err?.message ?? err))
    }
  }

  function deleteNodeById(nodeId: string) {
    if (!nodeId) return
    dd.close()
    setConfirmDialog({
      title: t('deleteTitle'),
      message: t('deleteMessage'),
      confirmLabel: t('delete'),
      danger: true,
      onConfirm: async () => {
        setErrorMsg('')
        await backend.deleteNode(nodeId)
        setCtxMenu(null)
        const nextTree = await refreshTree()
        await refreshHistory()
        // If the current selection was deleted (or was inside a deleted folder), pick the first remaining request.
        if (selectedRequestId && findNodeWithParentByRequestId(nextTree, selectedRequestId)) {
          toast.show(t('deleted'), 'success')
          return
        }
        const first = findFirstRequestId(nextTree)
        if (first) await loadRequestInPlace(first)
        else {
          setSelectedRequestId('')
          setReq(null)
          setResponse(null)
          setDirty(false)
          setOpenTabs([])
        }
        toast.show(t('deleted'), 'success')
      },
    })
  }

  async function addRequestUnderFolder(folderNodeId: string) {
    if (!activeProjectId) return
    setErrorMsg('')
    try {
      const created = await backend.createRequest(activeProjectId, folderNodeId, t('newRequest'))
      setCtxMenu(null)
      const nextTree = await refreshTree()
      setCollapsed((p) => ({ ...p, [folderNodeId]: false }))
      setSelectedRequestId(created.request.id)
      setOpenTabs((prev) => (prev.includes(created.request.id) ? prev : [...prev, created.request.id]))
      setReq(normalizeRequest(created.request))
      setDirty(false)
      setResponse(null)
      setReqTab('params')
      // Ensure the new request exists in tree (best-effort).
      if (!findNodeWithParentByRequestId(nextTree, created.request.id)) {
        await refreshTree()
      }
    } catch (err: any) {
      setErrorMsg(String(err?.message ?? err))
    }
  }

  async function duplicateRequestById(requestId: string) {
    if (!activeProjectId) return
    if (!requestId) return
    setErrorMsg('')
    try {
      const created = await backend.duplicateRequest(requestId)
      setCtxMenu(null)
      await refreshTree()
      setSelectedRequestId(created.request.id)
      setOpenTabs((prev) => (prev.includes(created.request.id) ? prev : [...prev, created.request.id]))
      setReq(normalizeRequest(created.request))
      setDirty(false)
      setResponse(null)
      toast.show(t('duplicated'), 'success')
    } catch (err: any) {
      setErrorMsg(String(err?.message ?? err))
    }
  }

  async function addRequestFromTabs() {
    if (!activeProjectId) return
    setErrorMsg('')
    dd.close()
    setCtxMenu(null)
    try {
      const parentId =
        selectedRequestId ? findNodeWithParentByRequestId(tree, selectedRequestId)?.parentId ?? null : null
      const created = await backend.createRequest(activeProjectId, parentId, t('newRequest'))
      if (parentId) setCollapsed((p) => ({ ...p, [parentId]: false }))
      const nextTree = await refreshTree()
      setSelectedRequestId(created.request.id)
      setOpenTabs((prev) => (prev.includes(created.request.id) ? prev : [...prev, created.request.id]))
      setReq(normalizeRequest(created.request))
      setDirty(false)
      setResponse(null)
      setReqTab('params')
      if (!findNodeWithParentByRequestId(nextTree, created.request.id)) {
        await refreshTree()
      }
    } catch (err: any) {
      setErrorMsg(String(err?.message ?? err))
    }
  }

  async function closeTabNow(requestId: string) {
    if (!requestId) return
    if (!openTabs.includes(requestId)) return

    const tabs = openTabs.slice()
    const idx = tabs.indexOf(requestId)
    const nextTabs = tabs.filter((t) => t !== requestId)
    setOpenTabs(nextTabs)

    if (requestId !== selectedRequestId) return

    const nextId = nextTabs[idx] ?? nextTabs[idx - 1]
    if (nextId) await loadRequestInPlace(nextId)
    else {
      setSelectedRequestId('')
      setReq(null)
      setResponse(null)
      setDirty(false)
    }
  }

  function closeTab(requestId: string) {
    if (!requestId) return
    dd.close()
    setCtxMenu(null)

    if (requestId === selectedRequestId && dirty && settings?.autoSave === false) {
      setConfirmDialog({
        title: t('unsavedChangesTitle'),
        message: t('unsavedChangesCloseTab'),
        confirmLabel: t('saveAndClose'),
        danger: false,
        onConfirm: async () => {
          await saveNow()
          await closeTabNow(requestId)
        },
      })
      return
    }

    void closeTabNow(requestId)
  }

  function openSaveDialog(mode: 'save' | 'saveAs') {
    if (!req) return
    dd.close()
    setCtxMenu(null)
    setSaveDialogMode(mode)
    const found = findNodeWithParentByNodeId(tree, req.nodeId)
    const baseName = found?.node.name ?? t('newRequest')
    setSaveName(mode === 'saveAs' ? `${baseName} Copy` : baseName)
    setSaveParentId(found?.parentId ?? null)
    setSaveDialogOpen(true)
  }

  function onTabsWheel(e: React.WheelEvent<HTMLDivElement>) {
    const el = tabsScrollRef.current
    if (!el) return
    if (el.scrollWidth <= el.clientWidth) return

    // Translate vertical wheel into horizontal scroll, similar to Chrome's tab strip.
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      el.scrollLeft += e.deltaY
      e.preventDefault()
    }
  }

  async function confirmSaveDialog() {
    if (!req) return
    const name = saveName.trim()
    if (!name) {
      toast.show(t('nameRequired'), 'error')
      return
    }
    if (!activeProjectId) return
    setErrorMsg('')
    setSaveBusy(true)
    const prepared = applyUrlTextToRequest(req, urlText, activeEnv)
    try {
      if (saveDialogMode === 'saveAs') {
        const created = await backend.createRequest(activeProjectId, saveParentId, name)
        const copy: Request = normalizeRequest({
          ...created.request,
          method: prepared.method,
          urlMode: prepared.urlMode,
          urlFull: prepared.urlFull,
          path: prepared.path,
          queryParams: prepared.queryParams,
          headers: prepared.headers,
          body: prepared.body,
          auth: prepared.auth,
          description: prepared.description,
          updatedAt: created.request.updatedAt,
        })
        await backend.saveRequest(copy)
        setSaveDialogOpen(false)
        if (saveParentId) setCollapsed((p) => ({ ...p, [saveParentId]: false }))
        await refreshTree()
        setSelectedRequestId(copy.id)
        setOpenTabs((prev) => (prev.includes(copy.id) ? prev : [...prev, copy.id]))
        setReq(copy)
        setDirty(false)
        setResponse(null)
        toast.show(t('savedAsNewRequest'), 'success')
      } else {
        const found = findNodeWithParentByNodeId(tree, req.nodeId)
        if (!found) {
          await backend.finalizeDraft(req.nodeId, saveParentId, name)
          await backend.saveRequest(prepared)
          setReq(prepared)
          setDirty(false)
          setSaveDialogOpen(false)
          if (saveParentId) setCollapsed((p) => ({ ...p, [saveParentId]: false }))
          await refreshTree()
          toast.show(t('saved'), 'success')
          return
        }
        const currentName = found?.node.name ?? ''
        const currentParent = found?.parentId ?? null
        if (currentName && currentName !== name) await backend.renameNode(req.nodeId, name)
        if (currentParent !== saveParentId) await backend.moveNode(req.nodeId, saveParentId)
        await backend.saveRequest(prepared)
        setReq(prepared)
        setDirty(false)
        setSaveDialogOpen(false)
        if (saveParentId) setCollapsed((p) => ({ ...p, [saveParentId]: false }))
        await refreshTree()
        toast.show(t('saved'), 'success')
      }
    } catch (err: any) {
      setErrorMsg(String(err?.message ?? err))
    } finally {
      setSaveBusy(false)
    }
  }

  function beginResizeRows(e: ReactMouseEvent<HTMLDivElement>) {
    const root = splitRootRef.current
    const upper = upperPaneRef.current
    if (!root || !upper) return

    const startY = e.clientY
    const rootRect = root.getBoundingClientRect()
    const upperRect = upper.getBoundingClientRect()
    const startUpper = upperRect.height
    const minUpper = 150
    const minLower = 150
    const divider = 1
    const maxUpper = Math.max(minUpper, rootRect.height - minLower - divider)

    document.body.classList.add('resizing-rows')
    e.preventDefault()

    function onMove(ev: MouseEvent) {
      const delta = ev.clientY - startY
      const next = Math.max(minUpper, Math.min(startUpper + delta, maxUpper))
      setUpperPx(next)
    }

    function onUp() {
      document.body.classList.remove('resizing-rows')
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }

    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
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
    if (!settingsDraft && !envDrafts) {
      setSettingsOpen(false)
      setEnvDrafts(null)
      return
    }
    setErrorMsg('')
    try {
      if (settingsDraft) await backend.saveSettings(settingsDraft)
      if (envDrafts) {
        if (!envDrafts.length) {
          toast.show(t('atLeastOneEnvironment'), 'error')
          return
        }

        const prevIds = envs.map((e) => e.id)
        const nextIds = envDrafts.map((e) => e.id)
        const deletedIds = prevIds.filter((id) => !nextIds.includes(id))

        for (const id of deletedIds) {
          await backend.deleteEnv(id)
        }

        const saved: Environment[] = []
        for (const e of envDrafts) {
          saved.push(await backend.saveEnv(e))
        }
        setEnvs(saved)

        // If the active environment was deleted (or missing), select the first remaining.
        if (activeProjectId && saved.length && !saved.some((e) => e.id === activeEnvId)) {
          const nextActive = saved[0].id
          setActiveEnvId(nextActive)
          try {
            await backend.setActiveEnv(activeProjectId, nextActive)
          } catch {
            // Non-fatal.
          }
        }
      }
    } catch (err: any) {
      setErrorMsg(String(err?.message ?? err))
      return
    }
    if (settingsDraft) setSettings(settingsDraft)
    setSettingsOpen(false)
    setEnvDrafts(null)

    // Apply immediately.
    if (settingsDraft) {
      setThemePref(settingsDraft.theme)
      storeTheme(settingsDraft.theme)
      const resolved = resolveTheme(settingsDraft.theme)
      setResolvedTheme(resolved)
      applyThemeClass(resolved)
      i18n.changeLanguage(settingsDraft.language)
    }
  }

  function addEnvironmentDraft() {
    if (!activeProjectId) return
    const c = (globalThis as any).crypto
    const id = c?.randomUUID ? c.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`

    setEnvDrafts((prev) => {
      const base = (prev ?? displayEnvs).map((x) => ({ ...x, vars: { ...(x.vars ?? {}) } }))
      base.push({
        id,
        projectId: activeProjectId,
        name: t('newEnvironment'),
        baseUrl: '',
        vars: {},
        updatedAt: Date.now(),
      })
      return base
    })
  }

  function requestDeleteEnvironmentDraft(envId: string) {
    dd.close()
    setCtxMenu(null)
    setConfirmDialog({
      title: t('deleteEnvironmentTitle'),
      message: t('deleteEnvironmentMessage'),
      confirmLabel: t('delete'),
      danger: true,
      onConfirm: () => {
        setEnvDrafts((prev) => {
          const base = (prev ?? displayEnvs).map((x) => ({ ...x, vars: { ...(x.vars ?? {}) } }))
          if (base.length <= 1) {
            toast.show(t('atLeastOneEnvironment'), 'error')
            return base
          }
          return base.filter((x) => x.id !== envId)
        })
      },
    })
  }

  async function runConfirmDialog() {
    if (!confirmDialog) return
    setConfirmBusy(true)
    try {
      await confirmDialog.onConfirm()
      setConfirmDialog(null)
    } catch (err: any) {
      toast.show(String(err?.message ?? err), 'error')
    } finally {
      setConfirmBusy(false)
    }
  }

  const filteredTree = useMemo(() => {
    const q = sidebarFilter.trim().toLowerCase()
    if (!q) return tree
    return filterTree(tree, q)
  }, [tree, sidebarFilter])

  const folderOptions = useMemo(() => flattenFolderOptions(tree), [tree])

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
              placeholder={t('searchPlaceholder')}
              className="bg-transparent w-full placeholder-gray-400 text-gray-800 dark:text-gray-200"
              value={sidebarFilter}
              onChange={(e) => setSidebarFilter(e.target.value)}
            />
          </div>
        </div>

        <div className="flex-1 min-h-0 flex flex-col">
          <div
            className="flex-1 overflow-y-auto px-2 pb-2 select-none scroll-gutter-stable"
            onContextMenu={(e) => {
              const target = e.target as HTMLElement | null
              if (target?.closest('[data-folder-row]') || target?.closest('[data-request-row]')) return
              e.preventDefault()
              e.stopPropagation()
              openBlankContextMenu(e.clientX, e.clientY)
            }}
          >
            <TreeView
              nodes={filteredTree}
              collapsed={collapsed}
              onToggleFolder={(id) => {
                setCtxMenu(null)
                setCollapsed((p) => ({ ...p, [id]: !(p[id] ?? false) }))
              }}
              selectedRequestId={selectedRequestId}
              onSelectRequest={(requestId) => {
                setCtxMenu(null)
                selectRequest(requestId)
              }}
              activeContextNodeId={ctxMenu?.nodeId}
              onContextMenu={openSidebarContextMenu}
            />
          </div>

          <div className="border-t border-ui-border dark:border-ui-borderDark px-2 py-2 bg-surface-50/50 dark:bg-surface-900/40">
            <button
              type="button"
              className="w-full flex items-center justify-between px-2 py-1.5 rounded-md hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors text-gray-700 dark:text-gray-200"
              onClick={() => setHistoryCollapsed((p) => !p)}
            >
              <div className="flex items-center font-medium">
                <i className="fa-solid fa-clock-rotate-left mr-2 text-[12px] text-gray-400" />
                {t('history')} <span className="ml-2 text-[11px] text-gray-400">{history.length}</span>
              </div>
              <i
                className={clsx(
                  'fa-solid fa-chevron-down text-[10px] text-gray-400 transition-transform duration-200',
                  historyCollapsed ? '' : 'rotate-180'
                )}
              />
            </button>

            <div
              className={clsx(
                'grid transition-[grid-template-rows] duration-200 ease-out',
                historyCollapsed ? 'grid-rows-[0fr]' : 'grid-rows-[1fr]'
              )}
            >
              <div className="overflow-hidden">
                <div className="mt-1 max-h-[220px] overflow-y-auto pr-1 space-y-0.5 scroll-gutter-stable">
                  {history.length ? (
                    history.map((h) => (
                      <button
                        key={h.id}
                        type="button"
                        className="w-full flex items-center px-2 py-1 rounded-md hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors text-left"
                        onClick={async () => {
                          setCtxMenu(null)
                          await selectRequest(h.requestId)
                          try {
                            const snap = await backend.getHistory(h.id)
                            setResponse(snap)
                            setResTab('body')
                          } catch (err: any) {
                            toast.show(String(err?.message ?? err), 'error')
                          }
                        }}
                        onContextMenu={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          openHistoryContextMenu(h.id, e.clientX, e.clientY)
                        }}
                        title={new Date(h.startedAt).toLocaleString()}
                      >
                        <span
                          className={clsx(methodToneClass(h.method), 'font-mono font-semibold text-[10px] w-8 shrink-0')}
                        >
                          {methodShort(h.method)}
                        </span>
                        <span className="truncate text-[12px]">{h.requestName || t('request')}</span>
                        <span
                          className={clsx(
                            'ml-auto pl-2 font-mono text-[10px] shrink-0',
                            h.ok ? statusToneClass(h.status) : 'text-red-600 dark:text-red-400'
                          )}
                        >
                          {h.status ? h.status : 'ERR'} {h.durationMs ? `${h.durationMs}ms` : ''}
                        </span>
                      </button>
                    ))
                  ) : (
                    <div className="px-2 py-2 text-[12px] text-gray-400">{t('noHistoryYet')}</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </aside>

      <div
        id="sidebarContextMenu"
        ref={ctxMenuRef}
        className={clsx(
          'fixed min-w-[172px] bg-white dark:bg-surface-800 border border-ui-border dark:border-ui-borderDark rounded-md shadow-float dark:shadow-floatDark py-1 z-[140]',
          ctxMenu ? '' : 'hidden'
        )}
        style={ctxMenu ? { left: ctxMenu.left, top: ctxMenu.top } : undefined}
      >
        {ctxMenu?.kind === 'blank' ? (
          <>
            <button
              type="button"
              className="w-full flex items-center px-3 py-1.5 text-left text-gray-800 dark:text-gray-200 hover:bg-surface-100 dark:hover:bg-surface-900 transition-colors"
              onClick={() => openNewFolderDialog(null)}
            >
              <i className="fa-regular fa-folder mr-2 text-[11px] text-gray-400" /> {t('newFolder')}
            </button>
          </>
        ) : ctxMenu?.kind === 'folder' && ctxMenu.nodeId ? (
          <>
            <button
              type="button"
              className="w-full flex items-center px-3 py-1.5 text-left text-gray-800 dark:text-gray-200 hover:bg-surface-100 dark:hover:bg-surface-900 transition-colors"
              onClick={() => openNewFolderDialog(ctxMenu.nodeId)}
            >
              <i className="fa-solid fa-folder-plus mr-2 text-[11px] text-gray-400" /> {t('newFolder')}
            </button>
            <button
              type="button"
              className="w-full flex items-center px-3 py-1.5 text-left text-gray-800 dark:text-gray-200 hover:bg-surface-100 dark:hover:bg-surface-900 transition-colors"
              onClick={() => addRequestUnderFolder(ctxMenu.nodeId!)}
            >
              <i className="fa-solid fa-plus mr-2 text-[11px] text-gray-400" /> {t('newRequest')}
            </button>
            <button
              type="button"
              className="w-full flex items-center px-3 py-1.5 text-left text-gray-800 dark:text-gray-200 hover:bg-surface-100 dark:hover:bg-surface-900 transition-colors"
              onClick={() => openRenameDialog(ctxMenu.nodeId!)}
            >
              <i className="fa-solid fa-pen mr-2 text-[11px] text-gray-400" /> {t('rename')}
            </button>
            <button
              type="button"
              className="w-full flex items-center px-3 py-1.5 text-left text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
              onClick={() => deleteNodeById(ctxMenu.nodeId!)}
            >
              <i className="fa-solid fa-trash mr-2 text-[11px]" /> {t('delete')}
            </button>
          </>
        ) : ctxMenu?.kind === 'request' && ctxMenu.nodeId ? (
          <>
            <button
              type="button"
              className="w-full flex items-center px-3 py-1.5 text-left text-gray-800 dark:text-gray-200 hover:bg-surface-100 dark:hover:bg-surface-900 transition-colors"
              onClick={() => duplicateRequestById(ctxMenu.requestId ?? '')}
            >
              <i className="fa-solid fa-copy mr-2 text-[11px] text-gray-400" /> {t('duplicate')}
            </button>
            <button
              type="button"
              className="w-full flex items-center px-3 py-1.5 text-left text-gray-800 dark:text-gray-200 hover:bg-surface-100 dark:hover:bg-surface-900 transition-colors"
              onClick={() => openRenameDialog(ctxMenu.nodeId!)}
            >
              <i className="fa-solid fa-pen mr-2 text-[11px] text-gray-400" /> {t('rename')}
            </button>
            <button
              type="button"
              className="w-full flex items-center px-3 py-1.5 text-left text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
              onClick={() => deleteNodeById(ctxMenu.nodeId!)}
            >
              <i className="fa-solid fa-trash mr-2 text-[11px]" /> {t('delete')}
            </button>
          </>
        ) : ctxMenu?.kind === 'history' && ctxMenu.historyId ? (
          <>
            <button
              type="button"
              className="w-full flex items-center px-3 py-1.5 text-left text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
              onClick={() => deleteHistoryById(ctxMenu.historyId!)}
            >
              <i className="fa-solid fa-trash mr-2 text-[11px]" /> {t('delete')}
            </button>
          </>
        ) : ctxMenu?.kind === 'tab' && ctxMenu.requestId ? (
          <>
            <button
              type="button"
              className="w-full flex items-center px-3 py-1.5 text-left text-gray-800 dark:text-gray-200 hover:bg-surface-100 dark:hover:bg-surface-900 transition-colors"
              onClick={closeAllTabs}
            >
              <i className="fa-solid fa-rectangle-xmark mr-2 text-[11px] text-gray-400" /> {t('closeAll')}
            </button>
            <button
              type="button"
              className="w-full flex items-center px-3 py-1.5 text-left text-gray-800 dark:text-gray-200 hover:bg-surface-100 dark:hover:bg-surface-900 transition-colors"
              onClick={() => {
                void closeSavedTabs()
              }}
            >
              <i className="fa-solid fa-check mr-2 text-[11px] text-gray-400" /> {t('closeSaved')}
            </button>
            <button
              type="button"
              className="w-full flex items-center px-3 py-1.5 text-left text-gray-800 dark:text-gray-200 hover:bg-surface-100 dark:hover:bg-surface-900 transition-colors"
              onClick={() => {
                void closeOtherTabs(ctxMenu.requestId!)
              }}
            >
              <i className="fa-solid fa-clone mr-2 text-[11px] text-gray-400" /> {t('closeOthers')}
            </button>
          </>
        ) : null}
      </div>

      <main className="flex-1 flex flex-col min-w-0 bg-white dark:bg-[#1e1e1e] transition-colors duration-200">
        <header className="h-[46px] border-b border-ui-border dark:border-ui-borderDark flex items-center justify-between px-4 bg-white dark:bg-surface-900 z-20">
          <div id="dd-env" className="flex items-center gap-2 relative min-w-0">
            <button
              id="envDropdownBtn"
              className={clsx(
                'flex items-center min-w-0 max-w-[280px]',
                'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white',
                'bg-surface-100 dark:bg-surface-800 px-2.5 py-1 rounded cursor-pointer transition-colors font-medium'
              )}
              onClick={() => dd.toggle('dd-env')}
              type="button"
              title={activeEnv?.name || 'Development'}
            >
              <div className={clsx('w-2 h-2 rounded-full mr-2', envToneDot(activeEnv?.name || ''))} />
              <span className="min-w-0 truncate">{activeEnv?.name || 'Development'}</span>
              <i className="fa-solid fa-chevron-down ml-2 text-[10px] opacity-50" />
            </button>
            <div
              id="envDropdownMenu"
              className={clsx(
                'absolute top-9 left-0 bg-white dark:bg-surface-800 border border-ui-border dark:border-ui-borderDark rounded-md shadow-float dark:shadow-floatDark py-1 z-50',
                'min-w-full w-max max-w-[360px] max-h-[260px] overflow-x-hidden overflow-y-auto',
                dd.isOpen('dd-env') ? '' : 'hidden'
              )}
            >
              {displayEnvs.map((e) => (
                <div
                  key={e.id}
                  className="px-3 py-1.5 hover:bg-surface-100 dark:hover:bg-surface-900 cursor-pointer flex items-center text-gray-800 dark:text-gray-200"
                  onClick={() => {
                    dd.close()
                    changeActiveEnv(e.id)
                  }}
                  title={e.name}
                >
                  <div className={clsx('w-2 h-2 rounded-full mr-2 shrink-0', envToneDot(e.name))} />
                  <span className="min-w-0 truncate">{e.name}</span>
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
                dd.close()
                setCtxMenu(null)
                setEnvDrafts(displayEnvs.map((e) => ({ ...e, vars: { ...(e.vars ?? {}) } })))
                setSettingsDraft(
                  settings
                    ? { ...settings }
                    : { theme: 'system', language: 'zh', requestTimeoutMs: 10000, autoSave: true }
                )
                setSettingsOpen(true)
              }}
              type="button"
              title={t('preferences')}
            >
              <i className="fa-solid fa-gear text-[14px]" />
            </button>
          </div>
        </header>

        <div className="px-4 pt-2.5 pb-3">
          {/* Request tabs (template extension) */}
          <div className="flex items-center gap-2 mb-2">
            <div
              ref={tabsScrollRef}
              className="flex-1 min-w-0 flex items-center gap-1 overflow-x-auto overflow-y-hidden tabs-scroll"
              onWheel={onTabsWheel}
            >
              {openTabs.map((id) => {
                const hit = findNodeWithParentByRequestId(tree, id)
                const name = hit?.node.name ?? t('newRequest')
                const method = (hit?.node.method || (id === selectedRequestId ? req?.method : '') || 'GET').toUpperCase()
                const active = id === selectedRequestId
                return (
                  <button
                    key={id}
                    type="button"
                    className={clsx(
                      'group h-8 max-w-[260px] px-2.5 rounded-md flex items-center gap-2 shrink-0 transition-colors',
                      active
                        ? 'bg-ui-primary/10 text-ui-primary dark:text-blue-300 hover:bg-ui-primary/15'
                        : 'bg-surface-50 dark:bg-surface-800/40 text-gray-700 dark:text-gray-200 hover:bg-surface-100 dark:hover:bg-surface-800'
                    )}
                    onClick={() => {
                      setCtxMenu(null)
                      if (id !== selectedRequestId) selectRequest(id)
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      openTabContextMenu(id, e.clientX, e.clientY)
                    }}
                    title={name}
                  >
                    <span className={clsx(methodToneClass(method), 'font-mono font-semibold text-[10px] w-8 shrink-0')}>
                      {methodShort(method)}
                    </span>
                    <span className="truncate text-[12px]">{name}</span>
                    {active && dirty ? <span className="w-1.5 h-1.5 rounded-full bg-ui-primary/70" /> : null}
                    <span
                      className={clsx(
                        'ml-0.5 w-5 h-5 rounded flex items-center justify-center text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-surface-200 dark:hover:bg-surface-700 transition-colors',
                        'opacity-0 group-hover:opacity-100'
                      )}
                      onClick={(e) => {
                        e.stopPropagation()
                        closeTab(id)
                      }}
                      role="button"
                      aria-label="Close tab"
                      title="Close"
                    >
                      <i className="fa-solid fa-xmark text-[10px]" />
                    </span>
                  </button>
                )
              })}
            </div>
            <button
              type="button"
              className="w-8 h-8 flex items-center justify-center rounded-md bg-surface-50 dark:bg-surface-800/40 hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors text-gray-600 dark:text-gray-200 shrink-0"
              onClick={addRequestFromTabs}
              disabled={!activeProjectId}
              title={t('newRequest')}
            >
              <i className="fa-solid fa-plus text-[12px]" />
            </button>
          </div>

          <div className="flex items-stretch gap-2">
            <div className="flex flex-1 items-stretch border border-ui-border dark:border-ui-borderDark rounded-md shadow-subtle focus-within:border-ui-primary dark:focus-within:border-ui-primary focus-within:ring-2 focus-within:ring-ui-primary/20 transition-all bg-white dark:bg-surface-800/50 h-[38px] min-w-0">
              <div className="relative flex items-center border-r border-ui-border dark:border-ui-borderDark rounded-l-md px-1">
                <div id="dd-method" className="relative">
                  <button
                    type="button"
                    className="flex items-center w-[92px] h-[30px] px-3 rounded cursor-pointer transition-colors hover:bg-surface-100 dark:hover:bg-surface-800"
                    onClick={() => dd.toggle('dd-method')}
                    disabled={!req}
                  >
                    <span className={clsx(methodToneClass(req?.method || 'GET'), 'font-mono font-bold')}>
                      {(req?.method || 'GET').toUpperCase()}
                    </span>
                    <i
                      className={clsx(
                        'fa-solid fa-chevron-down ml-auto text-[10px] text-gray-400 transition-transform duration-200',
                        dd.isOpen('dd-method') ? 'rotate-180' : ''
                      )}
                    />
                  </button>
                  <div className={clsx('custom-dropdown-menu w-full', dd.isOpen('dd-method') ? '' : 'hidden')}>
                    {(['GET', 'POST', 'PUT', 'DELETE', 'PATCH'] as const).map((m) => (
                      <button
                        key={m}
                        type="button"
                        className="custom-dropdown-item"
                        onClick={() => {
                          dd.close()
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
                placeholder={t('enterRequestUrl')}
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
              <i className="fa-solid fa-paper-plane mr-1.5 text-[12px] opacity-90" /> {t('send')}
            </button>

            {/* Save split button: Save / Save As */}
            <div id="dd-save" className="relative shrink-0 flex">
              <button
                className={clsx(
                  'h-[38px] border border-ui-border dark:border-ui-borderDark bg-surface-100 hover:bg-surface-200 dark:bg-surface-800 dark:hover:bg-surface-700 text-gray-700 dark:text-gray-200 font-medium px-4 transition-colors flex items-center rounded-l-md',
                  saving ? 'opacity-70 cursor-not-allowed' : ''
                )}
                onClick={saveFromToolbar}
                disabled={!req || saving}
                type="button"
              >
                <i className="fa-regular fa-floppy-disk mr-1.5 text-[12px] opacity-70" /> {t('save')}
              </button>
              <button
                className={clsx(
                  'h-[38px] w-10 flex items-center justify-center border-y border-r border-ui-border dark:border-ui-borderDark bg-surface-100 hover:bg-surface-200 dark:bg-surface-800 dark:hover:bg-surface-700 text-gray-700 dark:text-gray-200 transition-colors rounded-r-md',
                  saving ? 'opacity-70 cursor-not-allowed' : ''
                )}
                onClick={() => dd.toggle('dd-save')}
                disabled={!req || saving}
                type="button"
                aria-label="Save menu"
              >
                <i
                  className={clsx(
                    'fa-solid fa-chevron-down text-[10px] text-gray-400 transition-transform duration-200',
                    dd.isOpen('dd-save') ? 'rotate-180' : ''
                  )}
                />
              </button>
              <div
                className={clsx(
                  'custom-dropdown-menu align-right w-[160px]',
                  dd.isOpen('dd-save') ? '' : 'hidden'
                )}
              >
                <button
                  type="button"
                  className="custom-dropdown-item"
                  onClick={() => {
                    void saveFromToolbar()
                  }}
                >
                  <i className="fa-regular fa-floppy-disk mr-2 text-[11px] text-gray-400" /> {t('save')}
                </button>
                <button
                  type="button"
                  className="custom-dropdown-item"
                  onClick={() => {
                    dd.close()
                    openSaveDialog('saveAs')
                  }}
                >
                  <i className="fa-solid fa-copy mr-2 text-[11px] text-gray-400" /> {t('saveAs')}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div ref={splitRootRef} className="flex-1 flex flex-col overflow-hidden">
          {/* Upper: request config */}
          <div
            ref={upperPaneRef}
            className="flex-1 flex flex-col min-h-[150px]"
            style={upperPx != null ? { flex: '0 0 auto', height: upperPx } : undefined}
          >
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
                  {t('params')}
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
                  {t('headers')}{' '}
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
                  {t('body')}
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
                  {t('auth')}
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
          <div
            className="h-[1px] bg-ui-border dark:bg-ui-borderDark relative cursor-row-resize hover:bg-ui-primary dark:hover:bg-ui-primary transition-colors z-10"
            onMouseDown={beginResizeRows}
          >
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
                  {t('response')}
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
                  {t('resHeaders')}{' '}
                  <span className="ml-1 text-[11px] text-gray-400">{headerCount(response?.headers)}</span>
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
                  {t('cookies')}{' '}
                  <span className="ml-1 text-[11px] text-gray-400">{cookieCount(response?.headers)}</span>
                </button>
              </div>

              <div className="flex items-center space-x-4 font-mono text-[12px]">
                {response?.ok ? (
                  <>
                    <span className="text-gray-500 dark:text-gray-400">
                      {t('status')}: {' '}
                      <span className={clsx(statusToneClass(response.status), 'font-semibold ml-1')}>
                        {response.statusText || String(response.status)}
                      </span>
                    </span>
                    <span className="text-gray-500 dark:text-gray-400">
                      {t('time')}: {' '}
                      <span className={clsx(statusToneClass(response.status), 'font-semibold ml-1')}>
                        {response.durationMs} ms
                      </span>
                    </span>
                    <span className="text-gray-500 dark:text-gray-400">
                      {t('size')}: {' '}
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
                <div className="text-[12px] text-gray-500 dark:text-gray-400">{t('noResponseYet')}</div>
              ) : !response.ok ? (
                <div className="text-[12px] text-red-600 dark:text-red-300">
                  {response.error || t('requestFailed')}
                </div>
              ) : (
                <>
                  <div id="res-body" className={clsx('res-tab-content h-full', resTab === 'body' ? 'block' : 'hidden')}>
                    <div className="absolute right-4 top-4 flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        type="button"
                        className="w-6 h-6 rounded bg-surface-100 hover:bg-surface-200 dark:bg-surface-800 dark:hover:bg-surface-700 text-gray-500 dark:text-gray-300 flex items-center justify-center border border-ui-border dark:border-ui-borderDark"
                        title={t('copy')}
                        onClick={() => {
                           copyToClipboard(response.body ?? '')
                          toast.show(t('copiedToClipboard'), 'success')
                        }}
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

      <RenameDialog
        open={renameOpen}
        value={renameValue}
        inputRef={renameInputRef}
        t={t}
        onChange={setRenameValue}
        onClose={() => {
          setRenameOpen(false)
          setRenameNodeId(null)
        }}
        onConfirm={confirmRename}
      />

      <SaveRequestDialog
        open={saveDialogOpen}
        mode={saveDialogMode}
        busy={saveBusy}
        name={saveName}
        parentId={saveParentId}
        folderOptions={folderOptions}
        nameInputRef={saveNameInputRef}
        dd={dd}
        t={t}
        onChangeName={setSaveName}
        onChangeParentId={setSaveParentId}
        onClose={() => setSaveDialogOpen(false)}
        onConfirm={confirmSaveDialog}
      />

      <NewFolderDialog
        open={newFolderOpen}
        busy={newFolderBusy}
        name={newFolderName}
        locationLabel={
          newFolderParentId ? folderOptions.find((f) => f.id === newFolderParentId)?.name ?? t('folder') : t('root')
        }
        inputRef={newFolderNameInputRef}
        t={t}
        onChangeName={setNewFolderName}
        onClose={() => {
          setNewFolderOpen(false)
          setNewFolderParentId(null)
        }}
        onConfirm={confirmNewFolder}
      />

      <ConfirmDialog dialog={confirmDialog} busy={confirmBusy} t={t} onCancel={() => setConfirmDialog(null)} onConfirm={() => void runConfirmDialog()} />

      <SettingsDialog
        open={settingsOpen}
        t={t}
        settings={settings}
        settingsDraft={settingsDraft}
        setSettingsDraft={setSettingsDraft}
        envDrafts={envDrafts}
        setEnvDrafts={setEnvDrafts}
        displayEnvs={displayEnvs}
        activeProjectId={activeProjectId}
        addEnvironmentDraft={addEnvironmentDraft}
        requestDeleteEnvironmentDraft={requestDeleteEnvironmentDraft}
        importPostman={importPostman}
        exportPostman={exportPostman}
        exportOpenAPI={exportOpenAPI}
        errorMsg={errorMsg}
        onClose={() => {
          setSettingsDraft(null)
          setEnvDrafts(null)
          setSettingsOpen(false)
        }}
        onSave={saveSettingsDraft}
      />
    </div>
  )
}
