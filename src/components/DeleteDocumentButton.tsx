"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { apiUrl } from "@/lib/client/api-url";

export function DeleteDocumentButton({
  id,
  title,
}: {
  id: string;
  title: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function onDelete() {
    const confirmed = window.confirm(
      `Remove “${title}” from your library?\n\nThis deletes the source file and its sidecar from disk. It cannot be undone.`,
    );
    if (!confirmed) return;

    setError(null);
    try {
      const response = await fetch(apiUrl(`/api/works/${id}`), { method: "DELETE" });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "Unable to delete this item.");
      }
      startTransition(() => {
        router.push("/");
        router.refresh();
      });
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Unable to delete this item.",
      );
    }
  }

  return (
    <div className="delete-document">
      <button
        className="button button-danger"
        disabled={pending}
        onClick={() => void onDelete()}
        type="button"
      >
        {pending ? "Deleting…" : "Delete from library"}
      </button>
      {error ? <p className="form-message form-error">{error}</p> : null}
    </div>
  );
}
