import type React from "react";
import { useCallback, useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  FileText,
  Moon,
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
  const [savedContent, setSavedContent] = useState("");
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(250);

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
      window.electronAPI.vault.readFile(selectedFile).then((fileContent: string) => {
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

  const handleContentChange = useCallback((nextContent: string) => {
    setContent(nextContent);
  }, []);

  const handleSave = useCallback(async () => {
    if (!selectedFile || !window.electronAPI) return;
    await window.electronAPI.vault.writeFile(selectedFile, content);
    setSavedContent(content);
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
      <div className="flex h-11 items-center border-b bg-background/95 px-3 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <span className="text-md font-bold tracking-tight text-foreground/85 ml-2 select-none">
            M
          </span>
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon-sm"
            className="h-7 w-7"
            title="Settings"
            aria-label="Settings"
            onClick={() => setSettingsOpen(true)}
          >
            <SettingsIcon className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="outline"
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
      </div>

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
          className="border cursor-col-resize select-none hover:border-primary active:border-primary transition-colors"
          onMouseDown={handleMouseDown}
        />
        <div className="min-w-0 flex-1 overflow-hidden">
          <Editor
            filePath={selectedFile}
            content={content}
            onContentChange={handleContentChange}
            onSave={handleSave}
            isUnsaved={isUnsaved}
            onCloseUnsaved={() => {
              if (isUnsaved && !confirm("You have unsaved changes. Discard them?")) {
                return false;
              }
              setSelectedFile(null);
              return true;
            }}
          />
        </div>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/")({
  component: HomePage,
});
