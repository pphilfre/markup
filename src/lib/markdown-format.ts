/** Heading choices replace the current level; list numbering follows the selection. */
export function applyLinePrefix(text: string, prefix: string, index = 0) {
  if (prefix === "" || /^#{1,6} $/.test(prefix))
    return prefix + text.replace(/^#{1,6}\s+/, "");
  if (prefix === "1. ") return `${index + 1}. ${text}`;
  return prefix + text;
}
