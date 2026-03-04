"use client";

import { useState, useEffect, useCallback } from "react";
import { Info, X, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

function Notification({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className="fixed bottom-4 right-4 z-50 animate-in slide-in-from-bottom-2 fade-in duration-200">
      <div className="flex items-start gap-3 rounded-lg border border-border bg-card p-4 shadow-lg max-w-xs">
        <Info className="h-4 w-4 text-primary mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground mb-1.5">
            Made by Freddie Philpot
          </p>
          <div className="flex flex-col gap-1">
            <a
              href="https://github.com/pphilfre"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <ExternalLink className="h-3 w-3" />
              github.com/pphilfre
            </a>
            <a
              href="https://freddiephilpot.dev"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <ExternalLink className="h-3 w-3" />
              freddiephilpot.dev
            </a>
          </div>
        </div>
        <button
          onClick={onClose}
          className="rounded-sm p-0.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}

export function InfoButton() {
  const [showNotification, setShowNotification] = useState(false);

  const handleClose = useCallback(() => setShowNotification(false), []);

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowNotification(true)}
            className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
          >
            <Info className="h-3.5 w-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>About</TooltipContent>
      </Tooltip>

      {showNotification && <Notification onClose={handleClose} />}
    </>
  );
}
