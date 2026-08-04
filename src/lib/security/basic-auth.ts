export function isBasicAuthValid(
  authorization: string | null,
  username: string,
  password: string,
): boolean {
  if (!username || !password || !authorization?.startsWith("Basic ")) {
    return false;
  }

  try {
    const decoded = atob(authorization.slice("Basic ".length));
    const separator = decoded.indexOf(":");
    if (separator < 0) return false;
    return (
      decoded.slice(0, separator) === username &&
      decoded.slice(separator + 1) === password
    );
  } catch {
    return false;
  }
}
