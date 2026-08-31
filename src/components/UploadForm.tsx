"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useRef, useState } from "react";
import type { PendingNoteImage } from "@/components/RichTextEditor";
import { apiUrl } from "@/lib/client/api-url";

const RichTextEditor = dynamic(
  () => import("@/components/RichTextEditor").then((mod) => mod.RichTextEditor),
  {
    ssr: false,
    loading: () => <div className="rich-text-editor rich-text-editor-loading" />,
  },
);

type UploadMode = "file" | "text";

type UploadResponse = {
  error?: string;
  documentId?: string | null;
  relativePath?: string;
};

/** Keep accept loose — iOS Safari often fails to open the picker with .md-only filters. */
const FILE_ACCEPT = "text/plain,text/markdown,text/*,.txt,.md,.markdown,.text";

export function UploadForm({
  maxUploadBytes,
  maxNoteImages = 15,
  maxNoteImageBytes = 1024 * 1024,
}: {
  maxUploadBytes: number;
  maxNoteImages?: number;
  maxNoteImageBytes?: number;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<UploadMode>("file");
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [author, setAuthor] = useState("");
  const [series, setSeries] = useState("");
  const [chapter, setChapter] = useState("");
  const [tags, setTags] = useState("");
  const [format, setFormat] = useState("md");
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [pendingImages, setPendingImages] = useState<PendingNoteImage[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<UploadResponse | null>(null);

  function chooseFile() {
    setError(null);
    fileInputRef.current?.click();
  }

  function onFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const next = event.target.files?.[0] || null;
    setFile(next);
    setError(null);
    setSuccess(null);
    event.target.value = "";
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (mode === "file" && !file) {
      setError("Choose a Markdown or plain-text file.");
      return;
    }
    if (mode === "text" && !text.trim()) {
      setError("Write or paste some text before uploading.");
      return;
    }

    const body = new FormData();
    body.set("kind", mode);
    body.set("title", title);
    body.set("summary", summary);
    body.set("author", author);
    body.set("series", series);
    body.set("chapter", chapter);
    body.set("tags", tags);
    if (mode === "file" && file) body.set("file", file, file.name);
    if (mode === "text") {
      body.set("format", format);
      body.set("text", text);
      if (format === "md") {
        for (const image of pendingImages) {
          body.append("images", image.file, image.filename);
        }
      }
    }

    setPending(true);
    try {
      const response = await fetch(apiUrl("/api/uploads"), {
        method: "POST",
        body,
        credentials: "same-origin",
      });
      const payload = (await response.json()) as UploadResponse;
      if (!response.ok) throw new Error(payload.error || "Upload failed.");

      setSuccess(payload);
      setTitle("");
      setSummary("");
      setChapter("");
      setTags("");
      setText("");
      setPendingImages([]);
      setFile(null);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Upload failed.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="form-grid panel upload-form" onSubmit={onSubmit}>
      <div className="upload-mode" role="tablist" aria-label="Upload type">
        <button
          className={`button ${mode === "file" ? "button-primary" : ""}`}
          type="button"
          onClick={() => setMode("file")}
          aria-pressed={mode === "file"}
          aria-controls="upload-file-panel"
        >
          Upload a file
        </button>
        <button
          className={`button ${mode === "text" ? "button-primary" : ""}`}
          type="button"
          onClick={() => setMode("text")}
          aria-pressed={mode === "text"}
          aria-controls="paste-text-panel"
        >
          Paste text
        </button>
      </div>

      <div className="field">
        <label htmlFor="upload-title">
          {mode === "text" ? "Title" : "Optional title override"}
        </label>
        <input
          id="upload-title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          required={mode === "text"}
          placeholder={mode === "text" ? "A name for this note" : "Use the file name by default"}
        />
      </div>

      <div className="field">
        <label htmlFor="upload-summary">Summary / teaser</label>
        <textarea
          id="upload-summary"
          rows={3}
          maxLength={500}
          value={summary}
          onChange={(event) => setSummary(event.target.value)}
          placeholder="A short description for the feed"
        />
        <small>{summary.length}/500 characters</small>
      </div>

      <div className="field">
        <label htmlFor="upload-author">Author (optional)</label>
        <input
          id="upload-author"
          value={author}
          onChange={(event) => setAuthor(event.target.value)}
          placeholder="Who wrote this"
        />
      </div>

      <div className="field">
        <label htmlFor="upload-series">Series (optional)</label>
        <input
          id="upload-series"
          value={series}
          onChange={(event) => setSeries(event.target.value)}
          placeholder="Same name groups chapters in the library"
        />
        <small>
          Chapters with the same series appear as one block in the feed. Leave
          chapter blank to auto-number the next installment.
        </small>
      </div>

      <div className="field">
        <label htmlFor="upload-chapter">Chapter number (optional)</label>
        <input
          id="upload-chapter"
          type="number"
          min={1}
          step={1}
          value={chapter}
          onChange={(event) => setChapter(event.target.value)}
          placeholder="1"
          disabled={!series.trim()}
        />
      </div>

      <div className="field">
        <label htmlFor="upload-tags">Tags (comma-separated)</label>
        <input
          id="upload-tags"
          value={tags}
          onChange={(event) => setTags(event.target.value)}
          placeholder="notes, reading, personal"
        />
      </div>

      {mode === "file" ? (
        <div id="upload-file-panel" className="field upload-panel" role="tabpanel">
          <span className="field-label">Markdown or text file</span>
          <input
            ref={fileInputRef}
            id="upload-file"
            className="upload-file-input"
            type="file"
            accept={FILE_ACCEPT}
            onChange={onFileChange}
          />
          <button className="button" type="button" onClick={chooseFile}>
            {file ? "Choose a different file" : "Choose file"}
          </button>
          {file ? (
            <p className="upload-file-chosen">
              Selected: <code>{file.name}</code> ({formatBytes(file.size)})
            </p>
          ) : (
            <small>
              On iPhone, pick from Files. Use a <code>.txt</code> or <code>.md</code> file
              (or paste text instead). Limit {formatBytes(maxUploadBytes)}.
            </small>
          )}
        </div>
      ) : (
        <div id="paste-text-panel" className="upload-panel" role="tabpanel">
          <p className="upload-panel-intro">
            Paste or write the full article below. Markdown notes support rich formatting
            and inline images (paste, drop, or the Image button). Images are compressed
            before saving. Plain text stays literal. Saved under <code>uploads/pasted/</code>.
          </p>
          <div className="field">
            <label htmlFor="upload-format">Save pasted text as</label>
            <select
              id="upload-format"
              value={format}
              onChange={(event) => setFormat(event.target.value)}
            >
              <option value="md">Markdown (rich text)</option>
              <option value="txt">Plain text</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="upload-text">Article text</label>
            {format === "md" ? (
              <RichTextEditor
                id="upload-text"
                value={text}
                onChange={setText}
                onPendingImagesChange={setPendingImages}
                onError={setError}
                maxNoteImages={maxNoteImages}
                maxNoteImageBytes={maxNoteImageBytes}
                placeholder="Write or paste your note…"
                minHeight="16rem"
              />
            ) : (
              <textarea
                id="upload-text"
                rows={12}
                value={text}
                onChange={(event) => setText(event.target.value)}
                placeholder="Write or paste your note here…"
                required
              />
            )}
          </div>
        </div>
      )}

      {error ? <p className="form-message form-error">{error}</p> : null}
      {success ? (
        <p className="form-message form-success">
          Saved to <code>{success.relativePath}</code>.{" "}
          {success.documentId ? (
            <Link href={`/works/${success.documentId}`}>Open it in your library.</Link>
          ) : (
            "It will appear after the next successful scan."
          )}
        </p>
      ) : null}

      <button className="button button-primary" type="submit" disabled={pending}>
        {pending ? "Uploading and indexing…" : "Add to library"}
      </button>
    </form>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
