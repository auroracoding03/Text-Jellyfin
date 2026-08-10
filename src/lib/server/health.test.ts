import { describe, expect, it } from "vitest";
import { createHealthIdentity } from "@/lib/server/health";

describe("health identity", () => {
  it("identifies the packaged Windows service", () => {
    expect(createHealthIdentity("0.10.0", true)).toEqual({
      status: "ok",
      name: "Text Jellyfin",
      version: "0.10.0",
      serviceMode: true,
    });
  });

  it("does not claim service mode for ordinary Next.js runs", () => {
    expect(createHealthIdentity("0.10.0", false).serviceMode).toBe(false);
  });
});
