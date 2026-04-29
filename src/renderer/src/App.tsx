import { useState, useEffect, useCallback } from "react";
import {
  FileText,
  Sun,
  Moon,
  Save as SaveIcon,
  Settings as SettingsIcon,
} from "lucide-react";
import { Sidebar } from "./components/Sidebar";
import { Editor } from "./components/Editor";
import { Button } from "./components/ui";
import SettingsModal from "./components/SettingsModal";

function App() {
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(224);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "light" ? "dark" : "light"));
  };

  useEffect(() => {
    if (!selectedFile) {
      setContent("");
      return;
    }
    if (window.electronAPI) {
      window.electronAPI.vault.readFile(selectedFile).then(setContent);
    }
  }, [selectedFile]);

  // Do not auto-save on every keystroke. Editor will call onContentChange locally
  // and provide an explicit save call via window.electronAPI when requested.
  const handleContentChange = useCallback((newContent: string) => {
    setContent(newContent);
  }, []);

  const handleSave = useCallback(async () => {
    if (!selectedFile || !window.electronAPI) return;
    setSaving(true);
    await window.electronAPI.vault.writeFile(selectedFile, content);
    setTimeout(() => setSaving(false), 500);
  }, [selectedFile, content]);

  const handleMouseDown = (e: React.MouseEvent) => {
    const startX = e.clientX;
    const startWidth = sidebarWidth;

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = Math.max(
        180,
        Math.min(400, startWidth + e.clientX - startX),
      );
      setSidebarWidth(newWidth);
    };

    const handleMouseUp = () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  return (
    <div
      className={`h-screen w-screen flex flex-col ${theme === "dark" ? "dark" : ""}`}
    >
      <header
        className="h-12 border-b flex items-center px-4 gap-3 bg-background drag"
        style={{ boxShadow: "inset 0 -1px 0 hsl(var(--border) / 1)" }}
      >
        <div className="flex items-center gap-2 no-drag">
          <FileText className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold tracking-tight">Mark</span>
        </div>
        <div className="flex-1" />
        {saving && (
          <span className="text-xs text-muted-foreground mr-2 no-drag">
            Saving...
          </span>
        )}
        <div className="flex items-center gap-1 no-drag">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={handleSave}
          >
            <SaveIcon className="w-4 h-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => setSettingsOpen(true)}
          >
            <SettingsIcon className="w-4 h-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={toggleTheme}
          >
            {theme === "light" ? (
              <Moon className="w-4 h-4" />
            ) : (
              <Sun className="w-4 h-4" />
            )}
          </Button>
        </div>
      </header>
      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
      <div className="flex-1 flex overflow-hidden bg-background">
        <div style={{ width: sidebarWidth }} className="flex-shrink-0">
          <Sidebar onSelectFile={setSelectedFile} selectedFile={selectedFile} />
        </div>
        <div
          className="w-1 cursor-col-resize hover:bg-primary/50 active:bg-primary/70 transition-all duration-150 flex-shrink-0 relative group"
          onMouseDown={handleMouseDown}
        >
          <div className="absolute inset-y-0 -left-1 -right-1" />
        </div>
        <div className="flex-1 overflow-hidden">
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

export default App;
