import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Columns,
  Download,
  Eye,
  Pencil,
  Search,
  X,
} from "lucide-react";
import Markdown from "markdown-to-jsx";

import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";

export type ViewMode = "edit" | "preview" | "split";

interface EditorProps {
  filePath: string | null;
  content: string;
  onContentChange: (content: string) => void;
}

export function Editor({ filePath, content, onContentChange }: EditorProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("split");
  const [localContent, setLocalContent] = useState(content);
  const [splitWidth, setSplitWidth] = useState<number | null>(null);
  const [findOpen, setFindOpen] = useState(false);
  const [findQuery, setFindQuery] = useState("");
  const [findIndex, setFindIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    setLocalContent(content);
  }, [content]);

  useEffect(() => {
    if (!findOpen) return;
    if (viewMode === "preview") setViewMode("split");
  }, [findOpen, viewMode]);

  const findMatches = useMemo(() => {
    if (!findQuery) return [] as number[];
    const matches: number[] = [];
    const lowered = localContent.toLowerCase();
    const needle = findQuery.toLowerCase();
    let index = 0;
    while (index <= lowered.length) {
      const next = lowered.indexOf(needle, index);
      if (next === -1) break;
      matches.push(next);
      index = next + needle.length || next + 1;
    }
    return matches;
  }, [findQuery, localContent]);

  useEffect(() => {
    if (!findOpen) return;
    setFindIndex(0);
  }, [findOpen, findQuery]);

  const jumpToMatch = useCallback(
    (nextIndex: number) => {
      if (!findQuery) return;
      const matchStart = findMatches[nextIndex];
      if (matchStart === undefined) return;
      const matchEnd = matchStart + findQuery.length;
      const textarea = textareaRef.current;
      if (!textarea) return;
      textarea.focus();
      textarea.setSelectionRange(matchStart, matchEnd);
    },
    [findMatches, findQuery],
  );

  useEffect(() => {
    if (!findOpen || !findQuery || findMatches.length === 0) return;
    const clamped = Math.min(findIndex, findMatches.length - 1);
    if (clamped !== findIndex) setFindIndex(clamped);
    jumpToMatch(clamped);
  }, [findIndex, findOpen, findMatches.length, findQuery, jumpToMatch]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!filePath) return;
      const isFindShortcut =
        (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "f";
      if (isFindShortcut) {
        event.preventDefault();
        setFindOpen(true);
      }
      if (!findOpen) return;
      if (event.key === "Escape") {
        event.preventDefault();
        setFindOpen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [filePath, findOpen]);

  const handleChange = useCallback(
    (value: string) => {
      setLocalContent(value);
      onContentChange(value);
    },
    [onContentChange],
  );

  const exportAs = async (format: "pdf" | "docx" | "html") => {
    if (!filePath) return;
    const fileName = filePath.split("/").pop()?.replace(".md", "") || "export";

    if (format === "pdf") {
      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF();
      const lines = content.split("\n");
      let y = 20;
      lines.forEach((line) => {
        if (y > 280) {
          doc.addPage();
          y = 20;
        }
        doc.text(line, 20, y);
        y += 7;
      });
      doc.save(`${fileName}.pdf`);
    } else if (format === "docx") {
      const { Document, Packer, Paragraph, TextRun } = await import("docx");
      const doc = new Document({
        sections: [
          {
            properties: {},
            children: content.split("\n").map(
              (line) =>
                new Paragraph({
                  children: [new TextRun(line || " ")],
                }),
            ),
          },
        ],
      });
      const blob = await Packer.toBlob(doc);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${fileName}.docx`;
      anchor.click();
      URL.revokeObjectURL(url);
    } else if (format === "html") {
      const { remark } = (await import("remark")) as typeof import("remark");
      const { default: remarkHtml } = await import("remark-html");
      const processor = remark();
      const html = await processor.use(remarkHtml).process(content);
      const blob = new Blob([`<html><body>${String(html)}</body></html>`], {
        type: "text/html",
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${fileName}.html`;
      anchor.click();
      URL.revokeObjectURL(url);
    }
  };

  if (!filePath) {
    return (
      <div className="flex flex-1 items-center justify-center text-muted-foreground/80">
        <div className="text-center">
          <div className="mb-2 text-sm uppercase tracking-[0.3em] opacity-40">
            Note
          </div>
          <p className="text-[13px]">Select a file or create a new one</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-1 flex-col">
      <div className="flex items-center justify-between border-b px-4 py-2.5">
        <span className="truncate text-[13px] font-medium text-foreground/80">
          {filePath.split("/").pop()}
        </span>

        <div className="flex items-center gap-1">
          <Button
            variant={findOpen ? "secondary" : "ghost"}
            size="icon-sm"
            className="h-7 w-7"
            onClick={() => setFindOpen((prev) => !prev)}
          >
            <Search className="h-3.5 w-3.5" />
          </Button>

          <div className="flex gap-1 rounded-full bg-muted/50 p-0.5">
            <Button
              variant={viewMode === "edit" ? "secondary" : "ghost"}
              size="icon-sm"
              className="h-7 w-7 rounded-full"
              onClick={() => setViewMode("edit")}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant={viewMode === "split" ? "secondary" : "ghost"}
              size="icon-sm"
              className="h-7 w-7 rounded-full"
              onClick={() => setViewMode("split")}
            >
              <Columns className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant={viewMode === "preview" ? "secondary" : "ghost"}
              size="icon-sm"
              className="h-7 w-7 rounded-full"
              onClick={() => setViewMode("preview")}
            >
              <Eye className="h-3.5 w-3.5" />
            </Button>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" className="ml-1 h-7 w-7">
                <Download className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => exportAs("pdf")}>
                Export as PDF
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => exportAs("docx")}>
                Export as DOCX
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => exportAs("html")}>
                Export as HTML
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {findOpen && (
        <div className="flex items-center gap-2 border-b px-4 py-2">
          <div className="flex-1">
            <Input
              nativeInput
              value={findQuery}
              onChange={(event) => setFindQuery(event.target.value)}
              placeholder="Find in file..."
              className="h-8 bg-background"
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  if (findMatches.length === 0) return;
                  const direction = event.shiftKey ? -1 : 1;
                  const nextIndex =
                    (findIndex + direction + findMatches.length) %
                    findMatches.length;
                  setFindIndex(nextIndex);
                }
                if (event.key === "Escape") {
                  event.preventDefault();
                  setFindOpen(false);
                }
              }}
            />
          </div>
          <span className="min-w-[52px] text-right text-[11px] tabular-nums text-muted-foreground">
            {findMatches.length === 0
              ? "0/0"
              : `${findIndex + 1}/${findMatches.length}`}
          </span>
          <Button
            variant="ghost"
            size="icon-sm"
            className="h-7 w-7"
            onClick={() => {
              if (findMatches.length === 0) return;
              const nextIndex =
                (findIndex - 1 + findMatches.length) % findMatches.length;
              setFindIndex(nextIndex);
            }}
          >
            <ChevronUp className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            className="h-7 w-7"
            onClick={() => {
              if (findMatches.length === 0) return;
              const nextIndex = (findIndex + 1) % findMatches.length;
              setFindIndex(nextIndex);
            }}
          >
            <ChevronDown className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            className="h-7 w-7"
            onClick={() => setFindOpen(false)}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      <div className="relative flex flex-1 overflow-hidden">
        {(viewMode === "edit" || viewMode === "split") && (
          <textarea
            id="editor-textarea"
            ref={textareaRef}
            style={{
              width: viewMode === "split" ? (splitWidth ?? "50%") : "100%",
              fontFamily: "var(--font-mono)",
            }}
            className={`h-full resize-none bg-background p-4 text-[15px] leading-7 outline-none ${
              viewMode === "split" ? "border-r border-border/70" : ""
            }`}
            value={localContent}
            onChange={(event) => handleChange(event.target.value)}
            placeholder="Start writing markdown..."
          />
        )}

        {(viewMode === "preview" || viewMode === "split") && (
          <div
            id="preview-pane"
            style={{
              width:
                viewMode === "split"
                  ? splitWidth
                    ? `calc(100% - ${splitWidth}px)`
                    : "50%"
                  : "100%",
            }}
            className="overflow-auto p-6"
          >
            <div className="markdown-preview max-w-none">
              <Markdown>{localContent || "*Nothing to preview*"}</Markdown>
            </div>
          </div>
        )}

        {viewMode === "split" && (
          <div
            id="splitter"
            style={{
              width: 6,
              cursor: "col-resize",
              position: "absolute",
              left: splitWidth ?? "50%",
              top: 0,
              bottom: 0,
              transform: "translateX(-3px)",
            }}
            onMouseDown={(event) => {
              const startX = event.clientX;
              const startWidth =
                (
                  document.getElementById("editor-textarea") as HTMLElement
                )?.getBoundingClientRect().width || 0;
              const onMouseMove = (moveEvent: MouseEvent) => {
                const dx = moveEvent.clientX - startX;
                const newWidth = Math.max(200, startWidth + dx);
                setSplitWidth(newWidth);
              };
              const onMouseUp = () => {
                document.removeEventListener("mousemove", onMouseMove);
                document.removeEventListener("mouseup", onMouseUp);
              };
              document.addEventListener("mousemove", onMouseMove);
              document.addEventListener("mouseup", onMouseUp);
            }}
          />
        )}
      </div>
    </div>
  );
}

