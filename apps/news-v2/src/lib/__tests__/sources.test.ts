import { describe, expect, it } from "vitest";
import { DEFAULT_SOURCE_IDS, parseSourceIds } from "@/lib/sources";

describe("parseSourceIds", () => {
  it("uses the defaults when there is no cookie", () => {
    expect(parseSourceIds(undefined)).toEqual(DEFAULT_SOURCE_IDS);
  });
  it("keeps an empty choice empty", () => {
    expect(parseSourceIds("")).toEqual([]);
  });
  it("drops unknown and duplicate ids", () => {
    expect(parseSourceIds("bbc,nope,bbc,the-verge")).toEqual(["bbc", "the-verge"]);
  });
});
