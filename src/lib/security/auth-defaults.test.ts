import { describe, expect, it } from "vitest";
import {
  DEFAULT_AUTH_PASSWORD,
  DEFAULT_AUTH_USERNAME,
  resolveAuthCredentials,
} from "@/lib/security/auth-defaults";

describe("auth defaults", () => {
  it("defaults to admin/admin when credentials are unset", () => {
    expect(resolveAuthCredentials(undefined, undefined)).toEqual({
      username: DEFAULT_AUTH_USERNAME,
      password: DEFAULT_AUTH_PASSWORD,
    });
    expect(resolveAuthCredentials("", "")).toEqual({
      username: DEFAULT_AUTH_USERNAME,
      password: DEFAULT_AUTH_PASSWORD,
    });
  });

  it("uses provided credentials when set", () => {
    expect(resolveAuthCredentials("reader", "secret")).toEqual({
      username: "reader",
      password: "secret",
    });
  });
});
