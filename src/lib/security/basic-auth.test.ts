import { describe, expect, it } from "vitest";
import { isBasicAuthValid } from "@/lib/security/basic-auth";

function basicHeader(username: string, password: string): string {
  return `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`;
}

describe("basic authentication", () => {
  it("accepts an exact username and password", () => {
    expect(isBasicAuthValid(basicHeader("reader", "secret"), "reader", "secret")).toBe(true);
  });

  it("rejects missing, malformed, and incorrect credentials", () => {
    expect(isBasicAuthValid(null, "reader", "secret")).toBe(false);
    expect(isBasicAuthValid("Bearer token", "reader", "secret")).toBe(false);
    expect(isBasicAuthValid(basicHeader("reader", "wrong"), "reader", "secret")).toBe(false);
    expect(isBasicAuthValid(basicHeader("reader", "secret"), "", "secret")).toBe(false);
  });
});
