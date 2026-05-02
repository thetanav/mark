/// <reference types="vite/client" />

declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string;
declare const MAIN_WINDOW_VITE_NAME: string;

interface Window {
  electronAPI?: {
    vault: {
      getFiles: () => Promise<import("./types").VaultItem[]>;
      getPath: () => Promise<string>;
      selectPath: () => Promise<{ canceled: boolean; path: string }>;
      setPath: (newPath: string) => Promise<boolean>;
      readFile: (filePath: string) => Promise<string>;
      writeFile: (filePath: string, content: string) => Promise<void>;
      createFile: (filePath: string) => Promise<boolean>;
      createFolder: (folderPath: string) => Promise<boolean>;
      renameItem: (itemPath: string, newName: string) => Promise<string | boolean>;
      moveItem: (itemPath: string, targetFolder: string) => Promise<string | boolean>;
      deleteItem: (itemPath: string) => Promise<boolean>;
      openFolder: () => Promise<boolean>;
      getGitState: () => Promise<{ initialized: boolean }>;
      initGit: () => Promise<
        { success: true; initialized: boolean } | { success: false; initialized: boolean; error: string }
      >;
      commitGit: (message: string) => Promise<{ success: true } | { success: false; error: string }>;
    };
    zoom: {
      getFactor: () => number;
      setFactor: (factor: number) => void;
    };
  };
}
