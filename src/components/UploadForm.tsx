"use client";

import Link from "next/link";
import { useState } from "react";

type UploadMode = "file" | "text";

type UploadResponse = {
  error?: string;
  documentId?: string | null;
  relativePath?: string;
};

export function UploadForm({ maxUploadBytes }: { maxUploadBytes: number }) {
  const [mode, setMode] = useState<UploadMode>("file");
  const [title, setTitle] = useState("");
  const [format, setFormat] = useState("md");
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<UploadResponse | null>(null);

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
    if (mode === "file" && file) body.set("file", file);
    if (mode === "text") {
      body.set("format", format);
      body.set("text", text);
    }

    setPending(true);
    try {
      const response = await fetch("/api/uploads", {
        method: "POST",
        body,
      });
      const payload = (await response.json()) as UploadResponse;
      if (!response.ok) throw new Error(payload.error || "Upload failed.");

      setSuccess(payload);
      setTitle("");
      setText("");
      setFile(null);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Upload failed.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="form-grid panel upload-form" onSubmit={onSubmit}>
      <div className="upload-mode" role="group" aria-label="Upload type">
        <button
          className={`button ${mode === "file" ? "button-primary" : ""}`}
          type="button"
          onClick={() => setMode("file")}
          aria-pressed={mode === "file"}
        >
          Upload a file
        </button>
        <button
          className={`button ${mode === "text" ? "button-primary" : ""}`}
          type="button"
          onClick={() => setMode("text")}
          aria-pressed={mode === "text"}
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

      {mode === "file" ? (
        <div className="field">
          <label htmlFor="upload-file">Markdown or text file</label>
          <input
            id="upload-file"
            type="file"
            accept=".md,.markdown,.txt,text/plain,text/markdown"
            onChange={(event) => setFile(event.target.files?.[0] || null)}
          />
          <small>Files are limited to {formatBytes(maxUploadBytes)}.</small>
        </div>
      ) : (
        <>
          <div className="field">
            <label htmlFor="upload-format">Save pasted text as</label>
            <select
              id="upload-format"
              value={format}
              onChange={(event) => setFormat(event.target.value)}
            >
              <option value="md">Markdown</option>
              <option value="txt">Plain text</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="upload-text">Text</label>
            <textarea
              id="upload-text"
              rows={12}
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder="Write or paste your note here…"
              required
            />
          </div>
        </>
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
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
