import type { ExtractionStatus } from "@/lib/catalog/types";

const LABELS: Record<ExtractionStatus, string> = {
  ready: "Ready",
  warning: "Warning",
  needs_ocr: "Needs OCR",
  unsupported: "Unsupported",
  failed: "Failed",
  absent: "Absent",
};

export function StatusBadge({ status }: { status: ExtractionStatus }) {
  return <span className={`badge badge-${status}`}>{LABELS[status]}</span>;
}
