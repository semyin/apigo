import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'

type DropdownApi = {
  openId: string | null
  isOpen: (id: string) => boolean
  open: (id: string) => void
  close: () => void
  toggle: (id: string) => void
}

const Ctx = createContext<DropdownApi | null>(null)

export function DropdownProvider({ children }: { children: React.ReactNode }) {
  const [openId, setOpenId] = useState<string | null>(null)

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (!openId) return
      const root = document.getElementById(openId)
      const target = e.target as Node | null
      if (!root || !target || !root.contains(target)) setOpenId(null)
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpenId(null)
    }

    document.addEventListener('mousedown', onMouseDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [openId])

  const api = useMemo<DropdownApi>(
    () => ({
      openId,
      isOpen: (id: string) => openId === id,
      open: (id: string) => setOpenId(id),
      close: () => setOpenId(null),
      toggle: (id: string) => setOpenId((prev) => (prev === id ? null : id)),
    }),
    [openId]
  )

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>
}

export function useDropdown() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('DropdownProvider missing')
  return ctx
}

