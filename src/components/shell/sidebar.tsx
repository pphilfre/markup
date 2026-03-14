"use client";

import { useState, useRef, useCallback } from "react";
import {
  FileText,
  List,
  ListOrdered,
  Heading,
  Quote,
  Code2,
  Link,
  Image,
  Table,
  CheckSquare,
  Bold,
  Italic,
  Strikethrough,
  Settings,
  LogIn,
  LogOut,
  User,
  Shield,
  Monitor,
  RefreshCw,
  Cloud,
  CloudOff,
  AlertCircle,
  Building2,
  ArrowLeftRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { useEditorStore } from "@/lib/store";
import { useAuthState } from "@/components/convex-client-provider";
import { useSyncState, triggerManualSync } from "@/lib/convex-sync";
import { UserAccountPanel } from "@/components/shell/user-account-panel";
import { OrgPanel } from "@/components/shell/org-panel";
import { signIn, signOut } from "@/lib/tauri";


/** Small inline kbd badge for keybind hints */
function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="pointer-events-none ml-2 inline-flex items-center gap-0.5 rounded border border-border bg-muted px-1 py-0.5 font-mono text-[10px] text-muted-foreground">
      {children}
    </kbd>
  );
}

export function Sidebar() {
  const insertLinePrefix = useEditorStore((s) => s.insertLinePrefix);
  const insertSnippet = useEditorStore((s) => s.insertSnippet);
  const wrapSelection = useEditorStore((s) => s.wrapSelection);
  const [headingOpen, setHeadingOpen] = useState(false);
  const { isAuthenticated, user, isLoading: authLoading } = useAuthState();
  const sidebarWidth = useEditorStore((s) => s.settings.sidebarWidth);
  const updateSettings = useEditorStore((s) => s.updateSettings);
  const compactMode = useEditorStore((s) => s.settings.compactMode);
  const showIcons = useEditorStore((s) => s.settings.showIconsInSidebar);
  const sidebarPosition = useEditorStore((s) => s.settings.sidebarPosition);

  const btnSize = compactMode ? "h-7 w-7" : "h-8 w-8";
  const iconSize = compactMode ? "h-3.5 w-3.5" : "h-4 w-4";
  const tooltipSide = sidebarPosition === "right" ? "left" : "right";

  // Resize handle
  const draggingRef = useRef(false);
  const pendingWidthRef = useRef(sidebarWidth);

  const onResizeMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    draggingRef.current = true;
    const startX = e.clientX;
    const startWidth = sidebarWidth;

    const onMove = (ev: MouseEvent) => {
      if (!draggingRef.current) return;
      const delta = sidebarPosition === "right" ? startX - ev.clientX : ev.clientX - startX;
      const next = Math.max(36, Math.min(80, startWidth + delta));
      pendingWidthRef.current = next;
      // Apply visually immediately via CSS variable without store update
      document.documentElement.style.setProperty("--sidebar-drag-width", `${next}px`);
    };

    const onUp = () => {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      document.documentElement.style.removeProperty("--sidebar-drag-width");
      updateSettings({ sidebarWidth: Math.round(pendingWidthRef.current) });
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [sidebarWidth, sidebarPosition, updateSettings]);

  return (
    <aside
      className="relative flex h-full flex-col items-center border-r border-border bg-card py-2"
      style={{ width: `var(--sidebar-drag-width, ${sidebarWidth}px)` }}
    >
      {/* App icon */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon" className={`mb-1 ${btnSize}`}>
            <FileText className={iconSize} />
          </Button>
        </TooltipTrigger>
        <TooltipContent side={tooltipSide}>Markup</TooltipContent>
      </Tooltip>

      <Separator className="my-1 w-6" />

      {/* Quick-insert tools */}
      {showIcons && (
      <div className="flex min-h-0 flex-1 flex-col items-center gap-0.5 overflow-y-auto py-1">
        {/* Bold */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => wrapSelection("**", "**")}
              className={`${btnSize} text-muted-foreground hover:text-foreground`}
            >
              <Bold className={iconSize} />
            </Button>
          </TooltipTrigger>
          <TooltipContent side={tooltipSide} className="flex items-center">
            Bold <Kbd>Ctrl+B</Kbd>
          </TooltipContent>
        </Tooltip>

        {/* Italic */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => wrapSelection("*", "*")}
              className={`${btnSize} text-muted-foreground hover:text-foreground`}
            >
              <Italic className={iconSize} />
            </Button>
          </TooltipTrigger>
          <TooltipContent side={tooltipSide} className="flex items-center">
            Italic <Kbd>Ctrl+I</Kbd>
          </TooltipContent>
        </Tooltip>

        {/* Strikethrough */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => wrapSelection("~~", "~~")}
              className={`${btnSize} text-muted-foreground hover:text-foreground`}
            >
              <Strikethrough className={iconSize} />
            </Button>
          </TooltipTrigger>
          <TooltipContent side={tooltipSide} className="flex items-center">
            Strikethrough <Kbd>Alt+X</Kbd>
          </TooltipContent>
        </Tooltip>

        <Separator className="my-0.5 w-6" />

        {/* Heading dropdown */}
        <DropdownMenu open={headingOpen} onOpenChange={setHeadingOpen}>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className={`${btnSize} text-muted-foreground hover:text-foreground`}
                >
                  <Heading className={iconSize} />
                </Button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent side={tooltipSide} className="flex items-center">
              Heading <Kbd>Alt+H</Kbd>
            </TooltipContent>
          </Tooltip>
          <DropdownMenuContent side={tooltipSide} align="start" className="min-w-[120px]">
            {[1, 2, 3, 4, 5, 6].map((level) => (
              <DropdownMenuItem
                key={level}
                onClick={() => insertLinePrefix("#".repeat(level) + " ")}
                className="gap-2"
              >
                <span className="font-semibold" style={{ fontSize: `${1.3 - level * 0.1}em` }}>
                  H{level}
                </span>
                <span className="text-muted-foreground text-xs ml-auto">{"#".repeat(level)}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Bullet List */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => insertLinePrefix("- ")}
              className={`${btnSize} text-muted-foreground hover:text-foreground`}
            >
              <List className={iconSize} />
            </Button>
          </TooltipTrigger>
          <TooltipContent side={tooltipSide} className="flex items-center">
            Bullet List <Kbd>Alt+U</Kbd>
          </TooltipContent>
        </Tooltip>

        {/* Numbered List */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => insertLinePrefix("1. ")}
              className={`${btnSize} text-muted-foreground hover:text-foreground`}
            >
              <ListOrdered className={iconSize} />
            </Button>
          </TooltipTrigger>
          <TooltipContent side={tooltipSide} className="flex items-center">
            Numbered List <Kbd>Alt+O</Kbd>
          </TooltipContent>
        </Tooltip>

        {/* Task List */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => insertLinePrefix("- [ ] ")}
              className={`${btnSize} text-muted-foreground hover:text-foreground`}
            >
              <CheckSquare className={iconSize} />
            </Button>
          </TooltipTrigger>
          <TooltipContent side={tooltipSide} className="flex items-center">
            Task List <Kbd>Alt+C</Kbd>
          </TooltipContent>
        </Tooltip>

        {/* Blockquote */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => insertLinePrefix("> ")}
              className={`${btnSize} text-muted-foreground hover:text-foreground`}
            >
              <Quote className={iconSize} />
            </Button>
          </TooltipTrigger>
          <TooltipContent side={tooltipSide} className="flex items-center">
            Blockquote <Kbd>Alt+Q</Kbd>
          </TooltipContent>
        </Tooltip>

        {/* Code Block */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => insertSnippet("```\n$SEL\n```")}
              className={`${btnSize} text-muted-foreground hover:text-foreground`}
            >
              <Code2 className={iconSize} />
            </Button>
          </TooltipTrigger>
          <TooltipContent side={tooltipSide} className="flex items-center">
            Code Block <Kbd>Alt+`</Kbd>
          </TooltipContent>
        </Tooltip>

        {/* Link */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => insertSnippet("[$SEL](url)")}
              className={`${btnSize} text-muted-foreground hover:text-foreground`}
            >
              <Link className={iconSize} />
            </Button>
          </TooltipTrigger>
          <TooltipContent side={tooltipSide} className="flex items-center">
            Link <Kbd>Alt+N</Kbd>
          </TooltipContent>
        </Tooltip>

        {/* Image */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => insertSnippet("![alt]($SEL)")}
              className={`${btnSize} text-muted-foreground hover:text-foreground`}
            >
              <Image className={iconSize} />
            </Button>
          </TooltipTrigger>
          <TooltipContent side={tooltipSide} className="flex items-center">
            Image <Kbd>Alt+I</Kbd>
          </TooltipContent>
        </Tooltip>

        {/* Table */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => insertSnippet("| Header | Header |\n| ------ | ------ |\n| Cell   | Cell   |")}
              className={`${btnSize} text-muted-foreground hover:text-foreground`}
            >
              <Table className={iconSize} />
            </Button>
          </TooltipTrigger>
          <TooltipContent side={tooltipSide} className="flex items-center">
            Table <Kbd>Alt+T+B</Kbd>
          </TooltipContent>
        </Tooltip>
      </div>
      )}
      {!showIcons && <div className="flex-1" />}

      {/* Bottom: Auth + Settings — always visible */}
      <div className="flex shrink-0 flex-col items-center gap-0.5">
      <Separator className="my-1 w-6" />

      {/* Sync button */}
      <SyncButton btnSize={btnSize} iconSize={iconSize} tooltipSide={tooltipSide} />

      {/* Auth button */}
      {!authLoading && (
        <Tooltip>
          <TooltipTrigger asChild>
            {isAuthenticated ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={`${btnSize} text-muted-foreground hover:text-foreground`}
                  >
                    {user?.profilePictureUrl ? (
                      <img
                        src={user.profilePictureUrl}
                        alt=""
                        className="h-5 w-5 rounded-full"
                      />
                    ) : (
                      <User className={iconSize} />
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent side={tooltipSide} align="end">
                  <div className="px-2 py-1.5">
                    <p className="text-xs font-medium">
                      {user?.firstName} {user?.lastName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {user?.email}
                    </p>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => document.dispatchEvent(new CustomEvent("open-user-account", { detail: "profile" }))}>
                    <User className="mr-2 h-3.5 w-3.5" /> Profile
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => document.dispatchEvent(new CustomEvent("open-user-account", { detail: "sessions" }))}>
                    <Monitor className="mr-2 h-3.5 w-3.5" /> Sessions
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => document.dispatchEvent(new CustomEvent("open-user-account", { detail: "security" }))}>
                    <Shield className="mr-2 h-3.5 w-3.5" /> Security
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => signOut(() => window.location.reload())}>
                    <LogOut className="h-3.5 w-3.5 mr-2" />
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button
                variant="ghost"
                size="icon"
                className={`${btnSize} text-muted-foreground hover:text-foreground`}
                onClick={() => signIn(() => window.location.reload())}
              >
                <LogIn className={iconSize} />
              </Button>
            )}
          </TooltipTrigger>
          <TooltipContent side={tooltipSide}>
            {isAuthenticated ? `${user?.email}` : "Sign in to sync"}
          </TooltipContent>
        </Tooltip>
      )}

      {/* Org button — shown for authenticated users */}
      {isAuthenticated && (
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className={`${btnSize} text-muted-foreground hover:text-foreground`}
                >
                  <Building2 className={iconSize} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent side={tooltipSide} align="end">
                <DropdownMenuItem
                  onClick={() =>
                    document.dispatchEvent(
                      new CustomEvent("open-org-panel", { detail: "switcher" })
                    )
                  }
                >
                  <ArrowLeftRight className="mr-2 h-3.5 w-3.5" />
                  Switch Organisation
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() =>
                    document.dispatchEvent(
                      new CustomEvent("open-org-panel", { detail: "admin" })
                    )
                  }
                >
                  <Shield className="mr-2 h-3.5 w-3.5" />
                  Admin Panel
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </TooltipTrigger>
          <TooltipContent side={tooltipSide}>Organisation</TooltipContent>
        </Tooltip>
      )}

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => document.dispatchEvent(new CustomEvent("open-settings"))}
            className={`${btnSize} text-muted-foreground hover:text-foreground`}
          >
            <Settings className={iconSize} />
          </Button>
        </TooltipTrigger>
        <TooltipContent side={tooltipSide} className="flex items-center">
          Settings <Kbd>Alt+S</Kbd>
        </TooltipContent>
      </Tooltip>

      </div>{/* end bottom section */}

      {/* Resize handle */}
      <div
        onMouseDown={onResizeMouseDown}
        className="absolute inset-y-0 w-1 cursor-col-resize hover:bg-primary/30 active:bg-primary/50 transition-colors z-10"
        style={{ [sidebarPosition === "right" ? "left" : "right"]: 0 }}
      />

      <UserAccountPanel />
      <OrgPanel />
    </aside>
  );
}

// ---------------------------------------------------------------------------
// Sync button component
// ---------------------------------------------------------------------------

function SyncButton({
  btnSize,
  iconSize,
  tooltipSide,
}: {
  btnSize: string;
  iconSize: string;
  tooltipSide: "left" | "right";
}) {
  const { isAuthenticated } = useAuthState();
  const syncState = useSyncState();

  const isSyncing = syncState.status === "syncing";

  const handleClick = () => {
    if (!isAuthenticated) return;
    triggerManualSync();
  };

  const getSyncIcon = () => {
    switch (syncState.status) {
      case "offline":
        return <CloudOff className={iconSize} />;
      case "error":
        return <AlertCircle className={iconSize} />;
      case "disabled":
        return <CloudOff className={iconSize} />;
      default:
        return isSyncing
          ? <RefreshCw className={`${iconSize} animate-spin`} />
          : <Cloud className={iconSize} />;
    }
  };

  const getTooltipText = () => {
    if (!isAuthenticated) return "Sign in to sync";
    switch (syncState.status) {
      case "syncing":
        return "Syncing…";
      case "synced": {
        const ago = syncState.lastSyncedAt
          ? `${Math.round((Date.now() - syncState.lastSyncedAt) / 1000)}s ago`
          : "";
        return `Synced${ago ? ` ${ago}` : ""} — click to sync now`;
      }
      case "error":
        return `Sync error — click to retry`;
      case "offline":
        return "Offline — changes saved locally";
      case "disabled":
        return "Sign in to enable sync";
      default:
        return "Sync with cloud";
    }
  };

  const statusColor = () => {
    switch (syncState.status) {
      case "synced":
        return "text-green-400 hover:text-green-300";
      case "syncing":
        return "text-blue-400 hover:text-blue-300";
      case "error":
        return "text-red-400 hover:text-red-300";
      case "offline":
      case "disabled":
        return "text-muted-foreground/50";
      default:
        return "text-muted-foreground hover:text-foreground";
    }
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleClick}
          disabled={!isAuthenticated || isSyncing}
          className={`${btnSize} ${statusColor()}`}
        >
          {getSyncIcon()}
        </Button>
      </TooltipTrigger>
      <TooltipContent side={tooltipSide}>
        {getTooltipText()}
      </TooltipContent>
    </Tooltip>
  );
}
