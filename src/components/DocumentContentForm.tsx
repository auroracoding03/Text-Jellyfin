"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export function DocumentContentForm({ id, initialContent }: { id: string; initialContent: string }) {
  const router = useRouter();
  const [content, setContent] = useState(initialContent);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
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
        <label htmlFor="article-content">Article text</label>
        <textarea
          id="article-content"
          rows={18}
          value={content}
          onChange={(event) => setContent(event.target.value)}
          required
        />
      </div>
      {error ? <p className="form-message form-error">{error}</p> : null}
      <button className="button button-primary" type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save article text"}
      </button>
    </form>
  );
}
