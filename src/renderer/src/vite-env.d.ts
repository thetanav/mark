export {}

declare global {
  interface Window {
    electronAPI: {
      vault: {
        getFiles: () => Promise<import('./types').VaultItem[]>
        readFile: (path: string) => Promise<string>
        writeFile: (path: string, content: string) => Promise<void>
        createFile: (path: string) => Promise<boolean>
        createFolder: (path: string) => Promise<boolean>
        renameItem: (path: string, newName: string) => Promise<string | boolean>
        deleteItem: (path: string) => Promise<boolean>
        getPath: () => Promise<string>
        setPath: (newPath: string) => Promise<boolean>
      }
    }
  }
}
