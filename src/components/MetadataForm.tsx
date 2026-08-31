"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { apiUrl } from "@/lib/client/api-url";

export function MetadataForm({
  id,
  initial,
}: {
  id: string;
  initial: {
    title: string;
    summary: string;
    author: string;
    series: string;
    chapter: string;
    language: string;
    tags: string;
  };
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(initial);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      const response = await fetch(apiUrl(`/api/works/${id}/metadata`), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          chapter: form.chapter.trim() ? Number(form.chapter.trim()) : null,
          tags: form.tags
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean),
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "Failed to save metadata");
      }
      startTransition(() => {
        router.push(`/works/${id}`);
        router.refresh();
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save metadata");
    }
  }

  return (
    <form className="form-grid panel" onSubmit={onSubmit}>
      <div className="field">
        <label htmlFor="title">Title</label>
        <input
          id="title"
          value={form.title}
          onChange={(event) => setForm({ ...form, title: event.target.value })}
          required
        />
      </div>
      <div className="field">
        <label htmlFor="summary">Summary</label>
        <textarea
          id="summary"
          rows={4}
          value={form.summary}
          onChange={(event) => setForm({ ...form, summary: event.target.value })}
        />
      </div>
      <div className="field">
        <label htmlFor="author">Author</label>
        <input
          id="author"
          value={form.author}
          onChange={(event) => setForm({ ...form, author: event.target.value })}
        />
      </div>
      <div className="field">
        <label htmlFor="series">Series</label>
        <input
          id="series"
          value={form.series}
          onChange={(event) => setForm({ ...form, series: event.target.value })}
          placeholder="Groups chapters in the library feed"
        />
      </div>
      <div className="field">
        <label htmlFor="chapter">Chapter number</label>
        <input
          id="chapter"
          type="number"
          min={1}
          step={1}
          value={form.chapter}
          onChange={(event) => setForm({ ...form, chapter: event.target.value })}
          placeholder="1"
        />
      </div>
      <div className="field">
        <label htmlFor="language">Language</label>
        <input
          id="language"
          value={form.language}
          onChange={(event) => setForm({ ...form, language: event.target.value })}
        />
      </div>
      <div className="field">
        <label htmlFor="tags">Tags (comma-separated)</label>
        <input
          id="tags"
          value={form.tags}
          onChange={(event) => setForm({ ...form, tags: event.target.value })}
        />
      </div>
      {error ? <p style={{ color: "var(--danger)", margin: 0 }}>{error}</p> : null}
      <button className="button button-primary" type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save metadata"}
      </button>
    </form>
  );
}
