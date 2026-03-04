import { EditorView } from "@codemirror/view";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags } from "@lezer/highlight";

// ---------------------------------------------------------------------------
// Shared base styles
// ---------------------------------------------------------------------------

const baseStyles = {
  fontSize: "14px",
  fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
};

// ---------------------------------------------------------------------------
// Dark theme
// ---------------------------------------------------------------------------

export const darkTheme = EditorView.theme(
  {
    "&": {
      ...baseStyles,
      backgroundColor: "transparent",
      color: "oklch(0.985 0 0)",
    },
    ".cm-content": {
      caretColor: "oklch(0.985 0 0)",
      padding: "16px 0",
      lineHeight: "1.7",
    },
    ".cm-cursor, .cm-dropCursor": {
      borderLeftColor: "oklch(0.985 0 0)",
      borderLeftWidth: "2px",
    },
    "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection":
      {
        backgroundColor: "oklch(0.488 0.243 264.376 / 25%)",
      },
    ".cm-activeLine": {
      backgroundColor: "oklch(1 0 0 / 3%)",
    },
    ".cm-gutters": {
      backgroundColor: "transparent",
      color: "oklch(0.556 0 0)",
      border: "none",
      paddingRight: "8px",
    },
    ".cm-activeLineGutter": {
      backgroundColor: "transparent",
      color: "oklch(0.708 0 0)",
    },
    ".cm-foldPlaceholder": {
      backgroundColor: "oklch(0.269 0 0)",
      border: "none",
      color: "oklch(0.708 0 0)",
    },
    ".cm-tooltip": {
      backgroundColor: "oklch(0.205 0 0)",
      border: "1px solid oklch(1 0 0 / 10%)",
      borderRadius: "6px",
    },
    ".cm-tooltip-autocomplete": {
      "& > ul > li[aria-selected]": {
        backgroundColor: "oklch(0.269 0 0)",
      },
    },
    ".cm-scroller": {
      overflow: "auto",
    },
  },
  { dark: true }
);

export const darkHighlightStyle = syntaxHighlighting(
  HighlightStyle.define([
    { tag: tags.keyword, color: "oklch(0.7 0.15 300)" },
    { tag: tags.comment, color: "oklch(0.556 0 0)", fontStyle: "italic" },
    { tag: tags.string, color: "oklch(0.75 0.15 150)" },
    { tag: tags.number, color: "oklch(0.8 0.15 80)" },
    { tag: tags.heading, color: "oklch(0.9 0 0)", fontWeight: "bold" },
    { tag: tags.heading1, fontSize: "1.4em" },
    { tag: tags.heading2, fontSize: "1.25em" },
    { tag: tags.heading3, fontSize: "1.1em" },
    { tag: tags.emphasis, fontStyle: "italic", color: "oklch(0.85 0.05 60)" },
    { tag: tags.strong, fontWeight: "bold", color: "oklch(0.92 0 0)" },
    { tag: tags.link, color: "oklch(0.7 0.18 250)", textDecoration: "underline" },
    { tag: tags.url, color: "oklch(0.6 0.12 250)" },
    { tag: tags.monospace, color: "oklch(0.75 0.15 150)" },
    { tag: tags.strikethrough, textDecoration: "line-through" },
    { tag: tags.quote, color: "oklch(0.708 0 0)", fontStyle: "italic" },
    { tag: tags.meta, color: "oklch(0.556 0 0)" },
    { tag: tags.processingInstruction, color: "oklch(0.7 0.15 300)" },
  ])
);

// ---------------------------------------------------------------------------
// Light theme
// ---------------------------------------------------------------------------

export const lightTheme = EditorView.theme(
  {
    "&": {
      ...baseStyles,
      backgroundColor: "transparent",
      color: "oklch(0.145 0 0)",
    },
    ".cm-content": {
      caretColor: "oklch(0.145 0 0)",
      padding: "16px 0",
      lineHeight: "1.7",
    },
    ".cm-cursor, .cm-dropCursor": {
      borderLeftColor: "oklch(0.145 0 0)",
      borderLeftWidth: "2px",
    },
    "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection":
      {
        backgroundColor: "oklch(0.488 0.243 264.376 / 15%)",
      },
    ".cm-activeLine": {
      backgroundColor: "oklch(0 0 0 / 3%)",
    },
    ".cm-gutters": {
      backgroundColor: "transparent",
      color: "oklch(0.556 0 0)",
      border: "none",
      paddingRight: "8px",
    },
    ".cm-activeLineGutter": {
      backgroundColor: "transparent",
      color: "oklch(0.35 0 0)",
    },
    ".cm-foldPlaceholder": {
      backgroundColor: "oklch(0.95 0 0)",
      border: "none",
      color: "oklch(0.556 0 0)",
    },
    ".cm-tooltip": {
      backgroundColor: "oklch(1 0 0)",
      border: "1px solid oklch(0 0 0 / 12%)",
      borderRadius: "6px",
    },
    ".cm-tooltip-autocomplete": {
      "& > ul > li[aria-selected]": {
        backgroundColor: "oklch(0.97 0 0)",
      },
    },
    ".cm-scroller": {
      overflow: "auto",
    },
  },
  { dark: false }
);

export const lightHighlightStyle = syntaxHighlighting(
  HighlightStyle.define([
    { tag: tags.keyword, color: "oklch(0.45 0.2 300)" },
    { tag: tags.comment, color: "oklch(0.556 0 0)", fontStyle: "italic" },
    { tag: tags.string, color: "oklch(0.45 0.18 150)" },
    { tag: tags.number, color: "oklch(0.5 0.18 50)" },
    { tag: tags.heading, color: "oklch(0.2 0 0)", fontWeight: "bold" },
    { tag: tags.heading1, fontSize: "1.4em" },
    { tag: tags.heading2, fontSize: "1.25em" },
    { tag: tags.heading3, fontSize: "1.1em" },
    { tag: tags.emphasis, fontStyle: "italic", color: "oklch(0.45 0.08 50)" },
    { tag: tags.strong, fontWeight: "bold", color: "oklch(0.2 0 0)" },
    { tag: tags.link, color: "oklch(0.45 0.22 250)", textDecoration: "underline" },
    { tag: tags.url, color: "oklch(0.5 0.15 250)" },
    { tag: tags.monospace, color: "oklch(0.45 0.18 150)" },
    { tag: tags.strikethrough, textDecoration: "line-through" },
    { tag: tags.quote, color: "oklch(0.45 0 0)", fontStyle: "italic" },
    { tag: tags.meta, color: "oklch(0.556 0 0)" },
    { tag: tags.processingInstruction, color: "oklch(0.45 0.2 300)" },
  ])
);
