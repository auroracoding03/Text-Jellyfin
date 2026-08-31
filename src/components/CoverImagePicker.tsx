"use client";

import { useEffect, useRef, useState } from "react";
import {
  CLIENT_MAX_NOTE_IMAGE_BYTES,
  compressImage,
} from "@/lib/notes/compress-image";

export type CoverSelectionState = "none" | "saved" | "pending" | "removed";

type CoverImagePickerProps = {
  coverUrl?: string | null | undefined;
  maxBytes?: number;
  selectionState?: CoverSelectionState;
  statusMessage?: string | null;
  onChange: (file: File | null | "clear") => void;
  onError?: (message: string) => void;
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Could not read this image."));
    reader.readAsDataURL(file);
  });
}

export function CoverImagePicker({
  coverUrl,
  maxBytes = CLIENT_MAX_NOTE_IMAGE_BYTES,
  selectionState = "none",
  statusMessage,
  onChange,
  onError,
}: CoverImagePickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(coverUrl || null);
  const [previewError, setPreviewError] = useState(false);
  const [pending, setPending] = useState(false);
  const [selectionLabel, setSelectionLabel] = useState<string | null>(null);

  useEffect(() => {
    if (coverUrl !== undefined) {
      setPreviewUrl(coverUrl || null);
      setPreviewError(false);
      if (coverUrl) {
        setSelectionLabel(null);
      }
    }
  }, [coverUrl]);

  async function onFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setPending(true);
    setPreviewError(false);
    try {
      const compressed = await compressImage(file, {
        maxBytes,
        crop: "center-square",
      });
      setPreviewUrl(await fileToDataUrl(compressed));
      setSelectionLabel(`${compressed.name} (${formatBytes(compressed.size)})`);
      onChange(compressed);
    } catch (error) {
      onError?.(error instanceof Error ? error.message : "Could not process cover image.");
    } finally {
      setPending(false);
    }
  }

  function clearCover() {
    setPreviewUrl(null);
    setPreviewError(false);
    setSelectionLabel(null);
    onChange("clear");
  }

  const showPreview = Boolean(previewUrl) && !previewError;
  const hasAssociation =
    selectionState === "saved" ||
    selectionState === "pending" ||
    Boolean(previewUrl);

  return (
    <div className="field cover-picker">
      <span className="field-label">Cover image (optional)</span>
      <p className="cover-picker-help">
        Square cover for library cards. Same size limits as inline note images.
      </p>
      <div className="cover-picker-row">
        <div
          className={`cover-picker-preview${previewError ? " cover-picker-preview-error" : ""}`}
          aria-hidden={!hasAssociation}
        >
          {showPreview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewUrl!}
              alt=""
              onError={() => setPreviewError(true)}
              onLoad={() => setPreviewError(false)}
            />
          ) : previewError ? (
            <span>Preview unavailable</span>
          ) : hasAssociation ? (
            <span>Cover attached</span>
          ) : (
            <span>No cover</span>
          )}
        </div>
        <div className="cover-picker-actions">
          <input
            ref={inputRef}
            className="upload-file-input"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            onChange={onFileChange}
          />
          <button
            className="button"
            type="button"
            disabled={pending}
            onClick={() => inputRef.current?.click()}
          >
            {pending ? "Processing…" : hasAssociation ? "Replace cover" : "Choose cover"}
          </button>
          {hasAssociation ? (
            <button className="button" type="button" onClick={clearCover}>
              Remove cover
            </button>
          ) : null}
        </div>
      </div>
      {selectionLabel ? (
        <p className="cover-picker-file">
          <strong>Selected:</strong> <code>{selectionLabel}</code>
        </p>
      ) : null}
      {statusMessage ? (
        <p
          className={`cover-picker-status${
            selectionState === "removed" ? " cover-picker-status-warning" : ""
          }`}
          role="status"
        >
          {statusMessage}
        </p>
      ) : null}
    </div>
  );
}
