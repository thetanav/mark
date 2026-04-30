import React, { useEffect, useState } from 'react'
import { Button } from './ui/button'

interface SettingsModalProps {
  open: boolean
  onClose: () => void
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ open, onClose }) => {
  const [path, setPath] = useState('')

  useEffect(() => {
    if (!open) return
    if (window.electronAPI) {
      window.electronAPI.vault.getPath().then(p => setPath(p || ''))
    }
  }, [open])

  const save = async () => {
    if (!window.electronAPI) return
    const success = await window.electronAPI.vault.setPath(path)
    if (!success) alert('Failed to set vault path')
    onClose()
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/25 backdrop-blur-[1px]" onClick={onClose} />
      <div className="bg-background/95 border border-border/70 p-4 rounded-2xl shadow-sm z-10 w-[440px]">
        <h3 className="text-base font-medium mb-3 tracking-tight">Settings</h3>
        <div className="mb-4">
          <label className="block text-[11px] uppercase tracking-[0.2em] text-muted-foreground mb-2">
            Vault Directory
          </label>
          <input
            className="w-full p-2.5 border border-border/70 rounded-xl bg-background text-sm outline-none focus:ring-1 focus:ring-ring/40"
            value={path}
            onChange={e => setPath(e.target.value)}
            placeholder="Path to vault directory"
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={save}>Save</Button>
        </div>
      </div>
    </div>
  )
}

export default SettingsModal
