"use client";

import { useState } from "react";
import { CalendarDays, CheckSquare, FileText, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { NOTE_TEMPLATES, type NoteTemplateId, useEditorStore } from "@/lib/store";

const TEMPLATE_ICONS: Record<NoteTemplateId, typeof FileText> = {
  blank: FileText,
  todo: CheckSquare,
  calendar: CalendarDays,
  moodboard: ImageIcon,
};

export function NewFileTemplateDialog() {
  const open = useEditorStore((s) => s.newTabTemplateDialogOpen);
  const closeTemplateDialog = useEditorStore((s) => s.closeTemplateDialog);
  const createTabFromTemplate = useEditorStore((s) => s.createTabFromTemplate);
  const promptForTemplateOnNewFile = useEditorStore((s) => s.settings.promptForTemplateOnNewFile);
  const updateSettings = useEditorStore((s) => s.updateSettings);

  const [selectedTemplate, setSelectedTemplate] = useState<NoteTemplateId>("blank");

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) closeTemplateDialog();
      }}
    >
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Create New File</DialogTitle>
          <DialogDescription>
            Pick a template for your new note.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-2">
          {NOTE_TEMPLATES.map((template) => {
            const Icon = TEMPLATE_ICONS[template.id];
            const active = selectedTemplate === template.id;
            return (
              <button
                key={template.id}
                type="button"
                onClick={() => setSelectedTemplate(template.id)}
                className={cn(
                  "flex items-start gap-3 rounded-md border px-3 py-2 text-left transition-colors",
                  active
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/40 hover:bg-muted/40"
                )}
              >
                <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", active ? "text-primary" : "text-muted-foreground")} />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">{template.label}</p>
                  <p className="text-xs text-muted-foreground">{template.description}</p>
                </div>
              </button>
            );
          })}
        </div>

        <div className="flex items-center justify-between rounded-md border border-border bg-muted/20 px-3 py-2">
          <div>
            <p className="text-xs font-medium text-foreground">Show template picker on every new file</p>
            <p className="text-[11px] text-muted-foreground">Turn this off to create blank files immediately.</p>
          </div>
          <Switch
            checked={promptForTemplateOnNewFile}
            onCheckedChange={(checked) => updateSettings({ promptForTemplateOnNewFile: !!checked })}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={closeTemplateDialog}>Cancel</Button>
          <Button onClick={() => createTabFromTemplate(selectedTemplate)}>
            {selectedTemplate === "blank" ? "Create Blank Note" : "Create from Template"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
