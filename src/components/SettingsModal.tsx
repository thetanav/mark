import { useEffect, useState } from "react";
import { FolderOpen, GitBranchPlus, GitCommitVertical } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
}

export default function SettingsModal({
  open,
  onClose,
}: SettingsModalProps) {
  const [path, setPath] = useState("");
  const [commitMessage, setCommitMessage] = useState("Update vault content");
  const [gitInitialized, setGitInitialized] = useState(false);
  const [busyAction, setBusyAction] = useState<"init" | "commit" | null>(null);

  useEffect(() => {
    if (!open || !window.electronAPI) return;

    window.electronAPI.vault.getPath().then((value) => setPath(value || ""));
    window.electronAPI.vault.getGitState().then((state) => {
      setGitInitialized(state.initialized);
    });
  }, [open]);

  const refreshGitState = async () => {
    if (!window.electronAPI) return;
    const state = await window.electronAPI.vault.getGitState();
    setGitInitialized(state.initialized);
  };

  const save = async () => {
    if (!window.electronAPI) return;
    const success = await window.electronAPI.vault.setPath(path);
    if (!success) alert("Failed to set vault path");
    onClose();
  };

  const openVaultFolder = async () => {
    if (!window.electronAPI) return;
    await window.electronAPI.vault.openFolder();
  };

  const initGit = async () => {
    if (!window.electronAPI) return;

    setBusyAction("init");
    const result = await window.electronAPI.vault.initGit();
    setBusyAction(null);

    if (!result.success) {
      alert(result.error);
      setGitInitialized(result.initialized);
      return;
    }

    setGitInitialized(true);
  };

  const commitGit = async () => {
    if (!window.electronAPI) return;

    setBusyAction("commit");
    const result = await window.electronAPI.vault.commitGit(commitMessage);
    setBusyAction(null);

    if (!result.success) {
      alert(result.error);
      await refreshGitState();
      return;
    }

    await refreshGitState();
    alert("Vault changes committed");
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/25 backdrop-blur-[1px]"
        onClick={onClose}
      />
      <div className="z-10 w-[460px] rounded-2xl border border-border/70 bg-background/95 p-4 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-medium tracking-tight">Settings</h3>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            className="h-8 w-8"
            title="Open vault folder"
            aria-label="Open vault folder"
            onClick={openVaultFolder}
          >
            <FolderOpen className="h-3.5 w-3.5" />
          </Button>
        </div>

        <div className="space-y-4">
          <div>
            <p className="mb-2 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              Vault location
            </p>
            <Input
              nativeInput
              value={path}
              onChange={(event) => setPath(event.target.value)}
              placeholder="Vault path"
              className="font-mono text-[12px]"
            />
          </div>

          <div className="rounded-xl border border-border/70 bg-muted/20 p-3">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium tracking-tight">Git</p>
                <p className="text-[11px] text-muted-foreground">
                  Initialize the vault as a repository and commit your changes.
                </p>
              </div>
              <div className="rounded-full border border-border/70 bg-background px-2 py-1 text-[11px] text-muted-foreground">
                {gitInitialized ? "Initialized" : "Not initialized"}
              </div>
            </div>

            <div className="mb-3 flex items-center gap-2">
              <Input
                nativeInput
                value={commitMessage}
                onChange={(event) => setCommitMessage(event.target.value)}
                placeholder="Commit message"
                className="text-[12px]"
                disabled={!gitInitialized}
              />
              {!gitInitialized ? (
                <Button
                  className="shrink-0"
                  onClick={initGit}
                  loading={busyAction === "init"}
                  disabled={busyAction === "commit"}
                >
                  <GitBranchPlus className="h-4 w-4" />
                  Init Git
                </Button>
              ) : (
                <Button
                  className="shrink-0"
                  onClick={commitGit}
                  loading={busyAction === "commit"}
                  disabled={busyAction === "init"}
                >
                  <GitCommitVertical className="h-4 w-4" />
                  Commit changes
                </Button>
              )}
            </div>

            {gitInitialized && (
              <p className="text-[11px] text-muted-foreground">
                Commit will stage all vault changes and create a git commit.
              </p>
            )}
          </div>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save}>Save</Button>
        </div>
      </div>
    </div>
  );
}
