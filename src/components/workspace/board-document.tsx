"use client";

import { useEditorStore } from "@/lib/store";
import { useLayoutSize } from "@/lib/use-layout-size";
import { TaskView } from "./task-view";

export function BoardDocument() {
  const id = useEditorStore((state) => state.activeTabId);
  const { ref, width } = useLayoutSize<HTMLDivElement>();
  return (
    <div ref={ref} className="workbench-page-scroll">
      {id && width > 0 && (
        <div className="workspace-page">
          <TaskView key={id} boardId={id} initialView={width < 520 ? "list" : "board"} />
        </div>
      )}
    </div>
  );
}
