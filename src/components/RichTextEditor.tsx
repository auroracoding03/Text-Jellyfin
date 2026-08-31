"use client";

import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { marked } from "marked";
import { useEffect, useRef } from "react";
import TurndownService from "turndown";
import {
  listNoteAssetFilenames,
  noteAssetMarkdownSrc,
  parseNoteAssetFilename,
} from "@/lib/notes/asset-refs";
import {
  CLIENT_MAX_NOTE_IMAGE_BYTES,
  CLIENT_MAX_NOTE_IMAGES,
  compressImage,
} from "@/lib/notes/compress-image";
import {
  normalizePastedHtml,
  normalizePastedText,
} from "@/lib/notes/normalize-pasted-text";
import {
  classifyClipboardDataTransfer,
  imageFilesFromDataTransfer,
  noteImgPlaceholder,
  prepareMixedPaste,
} from "@/lib/notes/paste-images";

const turndown = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
  bulletListMarker: "-",
});

turndown.addRule("noteImages", {
  filter: "img",
  replacement(_content, node) {
    const element = node as HTMLElement;
    const asset = element.getAttribute("data-asset");
    const src = element.getAttribute("src") || "";
    const alt = element.getAttribute("alt") || "";
    const title = element.getAttribute("title");
    const href = asset || src;
    if (!href || href.startsWith("blob:") || href.startsWith("data:")) return "";
    const titlePart = title ? ` "${title}"` : "";
    return `![${alt}](${href}${titlePart})`;
  },
});

const NoteImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      asset: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-asset"),
        renderHTML: (attributes) =>
          attributes.asset ? { "data-asset": attributes.asset } : {},
      },
    };
  },
});

type PendingImage = {
  filename: string;
  file: File;
  previewUrl: string;
};

export type PendingNoteImage = {
  filename: string;
  file: File;
};

type RichTextEditorProps = {
  value: string;
  onChange: (markdown: string) => void;
  onPendingImagesChange?: (images: PendingNoteImage[]) => void;
  onError?: (message: string) => void;
  documentId?: string;
  maxNoteImages?: number;
  maxNoteImageBytes?: number;
  placeholder?: string;
  id?: string;
  minHeight?: string;
};

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Could not read this image."));
    reader.readAsDataURL(file);
  });
}

function newAssetFilename(): string {
  const id =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID().replace(/-/g, "").slice(0, 12)
      : `${Date.now().toString(16)}${Math.random().toString(16).slice(2, 8)}`;
  return `${id}.jpg`;
}

function markdownToEditorHtml(
  markdown: string,
  options: { documentId?: string; pending: Map<string, PendingImage> },
): string {
  const html = marked.parse(markdown || "", { async: false, breaks: true }) as string;
  if (typeof window === "undefined") return html;
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, "text/html");
  const root = doc.body.firstElementChild;
  if (!root) return html;
  for (const img of Array.from(root.querySelectorAll("img"))) {
    const src = img.getAttribute("src") || "";
    const filename =
      parseNoteAssetFilename(src) ||
      parseNoteAssetFilename(img.getAttribute("data-asset") || "");
    if (!filename) continue;
    const asset = noteAssetMarkdownSrc(filename);
    img.setAttribute("data-asset", asset);
    const pending = options.pending.get(filename);
    if (pending) {
      img.setAttribute("src", pending.previewUrl);
    } else if (options.documentId) {
      img.setAttribute(
        "src",
        `/api/works/${options.documentId}/note-assets/${encodeURIComponent(filename)}`,
      );
    } else {
      img.setAttribute("src", asset);
    }
  }
  return root.innerHTML;
}

function htmlToMarkdown(html: string): string {
  return turndown.turndown(html || "").trim();
}

