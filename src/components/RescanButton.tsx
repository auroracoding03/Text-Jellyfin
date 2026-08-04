"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export function RescanButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onScan() {
    setMessage(null);
    setError(null);
    try {
      const response = await fetch("/api/scan", { method: "POST" });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "Scan failed");
      }
      setMessage(payload.message || "Scan complete");
      startTransition(() => router.refresh());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Scan failed");
    }
  }

  return (
    <div>
      <button className="button button-primary" type="button" onClick={onScan} disabled={pending}>
        {pending ? "Scanning…" : "Rescan library"}
      </button>
      {message ? <p className="panel" style={{ marginTop: "0.75rem" }}>{message}</p> : null}
      {error ? (
        <p className="panel" style={{ marginTop: "0.75rem", color: "var(--danger)" }}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
