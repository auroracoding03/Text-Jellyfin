export const DEFAULT_AUTH_USERNAME = "admin";
export const DEFAULT_AUTH_PASSWORD = "admin";

export function resolveAuthCredentials(
  username: string | undefined,
  password: string | undefined,
): { username: string; password: string } {
  const resolvedUsername = username?.trim() || DEFAULT_AUTH_USERNAME;
  const resolvedPassword =
    password === undefined || password === ""
      ? DEFAULT_AUTH_PASSWORD
      : password;
  return { username: resolvedUsername, password: resolvedPassword };
}
