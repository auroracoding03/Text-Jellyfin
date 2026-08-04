"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

function tagsFromValue(value: string): string[] {
  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

export function TagEditor({
  id,
  initialTags,
}: {
  id: string;
  initialTags: string[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(initialTags.join(", "));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function saveTags(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);

    try {
      const response = await fetch(`/api/works/${id}/metadata`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tags: tagsFromValue(value) }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Failed to save tags.");
      setEditing(false);
      router.refresh();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save tags.");
    } finally {
      setPending(false);
    }
  }

  if (editing) {
    return (
      <form className="tag-editor" onSubmit={saveTags}>
        <label htmlFor="article-tags">Tags (comma-separated)</label>
        <div className="tag-editor-controls">
          <input
            id="article-tags"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            autoFocus
          />
          <button className="button button-primary" type="submit" disabled={pending}>
            {pending ? "Saving…" : "Save"}
          </button>
          <button
            className="button"
            type="button"
            onClick={() => {
              setValue(initialTags.join(", "));
              setError(null);
              setEditing(false);
            }}
          >
            Cancel
          </button>
        </div>
        {error ? <p className="form-message form-error">{error}</p> : null}
      </form>
    );
  }

  return (
    <div className="tag-editor">
      <div className="tag-row">
        {initialTags.length ? (
          initialTags.map((tag) => (
            <span key={tag} className="chip">
              {tag}
            </span>
          ))
        ) : (
          <span className="muted">No tags yet</span>
        )}
      </div>
      <button className="button tag-edit-button" type="button" onClick={() => setEditing(true)}>
        Edit tags
      </button>
    </div>
  );
}
