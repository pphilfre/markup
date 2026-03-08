"use client";

import { useState, useEffect, useCallback } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useAuthState } from "@/components/convex-client-provider";
import { signIn } from "@/lib/tauri";
import { useEditorStore, type ViewMode } from "@/lib/store";
import { isTauri } from "@/lib/tauri";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Share2,
  Copy,
  Check,
  Globe,
  Lock,
  Pencil,
  Eye,
  X,
  LinkIcon,
  UserPlus,
  Unlink,
  FileText,
  PenTool,
  GitBranch,
} from "lucide-react";

interface ShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tabId?: string | null;
}

export function ShareDialog({ open, onOpenChange, tabId }: ShareDialogProps) {
  const { isAuthenticated, user } = useAuthState();
  const userId = user?.id ?? null;

  const tabs = useEditorStore((s) => s.tabs);
  const activeTabId = useEditorStore((s) => s.activeTabId);
  const viewMode = useEditorStore((s) => s.viewMode);
  const targetTabId = tabId ?? activeTabId;
  const tab = tabs.find((t) => t.id === targetTabId);

  const [visibility, setVisibility] = useState<"public" | "private">("public");
  const [permission, setPermission] = useState<"read" | "edit">("read");
  const [noteType, setNoteType] = useState<"markdown" | "whiteboard" | "mindmap">(
    viewMode === "whiteboard" ? "whiteboard" : viewMode === "mindmap" ? "mindmap" : "markdown"
  );
  const [allowedEmail, setAllowedEmail] = useState("");
  const [allowedUsers, setAllowedUsers] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const [isSharing, setIsSharing] = useState(false);

  const shareNote = useMutation(api.sharing.share);
  const updateShareSettings = useMutation(api.sharing.updateSettings);
  const unshareNote = useMutation(api.sharing.unshare);

  const existingShare = useQuery(
    api.sharing.getByOwnerTab,
    userId && targetTabId ? { ownerUserId: userId, tabId: targetTabId } : "skip"
  );

  // Always fetch whiteboard/mindmap data so we can share any type
  const whiteboardData = useQuery(
    api.whiteboards.get,
    userId ? { userId } : "skip"
  );
  const mindmapData = useQuery(
    api.mindmaps.get,
    userId ? { userId } : "skip"
  );

  // Sync local state with existing share settings
  useEffect(() => {
    if (existingShare) {
      setVisibility(existingShare.visibility as "public" | "private");
      setPermission(existingShare.permission as "read" | "edit");
      setAllowedUsers(existingShare.allowedUsers);
      if (existingShare.noteType) {
        setNoteType(existingShare.noteType as "markdown" | "whiteboard" | "mindmap");
      }
    }
  }, [existingShare]);

  const getShareOrigin = () => {
    if (typeof window === "undefined") return "";
    if (isTauri()) return "https://markup.freddiephilpot.dev";
    return window.location.origin;
  };

  const shareUrl = existingShare
    ? `${getShareOrigin()}/?note=${existingShare.shareId}`
    : null;

  const handleShare = useCallback(async () => {
    if (!userId || !tab) return;
    setIsSharing(true);
    try {
      await shareNote({
        ownerUserId: userId,
        tabId: tab.id,
        title: tab.title,
        content: tab.content,
        visibility,
        permission,
        allowedUsers,
        noteType,
        ...(noteType === "whiteboard" && whiteboardData
          ? { whiteboardData: JSON.stringify({ elements: whiteboardData.elements, canvasSettings: whiteboardData.canvasSettings }) }
          : {}),
        ...(noteType === "mindmap" && mindmapData
          ? { mindmapData: JSON.stringify({ nodes: mindmapData.nodes, connections: mindmapData.connections, settings: mindmapData.settings }) }
          : {}),
      });
    } finally {
      setIsSharing(false);
    }
  }, [userId, tab, noteType, visibility, permission, allowedUsers, shareNote, whiteboardData, mindmapData]);

  const handleUpdateSettings = useCallback(async () => {
    if (!userId || !targetTabId) return;
    await updateShareSettings({
      ownerUserId: userId,
      tabId: targetTabId,
      visibility,
      permission,
      allowedUsers,
    });
  }, [userId, targetTabId, visibility, permission, allowedUsers, updateShareSettings]);

  const handleUnshare = useCallback(async () => {
    if (!userId || !targetTabId) return;
    await unshareNote({ ownerUserId: userId, tabId: targetTabId });
  }, [userId, targetTabId, unshareNote]);

  const handleCopyLink = useCallback(() => {
    if (!shareUrl) return;
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [shareUrl]);

  const handleAddUser = useCallback(() => {
    const email = allowedEmail.trim().toLowerCase();
    if (email && !allowedUsers.includes(email)) {
      setAllowedUsers((prev) => [...prev, email]);
      setAllowedEmail("");
    }
  }, [allowedEmail, allowedUsers]);

  const handleRemoveUser = useCallback(
    (email: string) => {
      setAllowedUsers((prev) => prev.filter((e) => e !== email));
    },
    []
  );

  if (!isAuthenticated) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Share2 className="h-5 w-5" />
              Share Note
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <Lock className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Sign in to share notes with others
            </p>
            <Button
              onClick={() => {
                signIn(() => window.location.reload());
              }}
            >
              Sign In
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (!tab) return null;

  const isAlreadyShared = !!existingShare;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5" />
            {isAlreadyShared ? "Manage Sharing" : "Share Note"}
          </DialogTitle>
          <DialogDescription>
            {isAlreadyShared
              ? `"${tab.title.replace(/\.md$/, "")}" is currently shared`
              : `Share "${tab.title.replace(/\.md$/, "")}" with others`}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] overflow-y-auto space-y-4 py-2">
          {/* Share link (shown when already shared) */}
          {isAlreadyShared && shareUrl && (
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground">
                Share Link
              </Label>
              <div className="flex items-center gap-2">
                <div className="flex flex-1 items-center gap-2 rounded-md border border-border bg-muted/50 px-3 py-2 text-sm overflow-hidden">
                  <LinkIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="truncate text-xs select-all">{shareUrl}</span>
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleCopyLink}
                  className="h-9 w-9 shrink-0"
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* Note Type */}
          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground">
              Share As
            </Label>
            <Select
              value={noteType}
              onValueChange={(v: string) => setNoteType(v as "markdown" | "whiteboard" | "mindmap")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="markdown">
                  <div className="flex items-center gap-2">
                    <FileText className="h-3.5 w-3.5" />
                    Markdown Note
                  </div>
                </SelectItem>
                <SelectItem value="whiteboard">
                  <div className="flex items-center gap-2">
                    <PenTool className="h-3.5 w-3.5" />
                    Whiteboard
                  </div>
                </SelectItem>
                <SelectItem value="mindmap">
                  <div className="flex items-center gap-2">
                    <GitBranch className="h-3.5 w-3.5" />
                    Mindmap
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Visibility */}
          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground">
              Visibility
            </Label>
            <Select
              value={visibility}
              onValueChange={(v: string) => setVisibility(v as "public" | "private")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="public">
                  <div className="flex items-center gap-2">
                    <Globe className="h-3.5 w-3.5" />
                    Public — anyone with the link
                  </div>
                </SelectItem>
                <SelectItem value="private">
                  <div className="flex items-center gap-2">
                    <Lock className="h-3.5 w-3.5" />
                    Private — only invited users
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Permission */}
          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground">
              Permission
            </Label>
            <Select
              value={permission}
              onValueChange={(v: string) => setPermission(v as "read" | "edit")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="read">
                  <div className="flex items-center gap-2">
                    <Eye className="h-3.5 w-3.5" />
                    Read only
                  </div>
                </SelectItem>
                <SelectItem value="edit">
                  <div className="flex items-center gap-2">
                    <Pencil className="h-3.5 w-3.5" />
                    Can edit
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Invited users (for private visibility) */}
          {visibility === "private" && (
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground">
                <UserPlus className="mr-1 inline h-3.5 w-3.5" />
                Invite Users
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  placeholder="email@example.com"
                  value={allowedEmail}
                  onChange={(e) => setAllowedEmail(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddUser();
                    }
                  }}
                  className="text-sm"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAddUser}
                  disabled={!allowedEmail.trim()}
                >
                  Add
                </Button>
              </div>
              {allowedUsers.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {allowedUsers.map((email) => (
                    <span
                      key={email}
                      className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2.5 py-0.5 text-xs"
                    >
                      {email}
                      <button
                        onClick={() => handleRemoveUser(email)}
                        className="ml-0.5 rounded-full p-0.5 hover:bg-background"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 pt-2">
          {isAlreadyShared ? (
            <>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleUnshare}
                className="gap-1.5"
              >
                <Unlink className="h-3.5 w-3.5" />
                Unshare
              </Button>
              <div className="flex-1" />
              <Button
                size="sm"
                onClick={handleUpdateSettings}
                className="gap-1.5"
              >
                <Check className="h-3.5 w-3.5" />
                Save Changes
              </Button>
            </>
          ) : (
            <>
              <div className="flex-1" />
              <Button
                variant="outline"
                size="sm"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleShare}
                disabled={isSharing}
                className="gap-1.5"
              >
                <Share2 className="h-3.5 w-3.5" />
                {isSharing ? "Sharing…" : "Share"}
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
