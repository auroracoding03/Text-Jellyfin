"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

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
}: {
  id: string;
  initialContent: string;
  format?: "md" | "txt" | string;
}) {
  const router = useRouter();
  const [content, setContent] = useState(initialContent);
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
      const response = await fetch(`/api/works/${id}/content`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
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
