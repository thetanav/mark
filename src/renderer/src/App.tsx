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
  const [selectedDirectory, setSelectedDirectory] = useState<string | null>(
    null,
  );
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
        className="h-11 border-b flex items-center px-3 gap-3 bg-background/95 drag backdrop-blur-sm"
      >
        <div className="flex items-center gap-2 no-drag">
          <FileText className="w-3.5 h-3.5 text-foreground/70" />
          <span className="text-[13px] font-medium tracking-tight text-foreground/85">
            Mark
          </span>
        </div>
        <div className="flex-1" />
        {saving && (
          <span className="text-[11px] text-muted-foreground/80 mr-2 no-drag">
            Saving...
          </span>
        )}
        <div className="flex items-center gap-1 no-drag">
          <Button
            variant="ghost"
            size="icon-sm"
            className="h-7 w-7"
            onClick={handleSave}
          >
            <SaveIcon className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            className="h-7 w-7"
            onClick={() => setSettingsOpen(true)}
          >
            <SettingsIcon className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            className="h-7 w-7"
            onClick={toggleTheme}
          >
            {theme === "light" ? (
              <Moon className="w-3.5 h-3.5" />
            ) : (
              <Sun className="w-3.5 h-3.5" />
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
          <Sidebar
            onSelectFile={setSelectedFile}
            onSelectDirectory={setSelectedDirectory}
            selectedDirectory={selectedDirectory}
            selectedFile={selectedFile}
          />
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
