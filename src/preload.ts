import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electronAPI", {
  vault: {
    getFiles: () => ipcRenderer.invoke("vault:getFiles"),
    getPath: () => ipcRenderer.invoke("vault:getPath"),
    setPath: (newPath: string) => ipcRenderer.invoke("vault:setPath", newPath),
    readFile: (filePath: string) => ipcRenderer.invoke("vault:readFile", filePath),
    writeFile: (filePath: string, content: string) =>
      ipcRenderer.invoke("vault:writeFile", filePath, content),
    createFile: (filePath: string) => ipcRenderer.invoke("vault:createFile", filePath),
    createFolder: (folderPath: string) =>
      ipcRenderer.invoke("vault:createFolder", folderPath),
    renameItem: (itemPath: string, newName: string) =>
      ipcRenderer.invoke("vault:renameItem", itemPath, newName),
    deleteItem: (itemPath: string) => ipcRenderer.invoke("vault:deleteItem", itemPath),
    openFolder: () => ipcRenderer.invoke("vault:openFolder"),
    getGitState: () => ipcRenderer.invoke("vault:getGitState"),
    initGit: () => ipcRenderer.invoke("vault:initGit"),
    commitGit: (message: string) => ipcRenderer.invoke("vault:commitGit", message),
  },
});
