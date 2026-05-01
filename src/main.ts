import fs from "node:fs";
import { execFile } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { app, BrowserWindow, Menu, ipcMain, shell } from "electron";
import { installExtension, REACT_DEVELOPER_TOOLS } from "electron-devtools-installer";
import { ipcContext } from "@/ipc/context";
import { getBasePath } from "@/utils/path";
import { promisify } from "node:util";

type VaultItem = {
  name: string;
  path: string;
  type: "file" | "folder";
  children?: VaultItem[];
};

const vaultRoot = path.join(os.homedir(), "mark-vault");
let VAULT_PATH = vaultRoot;
const execFileAsync = promisify(execFile);

function ensureVault() {
  if (!fs.existsSync(VAULT_PATH)) {
    fs.mkdirSync(VAULT_PATH, { recursive: true });
  }
}

function resolveWithinVault(itemPath: string) {
  const resolved = path.resolve(VAULT_PATH, itemPath);
  const root = path.resolve(VAULT_PATH) + path.sep;
  if (resolved !== path.resolve(VAULT_PATH) && !resolved.startsWith(root)) {
    throw new Error("Path escapes the vault root");
  }
  return resolved;
}

function toRelativeVaultPath(fullPath: string) {
  return path
    .relative(VAULT_PATH, fullPath)
    .split(path.sep)
    .join("/");
}

function hasGitRepository() {
  return fs.existsSync(path.join(VAULT_PATH, ".git"));
}

async function runGit(args: string[]) {
  return execFileAsync("git", args, {
    cwd: VAULT_PATH,
    maxBuffer: 1024 * 1024 * 8,
  });
}

function getFilesRecursive(dir: string): VaultItem[] {
  if (!fs.existsSync(dir)) return [];

  const items = fs
    .readdirSync(dir, { withFileTypes: true })
    .sort((left, right) => {
      if (left.isDirectory() !== right.isDirectory()) {
        return left.isDirectory() ? -1 : 1;
      }
      return left.name.localeCompare(right.name);
    });

  const files: VaultItem[] = [];

  for (const item of items) {
    const fullPath = path.join(dir, item.name);
    const relativePath = toRelativeVaultPath(fullPath);

    if (item.isDirectory()) {
      files.push({
        name: item.name,
        path: relativePath,
        type: "folder",
        children: getFilesRecursive(fullPath),
      });
      continue;
    }

    if (item.isFile() && item.name.endsWith(".md")) {
      files.push({
        name: item.name,
        path: relativePath,
        type: "file",
      });
    }
  }

  return files;
}

function createWindow() {
  const basePath = getBasePath();
  const preload = path.join(basePath, "preload.js");
  const mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 640,
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      nodeIntegrationInSubFrames: false,
      preload,
    },
    titleBarStyle: "hidden",
  });

  ipcContext.setMainWindow(mainWindow);
  Menu.setApplicationMenu(null);
  mainWindow.setMenuBarVisibility(false);

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    mainWindow.loadFile(
      path.join(basePath, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }
}

async function installExtensions() {
  try {
    const result = await installExtension(REACT_DEVELOPER_TOOLS);
    console.log(`Extensions installed successfully: ${result.name}`);
  } catch (error) {
    console.error("Failed to install extensions", error);
  }
}

app.whenReady().then(async () => {
  try {
    ensureVault();

    ipcMain.handle("vault:getFiles", () => getFilesRecursive(VAULT_PATH));
    ipcMain.handle("vault:getPath", () => VAULT_PATH);
    ipcMain.handle("vault:setPath", (_event, newPath: string) => {
      try {
        const nextPath = path.resolve(newPath);
        if (!fs.existsSync(nextPath)) {
          fs.mkdirSync(nextPath, { recursive: true });
        }
        VAULT_PATH = nextPath;
        return true;
      } catch (error) {
        console.error("Failed to set vault path", error);
        return false;
      }
    });
    ipcMain.handle("vault:readFile", (_event, itemPath: string) => {
      const fullPath = resolveWithinVault(itemPath);
      return fs.readFileSync(fullPath, "utf-8");
    });
    ipcMain.handle(
      "vault:writeFile",
      (_event, itemPath: string, content: string) => {
        const fullPath = resolveWithinVault(itemPath);
        const dir = path.dirname(fullPath);
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(fullPath, content, "utf-8");
      },
    );
    ipcMain.handle("vault:createFile", (_event, itemPath: string) => {
      const fullPath = resolveWithinVault(itemPath);
      fs.mkdirSync(path.dirname(fullPath), { recursive: true });
      if (!fs.existsSync(fullPath)) {
        fs.writeFileSync(fullPath, "# New File\n\n", "utf-8");
      }
      return true;
    });
    ipcMain.handle("vault:createFolder", (_event, itemPath: string) => {
      const fullPath = resolveWithinVault(itemPath);
      fs.mkdirSync(fullPath, { recursive: true });
      return true;
    });
    ipcMain.handle(
      "vault:renameItem",
      (_event, itemPath: string, newName: string) => {
        const fullPath = resolveWithinVault(itemPath);
        if (!fs.existsSync(fullPath)) {
          return false;
        }

        const targetName = newName.trim();
        if (!targetName) {
          return false;
        }

        const stat = fs.statSync(fullPath);
        const normalizedName =
          stat.isFile() && !targetName.endsWith(".md")
            ? `${targetName}.md`
            : targetName;
        const nextPath = path.join(path.dirname(fullPath), normalizedName);

        if (nextPath === fullPath) {
          return toRelativeVaultPath(nextPath);
        }

        fs.renameSync(fullPath, nextPath);
        return toRelativeVaultPath(nextPath);
      },
    );
    ipcMain.handle("vault:deleteItem", (_event, itemPath: string) => {
      const fullPath = resolveWithinVault(itemPath);
      fs.rmSync(fullPath, { force: true, recursive: true });
      return true;
    });
    ipcMain.handle("vault:openFolder", async () => {
      await shell.openPath(VAULT_PATH);
      return true;
    });
    ipcMain.handle("vault:getGitState", () => ({
      initialized: hasGitRepository(),
    }));
    ipcMain.handle("vault:initGit", async () => {
      try {
        if (!fs.existsSync(VAULT_PATH)) {
          fs.mkdirSync(VAULT_PATH, { recursive: true });
        }

        if (!hasGitRepository()) {
          await runGit(["init"]);
        }

        return { success: true, initialized: true };
      } catch (error) {
        console.error("Failed to initialize git in vault", error);
        return {
          success: false,
          initialized: hasGitRepository(),
          error: error instanceof Error ? error.message : "Failed to initialize git",
        };
      }
    });
    ipcMain.handle("vault:commitGit", async (_event, message: string) => {
      try {
        const commitMessage = message.trim();
        if (!commitMessage) {
          return { success: false, error: "Commit message cannot be empty" };
        }

        if (!hasGitRepository()) {
          return { success: false, error: "Vault is not initialized as a git repository" };
        }

        await runGit(["add", "-A"]);

        const status = await runGit(["status", "--porcelain"]);
        if (!status.stdout.trim()) {
          return { success: false, error: "No changes to commit" };
        }

        await runGit(["commit", "-m", commitMessage]);

        return { success: true };
      } catch (error) {
        console.error("Failed to commit vault changes", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Failed to commit changes",
        };
      }
    });

    createWindow();
    if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
      await installExtensions();
    }
  } catch (error) {
    console.error("Error during app initialization:", error);
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
