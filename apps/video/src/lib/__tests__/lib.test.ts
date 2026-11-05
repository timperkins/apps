import { describe, expect, it } from "vitest";
import { isAllowed, parseAllowlist } from "../allowlist";
import { CHUNK_SIZE, clipKey, nextChunk, offsetFromRange, originalPath } from "../resumable";

describe("allowlist", () => {
  const list = parseAllowlist(" tjp503@gmail.com, Other@Example.com ");

  it("accepts verified emails on the list, in any case", () => {
    expect(isAllowed(list, "TJP503@gmail.com", true)).toBe(true);
    expect(isAllowed(list, "other@example.com", true)).toBe(true);
  });

  it("rejects unverified, missing or unlisted emails", () => {
    expect(isAllowed(list, "tjp503@gmail.com", false)).toBe(false);
    expect(isAllowed(list, undefined, true)).toBe(false);
    expect(isAllowed(list, "someone@gmail.com", true)).toBe(false);
    expect(isAllowed(parseAllowlist(undefined), "tjp503@gmail.com", true)).toBe(false);
  });
});

describe("resumable uploads", () => {
  it("reads the stored offset from a Range header", () => {
    expect(offsetFromRange(null)).toBe(0);
    expect(offsetFromRange("bytes=0-16777215")).toBe(16777216);
    expect(offsetFromRange("bytes=5-10")).toBeNull();
    expect(offsetFromRange("junk")).toBeNull();
  });

  it("splits a file into 256 KiB-aligned chunks and a short last one", () => {
    expect(CHUNK_SIZE % (256 * 1024)).toBe(0);
    const size = CHUNK_SIZE * 2 + 10;
    expect(nextChunk(0, size)).toEqual({ start: 0, end: CHUNK_SIZE, contentRange: `bytes 0-${CHUNK_SIZE - 1}/${size}` });
    expect(nextChunk(CHUNK_SIZE * 2, size)).toEqual({
      start: CHUNK_SIZE * 2,
      end: size,
      contentRange: `bytes ${CHUNK_SIZE * 2}-${size - 1}/${size}`,
    });
  });

  it("keys clips by name and size, and keeps the extension in the storage path", () => {
    expect(clipKey("IMG_0001.MOV", 42)).toBe("IMG_0001.MOV:42");
    expect(originalPath("video", "p1", "c1", "IMG_0001.MOV")).toBe("video/projects/p1/originals/c1.mov");
    expect(originalPath("video", "p1", "c1", "noext")).toBe("video/projects/p1/originals/c1");
  });
});
