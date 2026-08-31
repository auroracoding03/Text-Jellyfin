import { describe, expect, it } from "vitest";
import {
  isSafeAssetFilename,
  listNoteAssetFilenames,
  parseNoteAssetFilename,
} from "@/lib/notes/asset-refs";

describe("note asset refs", () => {
  it("accepts note-assets filenames and stem.assets paths", () => {
    expect(parseNoteAssetFilename("note-assets/a1b2c3d4.jpg")).toBe("a1b2c3d4.jpg");
    expect(parseNoteAssetFilename("./note-assets/a1b2c3d4.jpg")).toBe("a1b2c3d4.jpg");
    expect(
      parseNoteAssetFilename("./Phone note.assets/a1b2c3d4.jpg", "Phone note"),
    ).toBe("a1b2c3d4.jpg");
  });

  it("rejects remote, data, blob, and traversal paths", () => {
    expect(parseNoteAssetFilename("https://example.com/a.jpg")).toBeNull();
    expect(parseNoteAssetFilename("data:image/jpeg;base64,abc")).toBeNull();
    expect(parseNoteAssetFilename("blob:http://localhost/uuid")).toBeNull();
    expect(parseNoteAssetFilename("../escape.jpg")).toBeNull();
    expect(parseNoteAssetFilename("note-assets/../escape.jpg")).toBeNull();
    expect(parseNoteAssetFilename("note-assets/foo/bar.jpg")).toBeNull();
    expect(parseNoteAssetFilename("/etc/passwd")).toBeNull();
  });

  it("lists unique markdown image filenames", () => {
    const names = listNoteAssetFilenames(
      "Hello ![one](note-assets/one.jpg) and ![two](note-assets/one.jpg) ![three](note-assets/two.jpg)",
    );
    expect(names.sort()).toEqual(["one.jpg", "two.jpg"]);
  });

  it("rejects unsafe filenames", () => {
    expect(isSafeAssetFilename("../x.jpg")).toBe(false);
    expect(isSafeAssetFilename("a.jpg")).toBe(true);
  });
});
