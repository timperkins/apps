import { afterEach, describe, expect, it, vi } from "vitest";
import { geminiThinking } from "../config";
import { addInterest, applySignal, effectiveWeight, interestMatch, prune, topInterests } from "../interests";
import { followupId } from "../ids";
import { breakingShortfall, freshCategoryStories, homeBreaking, newestFirst, sortStories } from "../ranking";
import { extractJson, parseEventDate, slugify } from "../text";
import type { Interest } from "../types";

const DAY = 24 * 60 * 60_000;
const NOW = Date.UTC(2026, 9, 14);

describe("text helpers", () => {
  it("slugifies labels", () => {
    expect(slugify("Electric Vehicles!")).toBe("electric-vehicles");
    expect(slugify("  São Paulo  ")).toBe("sao-paulo");
  });

  it("extracts JSON from model output with fences and prose", () => {
    expect(extractJson('Here you go:\n```json\n[{"a":1}]\n```')).toEqual([{ a: 1 }]);
    expect(extractJson('Sure! {"headline":"x"} hope that helps')).toEqual({ headline: "x" });
    expect(extractJson("no json here")).toBeNull();
  });

  it("makes stable follow-up ids", () => {
    expect(followupId("s1", "a")).toBe(followupId("s1", "a"));
    expect(followupId("s1", "a")).not.toBe(followupId("s1", "b"));
    expect(followupId("s1", "a")).toMatch(/^f-[a-z0-9]+$/);
  });
});

describe("interests", () => {
  it("adds fixed topics from reading signals but not unknown tags", () => {
    const next = applySignal({}, ["space", "made-up-tag"], "read", NOW);
    expect(Object.keys(next)).toEqual(["space"]);
    expect(next.space.weight).toBeCloseTo(0.1);
  });

  it("ignores muted interests", () => {
    const muted: Record<string, Interest> = {
      space: { label: "Space", weight: 0.4, pinned: false, muted: true, updatedAt: NOW },
    };
    expect(applySignal(muted, ["space"], "followupTap", NOW).space.weight).toBe(0.4);
  });

  it("decays unpinned interests over time", () => {
    const interest: Interest = { label: "Space", weight: 0.8, pinned: false, muted: false, updatedAt: NOW - 30 * DAY };
    expect(effectiveWeight(interest, NOW)).toBeLessThan(0.4);
    expect(effectiveWeight({ ...interest, pinned: true }, NOW)).toBe(0.8);
  });

  it("keeps the list small", () => {
    let interests: Record<string, Interest> = {};
    for (let i = 0; i < 40; i++) interests = addInterest(interests, `topic ${i}`, NOW);
    expect(Object.keys(prune(interests, NOW)).length).toBeLessThanOrEqual(30);
  });

  it("ranks top interests and matches stories", () => {
    const interests = addInterest(applySignal({}, ["science"], "open", NOW), "Electric cars", NOW);
    expect(topInterests(interests, 3, NOW)[0].key).toBe("electric-cars");
    expect(interestMatch({ topics: ["science"], tags: [] }, interests, NOW)).toBeCloseTo(0.05);
    expect(interestMatch({ topics: [], tags: ["electric cars"] }, interests, NOW)).toBeCloseTo(0.6);
  });
});

describe("ranking", () => {
  it("puts breaking and important stories first", () => {
    const sorted = sortStories(
      [
        { id: "old-big", significance: 0.9, publishedAt: NOW - 2 * DAY, isBreaking: false },
        { id: "fresh-small", significance: 0.2, publishedAt: NOW, isBreaking: false },
        { id: "breaking", significance: 0.7, publishedAt: NOW - 3_600_000, isBreaking: true },
      ],
      NOW,
    );
    expect(sorted.map((s) => s.id)).toEqual(["breaking", "old-big", "fresh-small"]);
  });
});

describe("breaking news target", () => {
  const story = (isBreaking: boolean, hoursAgo: number) => ({ isBreaking, publishedAt: NOW - hoursAgo * 3_600_000 });

  it("counts only recent breaking stories", () => {
    expect(breakingShortfall([], NOW)).toBe(3);
    expect(breakingShortfall([story(true, 1), story(false, 1), story(true, 20)], NOW)).toBe(2);
    expect(breakingShortfall([story(true, 1), story(true, 2), story(true, 3), story(true, 4)], NOW)).toBe(0);
  });
});

describe("home page selection", () => {
  const HOUR = 60 * 60_000;
  const story = (id: string, hoursAgo: number, extra: Partial<{ isBreaking: boolean; significance: number; happenedAt: number }> = {}) => ({
    id,
    publishedAt: NOW - hoursAgo * HOUR,
    isBreaking: false,
    significance: 0.5,
    ...extra,
  });

  it("shows up to four breaking stories from the last two days", () => {
    const stories = [
      story("a", 1, { isBreaking: true }),
      story("b", 5, { isBreaking: true }),
      story("c", 20, { isBreaking: true }),
      story("d", 30, { isBreaking: true }),
      story("e", 40, { isBreaking: true }),
      story("old", 50, { isBreaking: true, significance: 1 }),
      story("top", 2),
    ];
    const picked = homeBreaking(stories, NOW).map((s) => s.id);
    expect(picked).toHaveLength(4);
    expect(picked).not.toContain("old");
    expect(picked).not.toContain("top");
  });

  it("fills in with recent top stories when breaking news is short", () => {
    const stories = [story("a", 1, { isBreaking: true }), story("t1", 2), story("t2", 3), story("t3", 4), story("stale", 60)];
    expect(homeBreaking(stories, NOW).map((s) => s.id)).toEqual(["a", "t1", "t2"]);
  });

  it("keeps category picks to events from the last week", () => {
    const stories = [
      story("fresh", 2),
      story("old-event", 2, { happenedAt: NOW - 365 * DAY, significance: 0.9 }),
      story("last-week", 6 * 24),
      story("too-old", 8 * 24),
      story("another", 5),
    ];
    const picked = freshCategoryStories(stories, 3, NOW).map((s) => s.id);
    expect(picked).toHaveLength(3);
    expect(picked).not.toContain("old-event");
    expect(picked).not.toContain("too-old");
  });

  it("orders a category archive newest first", () => {
    expect(newestFirst([story("b", 5), story("a", 1), story("c", 50)]).map((s) => s.id)).toEqual(["a", "b", "c"]);
  });

  it("parses the model's event date", () => {
    expect(parseEventDate("2026-10-12", NOW)).toBe(Date.UTC(2026, 9, 12, 12));
    expect(parseEventDate("2026-10-20", NOW)).toBe(NOW);
    expect(parseEventDate("last week", NOW)).toBeNull();
    expect(parseEventDate(undefined, NOW)).toBeNull();
  });
});

describe("gemini thinking level", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("defaults to low and accepts any listed level", () => {
    vi.stubEnv("GEMINI_THINKING", "");
    expect(geminiThinking()).toBe("LOW");
    vi.stubEnv("GEMINI_THINKING", " Minimal ");
    expect(geminiThinking()).toBe("MINIMAL");
  });

  it("leaves thinking to the model for default or unknown values", () => {
    vi.stubEnv("GEMINI_THINKING", "default");
    expect(geminiThinking()).toBeNull();
    vi.stubEnv("GEMINI_THINKING", "lots");
    expect(geminiThinking()).toBeNull();
  });
});
