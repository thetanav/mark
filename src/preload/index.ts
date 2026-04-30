import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  vault: {
    getFiles: () => ipcRenderer.invoke('vault:getFiles'),
    readFile: (path: string) => ipcRenderer.invoke('vault:readFile', path),
    writeFile: (path: string, content: string) => ipcRenderer.invoke('vault:writeFile', path, content),
    createFile: (path: string) => ipcRenderer.invoke('vault:createFile', path),
    createFolder: (path: string) => ipcRenderer.invoke('vault:createFolder', path),
    renameItem: (path: string, newName: string) => ipcRenderer.invoke('vault:renameItem', path, newName),
    deleteItem: (path: string) => ipcRenderer.invoke('vault:deleteItem', path),
    getPath: () => ipcRenderer.invoke('vault:getPath'),
    setPath: (newPath: string) => ipcRenderer.invoke('vault:setPath', newPath)
  }
})
