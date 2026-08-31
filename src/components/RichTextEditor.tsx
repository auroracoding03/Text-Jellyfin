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
    const src = asset || element.getAttribute("src") || "";
    const alt = element.getAttribute("alt") || "";
    const title = element.getAttribute("title");
    if (!src || src.startsWith("blob:")) return "";
    const titlePart = title ? ` "${title}"` : "";
    return `![${alt}](${src}${titlePart})`;
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
  blobUrl: string;
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

function imageFilesFromDataTransfer(
  data: DataTransfer | null | undefined,
): File[] {
  if (!data) return [];
  const fromFiles = Array.from(data.files || []).filter((file) =>
    file.type.startsWith("image/"),
  );
  if (fromFiles.length) return fromFiles;
  const fromItems: File[] = [];
  for (const item of Array.from(data.items || [])) {
    if (item.kind === "file" && item.type.startsWith("image/")) {
      const file = item.getAsFile();
      if (file) fromItems.push(file);
    }
  }
  return fromItems;
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
      img.setAttribute("src", pending.blobUrl);
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
          if (entry.blobUrl === src) refs.add(filename);
        }
      }
    }
    let changed = false;
    for (const [filename, entry] of Array.from(pendingRef.current.entries())) {
      if (refs.has(filename)) continue;
      URL.revokeObjectURL(entry.blobUrl);
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
        allowBase64: false,
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
      handlePaste(_view, event) {
        const files = imageFilesFromDataTransfer(event.clipboardData);
        if (!files.length) return false;
        event.preventDefault();
        void insertImagesRef.current(files);
        return true;
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
        const compressed = await compressImage(file);
        if (compressed.size > maxBytesRef.current) {
          onErrorRef.current?.(
            `Each image must be ${Math.ceil(maxBytesRef.current / 1024)} KB or smaller after compression.`,
          );
          continue;
        }
        const filename = newAssetFilename();
        const blobUrl = URL.createObjectURL(compressed);
        pendingRef.current.set(filename, {
          filename,
          file: compressed,
          blobUrl,
        });
        editor.chain().focus().insertContent({
          type: "image",
          attrs: {
            src: blobUrl,
            alt: file.name.replace(/\.[^.]+$/, "") || "pasted image",
            asset: noteAssetMarkdownSrc(filename),
          },
        }).run();
      } catch (error) {
        onErrorRef.current?.(
          error instanceof Error ? error.message : "Could not insert this image.",
        );
      }
    }
    emitPending();
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
      URL.revokeObjectURL(entry.blobUrl);
      pendingRef.current.delete(filename);
      changed = true;
    }
    if (changed) emitPending();
  }, [editor, value]);

  useEffect(() => {
    const pending = pendingRef.current;
    return () => {
      for (const entry of Array.from(pending.values())) URL.revokeObjectURL(entry.blobUrl);
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
