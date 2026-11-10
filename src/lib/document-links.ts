import type { StoredDocument } from "./projects";
export function extractDocumentIds(content: string): string[] {
  return [
    ...new Set(
      [...content.matchAll(/\]\(#note\/([^\s)]+)\)/g)].flatMap((match) => {
        try {
          return [decodeURIComponent(match[1])];
        } catch {
          return [];
        }
      }),
    ),
  ];
}
export function resolveDocumentLink(
  href: string,
  documents: StoredDocument[],
  workspaceId: string,
): StoredDocument | undefined {
  if (!href.startsWith("#note/")) return undefined;
  let id: string;
  try {
    id = decodeURIComponent(href.slice(6));
  } catch {
    return undefined;
  }
  return documents.find(
    (document) =>
      document.id === id && (document.workspaceId ?? "default") === workspaceId,
  );
}
