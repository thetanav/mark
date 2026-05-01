import type React from "react";
import { useCallback, useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  FileText,
  Moon,
  Save as SaveIcon,
  Settings as SettingsIcon,
  Sun,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Editor } from "@/components/Editor";
import { Sidebar } from "@/components/Sidebar";
import SettingsModal from "@/components/SettingsModal";

function HomePage() {
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [selectedDirectory, setSelectedDirectory] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(264);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  useEffect(() => {
    if (!selectedFile) {
      setContent("");
      return;
    }

    if (window.electronAPI) {
      window.electronAPI.vault.readFile(selectedFile).then(setContent);
    }
  }, [selectedFile]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "light" ? "dark" : "light"));
  };

  const handleContentChange = useCallback((nextContent: string) => {
    setContent(nextContent);
  }, []);

  const handleSave = useCallback(async () => {
    if (!selectedFile || !window.electronAPI) return;
    await window.electronAPI.vault.writeFile(selectedFile, content);
  }, [selectedFile, content]);

  const handleMouseDown = (event: React.MouseEvent) => {
    const startX = event.clientX;
    const startWidth = sidebarWidth;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const nextWidth = Math.max(
        200,
        Math.min(440, startWidth + moveEvent.clientX - startX),
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
      <header className="drag flex h-11 items-center border-b bg-background/95 px-3 backdrop-blur-sm">
        <div className="no-drag flex items-center gap-2">
          <FileText className="h-3.5 w-3.5 text-foreground/70" />
          <span className="text-[13px] font-medium tracking-tight text-foreground/85">
            Mark
          </span>
        </div>
        <div className="flex-1" />
        <div className="no-drag flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            className="h-7 w-7"
            title="Save file"
            aria-label="Save file"
            onClick={handleSave}
          >
            <SaveIcon className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            className="h-7 w-7"
            title="Settings"
            aria-label="Settings"
            onClick={() => setSettingsOpen(true)}
          >
            <SettingsIcon className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            className="h-7 w-7"
            title={theme === "light" ? "Switch to dark" : "Switch to light"}
            aria-label={theme === "light" ? "Switch to dark" : "Switch to light"}
            onClick={toggleTheme}
          >
            {theme === "light" ? (
              <Moon className="h-3.5 w-3.5" />
            ) : (
              <Sun className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>
      </header>

      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />

      <div className="flex flex-1 overflow-hidden bg-background">
        <div style={{ width: sidebarWidth }} className="flex-shrink-0">
          <Sidebar
            onSelectFile={setSelectedFile}
            onSelectDirectory={setSelectedDirectory}
            selectedDirectory={selectedDirectory}
            selectedFile={selectedFile}
          />
        </div>
        <div
          className="relative h-full w-1 flex-shrink-0 cursor-col-resize bg-transparent transition-colors hover:bg-primary/50 active:bg-primary/70"
          onMouseDown={handleMouseDown}
        >
          <div className="absolute inset-y-0 -left-1 -right-1" />
        </div>
        <div className="min-w-0 flex-1 overflow-hidden">
          <Editor
            filePath={selectedFile}
            content={content}
            onContentChange={handleContentChange}
          />
        </div>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/")({
  component: HomePage,
});

