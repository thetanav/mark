const { app, BrowserWindow, ipcMain, Menu } = require("electron")
const path = require("path")
const fs = require("fs")
const os = require("os")

let VAULT_PATH = path.join(os.homedir(), "mark-vault")

function ensureVault() {
  if (!fs.existsSync(VAULT_PATH)) {
    fs.mkdirSync(VAULT_PATH, { recursive: true })
  }
}

function getFilesRecursive(dir) {
  const files = []
  const items = fs.readdirSync(dir)
  
  items.forEach(item => {
    const fullPath = path.join(dir, item)
    const stat = fs.statSync(fullPath)
    const relativePath = fullPath.replace(VAULT_PATH, "").replace(/\\/g, "/").replace(/^\//, "")
    
    if (stat.isDirectory()) {
      files.push({
        name: item,
        path: relativePath || item,
        type: "folder",
        children: getFilesRecursive(fullPath)
      })
    } else if (item.endsWith(".md")) {
      files.push({
        name: item,
        path: relativePath,
        type: "file"
      })
    }
  })
  
  return files
}

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "../../dist/preload/index.js"),
      nodeIntegration: false,
      contextIsolation: true
    }
  })

  Menu.setApplicationMenu(null)
  mainWindow.setMenuBarVisibility(false)
  
  if (!app.isPackaged) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL || "http://localhost:5173")
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, "../../dist/renderer/index.html"))
  }
}

app.whenReady().then(() => {
  ensureVault()
  
  ipcMain.handle("vault:getFiles", () => {
    return getFilesRecursive(VAULT_PATH)
  })
  
  ipcMain.handle("vault:readFile", (_event, filePath) => {
    const fullPath = path.join(VAULT_PATH, filePath)
    return fs.readFileSync(fullPath, "utf-8")
  })
  
  ipcMain.handle("vault:writeFile", (_event, filePath, content) => {
    const fullPath = path.join(VAULT_PATH, filePath)
    const dir = path.dirname(fullPath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    fs.writeFileSync(fullPath, content, "utf-8")
  })

  ipcMain.handle("vault:setPath", (_event, newPath) => {
    // Allow changing the vault path at runtime. This will update VAULT_PATH
    // and ensure the directory exists. Note: this does not persist across restarts.
    try {
      if (!fs.existsSync(newPath)) {
        fs.mkdirSync(newPath, { recursive: true })
      }
      // Assign to module-level variable so subsequent calls use the new path
      VAULT_PATH = newPath
      return true
    } catch (e) {
      return false
    }
  })
  
  ipcMain.handle("vault:createFile", (_event, filePath) => {
    const fullPath = path.join(VAULT_PATH, filePath)
    const dir = path.dirname(fullPath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    if (!fs.existsSync(fullPath)) {
      fs.writeFileSync(fullPath, "# New File\n\n", "utf-8")
    }
    return true
  })
  
  ipcMain.handle("vault:createFolder", (_event, folderPath) => {
    const fullPath = path.join(VAULT_PATH, folderPath)
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true })
    }
    return true
  })

  ipcMain.handle("vault:renameItem", (_event, itemPath, newName) => {
    const fullPath = path.join(VAULT_PATH, itemPath)
    if (!fs.existsSync(fullPath)) {
      return false
    }

    const stat = fs.statSync(fullPath)
    const isFile = stat.isFile()
    const targetName = newName.trim()
    if (!targetName) {
      return false
    }

    const normalizedName = isFile
      ? targetName.endsWith(".md")
        ? targetName
        : `${targetName}.md`
      : targetName

    const nextPath = path.join(path.dirname(fullPath), normalizedName)
    if (nextPath === fullPath) {
      return true
    }

    fs.renameSync(fullPath, nextPath)

    return nextPath
      .replace(VAULT_PATH, "")
      .replace(/\\/g, "/")
      .replace(/^\//, "")
  })
  
  ipcMain.handle("vault:deleteItem", (_event, itemPath) => {
    const fullPath = path.join(VAULT_PATH, itemPath)
    fs.rmSync(fullPath, { recursive: true, force: true })
    return true
  })
  
  ipcMain.handle("vault:getPath", () => VAULT_PATH)
  
  createWindow()
  
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit()
})
