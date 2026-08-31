import { config } from "@/lib/config";

export const FORM_OVERHEAD_BYTES = 64 * 1024;

export function exceedsNotePayloadLimit(contentLength: number): boolean {
  if (!contentLength) return false;
  return contentLength > config.maxNotePayloadBytes + FORM_OVERHEAD_BYTES;
}

export function notePayloadLimitError(): string {
  return `Upload exceeds the ${config.maxNotePayloadBytes} byte upload limit.`;
}