export function RichTextEditor({
  value,
  onChange,
  onPendingImagesChange,
  onError,
  documentId,
  maxNoteImages = CLIENT_MAX_NOTE_IMAGES,
  maxNoteImageBytes = CLIENT_MAX_NOTE_IMAGE_BYTES,
  placeholder = "Write your note…",
  id,
  minHeight = "16rem",
}: RichTextEditorProps) {
  const pendingRef = useRef(new Map<string, PendingImage>());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const documentIdRef = useRef(documentId);
  const onChangeRef = useRef(onChange);
  const onPendingRef = useRef(onPendingImagesChange);
  const onErrorRef = useRef(onError);
  const maxImagesRef = useRef(maxNoteImages);
  const maxBytesRef = useRef(maxNoteImageBytes);
  documentIdRef.current = documentId;
  onChangeRef.current = onChange;
  onPendingRef.current = onPendingImagesChange;
  onErrorRef.current = onError;
  maxImagesRef.current = maxNoteImages;
  maxBytesRef.current = maxNoteImageBytes;
  const insertImagesRef = useRef<(files: File[]) => Promise<void>>(async () => {});
  const handleMixedPasteRef = useRef<(clipboard: DataTransfer) => Promise<void>>(
    async () => {},
  );

  function emitPending() {
    onPendingRef.current?.(
      Array.from(pendingRef.current.values()).map(({ filename, file }) => ({
        filename,
        file,
      })),
    );
  }

  function prunePending(markdown: string, editorHtml?: string) {
    const refs = new Set(listNoteAssetFilenames(markdown));
    if (editorHtml && typeof window !== "undefined") {
      const doc = new DOMParser().parseFromString(editorHtml, "text/html");
      for (const img of Array.from(doc.querySelectorAll("img"))) {
        const src = img.getAttribute("src") || "";
        const fromAsset = parseNoteAssetFilename(img.getAttribute("data-asset") || "");
        const fromSrc = parseNoteAssetFilename(src);
        if (fromAsset) refs.add(fromAsset);
        if (fromSrc) refs.add(fromSrc);
        for (const [filename, entry] of Array.from(pendingRef.current.entries())) {
          if (entry.previewUrl === src) refs.add(filename);
        }
      }
    }
    let changed = false;
    for (const [filename, entry] of Array.from(pendingRef.current.entries())) {
      if (refs.has(filename)) continue;
      if (entry.previewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(entry.previewUrl);
      }
      pendingRef.current.delete(filename);
      changed = true;
    }
    if (changed) emitPending();
  }

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      NoteImage.configure({
        inline: false,
        allowBase64: true,
        HTMLAttributes: { class: "note-inline-image" },
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" },
      }),
      Placeholder.configure({ placeholder }),
    ],
    content: markdownToEditorHtml(value, {
      documentId,
      pending: pendingRef.current,
    }),
    editorProps: {
      attributes: {
        class: "rich-text-prose",
        ...(id ? { id } : {}),
      },
      transformPastedText(text) {
        return normalizePastedText(text);
      },
      transformPastedHTML(html) {
        return normalizePastedHtml(html);
      },
      handlePaste(_view, event) {
        const clipboard = event.clipboardData;
        if (!clipboard) return false;
        const kind = classifyClipboardDataTransfer(clipboard);
        if (kind === "image-only") {
          event.preventDefault();
          void insertImagesRef.current(imageFilesFromDataTransfer(clipboard));
          return true;
        }
        if (kind === "mixed") {
          event.preventDefault();
          void handleMixedPasteRef.current(clipboard);
          return true;
        }
        return false;
      },
      handleDrop(_view, event) {
        const files = imageFilesFromDataTransfer(event.dataTransfer);
        if (!files.length) return false;
        event.preventDefault();
        void insertImagesRef.current(files);
        return true;
      },
    },
    onUpdate: ({ editor: current }) => {
      const html = current.getHTML();
      const markdown = htmlToMarkdown(html);
      prunePending(markdown, html);
      onChangeRef.current(markdown);
    },
  });

  async function attachCompressedImage(file: File, alt: string): Promise<string> {
    const compressed = await compressImage(file, {
      maxBytes: maxBytesRef.current,
    });
    const filename = newAssetFilename();
    const previewUrl = await fileToDataUrl(compressed);
    const asset = noteAssetMarkdownSrc(filename);
    pendingRef.current.set(filename, {
      filename,
      file: compressed,
      previewUrl,
    });
    return `<img src="${previewUrl}" alt="${escapeAttr(alt)}" data-asset="${escapeAttr(asset)}">`;
  }

  insertImagesRef.current = async (files: File[]) => {
    if (!editor) return;
    const markdown = htmlToMarkdown(editor.getHTML());
    const existing = listNoteAssetFilenames(markdown).length;
    if (existing + files.length > maxImagesRef.current) {
      onErrorRef.current?.(
        `Notes can include at most ${maxImagesRef.current} images.`,
      );
      return;
    }

    for (const file of files) {
      try {
        const alt = file.name.replace(/\.[^.]+$/, "") || "pasted image";
        const imgHtml = await attachCompressedImage(file, alt);
        editor.chain().focus().insertContent(imgHtml).run();
      } catch (error) {
        onErrorRef.current?.(
          error instanceof Error ? error.message : "Could not insert this image.",
        );
      }
    }
    emitPending();
  };

  handleMixedPasteRef.current = async (clipboard: DataTransfer) => {
    if (!editor) return;
    const html = normalizePastedHtml(clipboard.getData("text/html")?.trim() || "");
    const plain = normalizePastedText(clipboard.getData("text/plain")?.trim() || "");
    const sourceHtml = html || (plain ? `<p>${escapeHtml(plain)}</p>` : "");
    if (!sourceHtml) return;

    const prepared = await prepareMixedPaste(
      sourceHtml,
      imageFilesFromDataTransfer(clipboard),
    );
    const markdown = htmlToMarkdown(editor.getHTML());
    const existing = listNoteAssetFilenames(markdown).length;
    if (existing + prepared.pending.length > maxImagesRef.current) {
      onErrorRef.current?.(
        `Notes can include at most ${maxImagesRef.current} images.`,
      );
      return;
    }

    let finalHtml = prepared.html;
    for (const item of prepared.pending) {
      try {
        const file = await item.source;
        const imgHtml = await attachCompressedImage(file, item.alt);
        finalHtml = finalHtml.replace(noteImgPlaceholder(item.index), imgHtml);
      } catch (error) {
        finalHtml = finalHtml.replace(noteImgPlaceholder(item.index), "");
        onErrorRef.current?.(
          error instanceof Error ? error.message : "Could not insert this image.",
        );
      }
    }

    editor.chain().focus().insertContent(finalHtml).run();
    emitPending();
    if (prepared.skippedImages > 0) {
      onErrorRef.current?.(
        "Some images could not be attached. Use the Image button for those.",
      );
    }
  };

  useEffect(() => {
    if (!editor) return;
    const current = htmlToMarkdown(editor.getHTML());
    if (current === (value || "").trim()) return;
    editor.commands.setContent(
      markdownToEditorHtml(value, {
        documentId: documentIdRef.current,
        pending: pendingRef.current,
      }),
      { emitUpdate: false },
    );
    const refs = new Set(listNoteAssetFilenames(value || ""));
    let changed = false;
    for (const [filename, entry] of Array.from(pendingRef.current.entries())) {
      if (refs.has(filename)) continue;
      if (entry.previewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(entry.previewUrl);
      }
      pendingRef.current.delete(filename);
      changed = true;
    }
    if (changed) emitPending();
  }, [editor, value]);

  useEffect(() => {
    const pending = pendingRef.current;
    return () => {
      for (const entry of Array.from(pending.values())) {
        if (entry.previewUrl.startsWith("blob:")) {
          URL.revokeObjectURL(entry.previewUrl);
        }
      }
    };
  }, []);

  if (!editor) {
    return <div className="rich-text-editor rich-text-editor-loading" style={{ minHeight }} />;
  }

  return (
    <div className="rich-text-editor" style={{ minHeight }}>
      <div className="rich-text-toolbar" role="toolbar" aria-label="Formatting">
        <ToolbarButton
          label="Bold"
          active={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
        />
        <ToolbarButton
          label="Italic"
          active={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        />
        <ToolbarButton
          label="H2"
          active={editor.isActive("heading", { level: 2 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        />
        <ToolbarButton
          label="H3"
          active={editor.isActive("heading", { level: 3 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        />
        <ToolbarButton
          label="List"
          active={editor.isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        />
        <ToolbarButton
          label="Numbered"
          active={editor.isActive("orderedList")}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        />
        <ToolbarButton
          label="Quote"
          active={editor.isActive("blockquote")}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
        />
        <ToolbarButton
          label="Code"
          active={editor.isActive("code")}
          onClick={() => editor.chain().focus().toggleCode().run()}
        />
        <ToolbarButton
          label="Link"
          active={editor.isActive("link")}
          onClick={() => {
            const previous = editor.getAttributes("link").href as string | undefined;
            const next = window.prompt("Link URL", previous || "https://");
            if (next === null) return;
            if (next.trim() === "") {
              editor.chain().focus().extendMarkRange("link").unsetLink().run();
              return;
            }
            editor.chain().focus().extendMarkRange("link").setLink({ href: next.trim() }).run();
          }}
        />
        <ToolbarButton
          label="Image"
          active={false}
          onClick={() => fileInputRef.current?.click()}
        />
      </div>
      <input
        ref={fileInputRef}
        className="upload-file-input"
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif,image/*"
        multiple
        onChange={(event) => {
          const files = Array.from(event.target.files || []);
          event.target.value = "";
          if (files.length) void insertImagesRef.current(files);
        }}
      />
      <EditorContent editor={editor} />
    </div>
  );
}

function ToolbarButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`rich-text-toolbar-button${active ? " is-active" : ""}`}
      onClick={onClick}
      aria-pressed={active}
    >
      {label}
    </button>
  );
}
