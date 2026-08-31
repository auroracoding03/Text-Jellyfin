/** Resolve an app path against origin so fetch works even if the page was opened with userinfo in the URL. */
export function apiUrl(path: string): string {
  return new URL(path, window.location.origin).href;
}
