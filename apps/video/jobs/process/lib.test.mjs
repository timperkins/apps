import assert from "node:assert/strict";
import { test } from "node:test";
import { cleanSegments, describeSource, indexPrompt, outputPaths, parseScenes, progressSeconds, transcodeArgs } from "./lib.mjs";

const iphoneProbe = {
  format: {
    format_name: "mov,mp4,m4a,3gp,3g2,mj2",
    duration: "12.345678",
    tags: {
      creation_time: "2026-11-04T18:00:00.000000Z",
      "com.apple.quicktime.location.ISO6709": "+45.5231-122.6765+050.000/",
      "com.apple.quicktime.model": "iPhone 17 Pro",
    },
  },
  streams: [
    {
      codec_type: "video",
      codec_name: "hevc",
      profile: "Main 10",
      pix_fmt: "yuv420p10le",
      width: 3840,
      height: 2160,
      avg_frame_rate: "18000/601",
      r_frame_rate: "30/1",
      color_transfer: "arib-std-b67",
      color_primaries: "bt2020",
      color_space: "bt2020nc",
      side_data_list: [{ side_data_type: "DOVI configuration record" }, { side_data_type: "Display Matrix", rotation: -90 }],
    },
    { codec_type: "audio", codec_name: "aac", channels: 2 },
  ],
};

test("describes an iPhone HDR portrait clip", () => {
  const s = describeSource(iphoneProbe);
  assert.equal(s.hdr, true);
  assert.equal(s.dolbyVision, true);
  assert.equal(s.width, 2160);
  assert.equal(s.height, 3840);
  assert.equal(s.durationSec, 12.346);
  assert.equal(s.fps, 29.95);
  assert.equal(s.variableFrameRate, true);
  assert.equal(s.device, "iPhone 17 Pro");
  assert.equal(s.location, "+45.5231-122.6765+050.000/");
});

test("tone-maps only HDR clips", () => {
  const out = { proxy: "p.mp4", mezzanine: "m.mp4" };
  const hdr = transcodeArgs("in", describeSource(iphoneProbe), out).join(" ");
  assert.match(hdr, /tonemap=hable/);
  assert.match(hdr, /tin=arib-std-b67/);
  const sdrProbe = structuredClone(iphoneProbe);
  sdrProbe.streams[0].color_transfer = "bt709";
  const sdr = transcodeArgs("in", describeSource(sdrProbe), out).join(" ");
  assert.doesNotMatch(sdr, /tonemap/);
  assert.match(sdr, /fps=30/);
});

test("puts outputs next to the original", () => {
  assert.deepEqual(outputPaths("video/projects/p1/originals/c1.mov"), {
    proxy: "video/projects/p1/proxies/c1.mp4",
    mezzanine: "video/projects/p1/mezzanines/c1.mp4",
    poster: "video/projects/p1/posters/c1.jpg",
  });
  assert.equal(outputPaths("video/projects/p1/originals/c2").proxy, "video/projects/p1/proxies/c2.mp4");
});

test("parses scene changes and progress", () => {
  const scenes = parseScenes("frame:0    pts:61440   pts_time:4\nlavfi.scene_score=0.9\nframe:1 pts:1 pts_time:10.033333\n");
  assert.deepEqual(scenes, [4, 10.033]);
  assert.equal(progressSeconds("out_time_us=1500000\nprogress=continue\nout_time_us=2500000\n"), 2.5);
  assert.equal(progressSeconds("progress=continue"), null);
});

test("tidies Gemini segments", () => {
  const raw = [
    { start: 9.6, end: 30, kind: "repetitive", description: " sanding ", camera: "steady" },
    { start: -1, end: 10.2, kind: "action", description: "measuring", camera: "handheld", tools: ["tape"] },
    { start: 30, end: 30.1, kind: "highlight", description: "sliver", camera: "steady" },
    { start: 31, end: 99, kind: "boring", description: "bad kind", camera: "steady" },
  ];
  const segments = cleanSegments(raw, 40, [10]);
  assert.equal(segments.length, 2);
  assert.deepEqual(
    segments.map((s) => [s.start, s.end, s.kind]),
    [
      [0, 10, "action"],
      [10, 30, "repetitive"],
    ],
  );
  assert.equal(segments[1].description, "sanding");
  assert.deepEqual(segments[0].tools, ["tape"]);
});

test("prompt carries the project notes", () => {
  const prompt = indexPrompt({ durationSec: 12, projectName: "Deck", projectNotes: "Rebuilding the deck", fileName: "IMG_1.MOV" });
  assert.match(prompt, /Rebuilding the deck/);
  assert.match(prompt, /12\.0 seconds/);
  assert.doesNotMatch(indexPrompt({ durationSec: 1, projectName: "", projectNotes: "", fileName: "a" }), /notes on the project/);
});
