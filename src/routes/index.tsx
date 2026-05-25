import { createFileRoute } from "@tanstack/react-router";
import {
  FileText,
  Focus,
  Moon,
  Settings as SettingsIcon,
  Sun,
} from "lucide-react";
import type React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CommandPalette } from "@/components/command-palette";
import { Editor, type EditorHandle } from "@/components/Editor";
import SettingsModal from "@/components/SettingsModal";
import { Sidebar } from "@/components/Sidebar";
import { Button } from "@/components/ui/button";

function joinPath(base: string | null, name: string) {
  return base ? `${base}/${name}` : name;
}

function getTimestampName() {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(
    now.getDate()
  )}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(
    now.getSeconds()
  )}-${String(now.getMilliseconds()).padStart(3, "0")}`;
}

const WORD_SEPARATOR = /\s+/;
const MARKDOWN_EXTENSION = /\.md$/;

function HomePage() {
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [selectedDirectory, setSelectedDirectory] = useState<string | null>(
    null
  );
  const [content, setContent] = useState("");
  const [savedContent, setSavedContent] = useState("");
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(250);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [sidebarRefreshKey, setSidebarRefreshKey] = useState(0);
  const editorRef = useRef<EditorHandle | null>(null);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  useEffect(() => {
    if (!selectedFile) {
      setContent("");
      setSavedContent("");
      return;
    }

    if (window.electronAPI) {
      window.electronAPI.vault
        .readFile(selectedFile)
        .then((fileContent: string) => {
          setContent(fileContent);
          setSavedContent(fileContent);
        });
    }
  }, [selectedFile]);

  const isUnsaved = content !== savedContent;

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isUnsaved) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isUnsaved]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "light" ? "dark" : "light"));
  };

  const stats = useMemo(() => {
    const words = content.trim().split(WORD_SEPARATOR).filter(Boolean).length;
    return {
      words,
      readingTime: Math.max(1, Math.ceil(words / 220)),
    };
  }, [content]);

  const handleContentChange = useCallback((nextContent: string) => {
    setContent(nextContent);
  }, []);

  const handleSave = useCallback(async () => {
    if (!(selectedFile && window.electronAPI)) {
      return;
    }
    await window.electronAPI.vault.writeFile(selectedFile, content);
    setSavedContent(content);
  }, [selectedFile, content]);

  const refreshSidebar = useCallback(() => {
    setSidebarRefreshKey((key) => key + 1);
  }, []);

  const createNote = useCallback(async () => {
    if (!window.electronAPI) {
      return;
    }
    const path = joinPath(selectedDirectory, `${getTimestampName()}.md`);
    await window.electronAPI.vault.createFile(path);
    setSelectedFile(path);
    refreshSidebar();
  }, [refreshSidebar, selectedDirectory]);

  const renameSelected = useCallback(
    async (nextName: string) => {
      const trimmedName = nextName.trim();
      if (!(selectedFile && window.electronAPI && trimmedName)) {
        return false;
      }
      const currentName =
        selectedFile.split("/").pop()?.replace(MARKDOWN_EXTENSION, "") ?? "";
      if (trimmedName === currentName) {
        return true;
      }

      const renamedPath = await window.electronAPI.vault.renameItem(
        selectedFile,
        trimmedName
      );
      if (typeof renamedPath === "string") {
        setSelectedFile(renamedPath);
        refreshSidebar();
        return true;
      }
      return false;
    },
    [refreshSidebar, selectedFile]
  );

  const moveSelected = useCallback(
    async (targetFolder: string) => {
      if (!(selectedFile && window.electronAPI)) {
        return false;
      }

      const movedPath = await window.electronAPI.vault.moveItem(
        selectedFile,
        targetFolder.trim()
      );
      if (typeof movedPath === "string") {
        setSelectedFile(movedPath);
        refreshSidebar();
        return true;
      }
      return false;
    },
    [refreshSidebar, selectedFile]
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && focusMode) {
        setFocusMode(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [focusMode]);

  const handleMouseDown = (event: React.MouseEvent) => {
    const startX = event.clientX;
    const startWidth = sidebarWidth;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const nextWidth = Math.max(
        200,
        Math.min(440, startWidth + moveEvent.clientX - startX)
      );
      setSidebarWidth(nextWidth);
    };

    const handleMouseUp = () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden">
      {!focusMode && (
        <div className="flex h-11 items-center border-b bg-background/95 px-3 backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <span className="ml-2 select-none font-bold text-foreground/85 text-md tracking-tight">
              M
            </span>
          </div>
          <div className="flex-1" />
          <div className="flex items-center gap-1">
            <Button
              aria-label="Command palette"
              className="h-7 w-7"
              onClick={() => setPaletteOpen(true)}
              size="icon-sm"
              title="Command palette"
              variant="outline"
            >
              <FileText className="h-3.5 w-3.5" />
            </Button>
            <Button
              aria-label="Focus mode"
              className="h-7 w-7"
              onClick={() => setFocusMode(true)}
              size="icon-sm"
              title="Focus mode"
              variant="outline"
            >
              <Focus className="h-3.5 w-3.5" />
            </Button>
            <Button
              aria-label="Settings"
              className="h-7 w-7"
              onClick={() => setSettingsOpen(true)}
              size="icon-sm"
              title="Settings"
              variant="outline"
            >
              <SettingsIcon className="h-3.5 w-3.5" />
            </Button>
            <Button
              aria-label={
                theme === "light" ? "Switch to dark" : "Switch to light"
              }
              className="h-7 w-7"
              onClick={toggleTheme}
              size="icon-sm"
              title={theme === "light" ? "Switch to dark" : "Switch to light"}
              variant="outline"
            >
              {theme === "light" ? (
                <Moon className="h-3.5 w-3.5" />
              ) : (
                <Sun className="h-3.5 w-3.5" />
              )}
            </Button>
          </div>
        </div>
      )}

      <SettingsModal
        onClose={() => setSettingsOpen(false)}
        open={settingsOpen}
      />
      <CommandPalette
        editor={editorRef}
        focusMode={focusMode}
        onCreateNote={createNote}
        onFilesChanged={refreshSidebar}
        onMoveSelected={moveSelected}
        onOpenChange={setPaletteOpen}
        onOpenFile={setSelectedFile}
        onOpenSettings={() => setSettingsOpen(true)}
        onRenameSelected={renameSelected}
        onSetTheme={setTheme}
        onToggleFocusMode={() => setFocusMode((value) => !value)}
        open={paletteOpen}
        selectedDirectory={selectedDirectory}
        selectedFile={selectedFile}
        theme={theme}
      />

      <div
        className={`flex flex-1 overflow-hidden ${focusMode ? "bg-muted/30 p-6" : "bg-background"}`}
      >
        {!focusMode && (
          <div className="flex-shrink-0" style={{ width: sidebarWidth }}>
            <Sidebar
              onSelectDirectory={setSelectedDirectory}
              onSelectFile={setSelectedFile}
              refreshKey={sidebarRefreshKey}
              selectedDirectory={selectedDirectory}
              selectedFile={selectedFile}
            />
          </div>
        )}
        {!focusMode && (
          <div
            aria-label="Resize sidebar"
            className="cursor-col-resize select-none border transition-colors hover:border-primary active:border-primary"
            onMouseDown={handleMouseDown}
            role="separator"
          />
        )}
        <div className="min-w-0 flex-1 overflow-hidden">
          <Editor
            content={content}
            filePath={selectedFile}
            focusMode={focusMode}
            isUnsaved={isUnsaved}
            onContentChange={handleContentChange}
            onSave={handleSave}
            ref={editorRef}
          />
        </div>
      </div>
      {focusMode && (
        <div className="fixed bottom-4 left-1/2 z-40 flex -translate-x-1/2 items-center gap-3 rounded-full border border-border/70 bg-background/95 px-3 py-1.5 text-[12px] text-muted-foreground shadow-sm">
          <span>{stats.words} words</span>
          <span>{stats.readingTime} min read</span>
          <Button
            className="h-6 rounded-full"
            onClick={() => setFocusMode(false)}
            size="xs"
            variant="ghost"
          >
            Exit
          </Button>
        </div>
      )}
    </div>
  );
}

export const Route = createFileRoute("/")({
  component: HomePage,
});
