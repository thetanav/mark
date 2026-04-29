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
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="bg-background border p-4 rounded shadow-lg z-10 w-[480px]">
        <h3 className="text-lg font-semibold mb-2">Settings</h3>
        <div className="mb-4">
          <label className="block text-sm mb-1">Vault Directory</label>
          <input
            className="w-full p-2 border rounded bg-input text-sm"
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
