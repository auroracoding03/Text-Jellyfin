"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { PendingNoteImage } from "@/components/RichTextEditor";
import { apiUrl } from "@/lib/client/api-url";

const RichTextEditor = dynamic(
  () => import("@/components/RichTextEditor").then((mod) => mod.RichTextEditor),
  {
    ssr: false,
    loading: () => <div className="rich-text-editor rich-text-editor-loading" />,
  },
);

export function DocumentContentForm({
  id,
  initialContent,
  format = "md",
  maxNoteImages = 15,
  maxNoteImageBytes = 1024 * 1024,
}: {
  id: string;
  initialContent: string;
  format?: "md" | "txt" | string;
  maxNoteImages?: number;
  maxNoteImageBytes?: number;
}) {
  const router = useRouter();
  const [content, setContent] = useState(initialContent);
  const [pendingImages, setPendingImages] = useState<PendingNoteImage[]>([]);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const rich = format === "md";

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!content.trim()) {
      setError("Article text cannot be empty.");
      return;
    }
    try {
      const body = new FormData();
      body.set("content", content);
      for (const image of pendingImages) {
        body.append("images", image.file, image.filename);
      }
      const response = await fetch(apiUrl(`/api/works/${id}/content`), {
        method: "PUT",
        body,
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Failed to save article text.");
      startTransition(() => {
        router.push(`/works/${id}`);
        router.refresh();
      });
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save article text.");
    }
  }

  return (
    <form className="form-grid panel content-editor" onSubmit={onSubmit}>
      <div className="field">
        <label htmlFor="article-content">{rich ? "Note text" : "Article text"}</label>
        {rich ? (
          <RichTextEditor
            id="article-content"
            value={content}
            onChange={setContent}
            onPendingImagesChange={setPendingImages}
            onError={setError}
            documentId={id}
            maxNoteImages={maxNoteImages}
            maxNoteImageBytes={maxNoteImageBytes}
            placeholder="Edit your note…"
            minHeight="24rem"
          />
        ) : (
          <textarea
            id="article-content"
            rows={18}
            value={content}
            onChange={(event) => setContent(event.target.value)}
            required
          />
        )}
      </div>
      {error ? <p className="form-message form-error">{error}</p> : null}
      <button className="button button-primary" type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save article text"}
      </button>
    </form>
  );
}
