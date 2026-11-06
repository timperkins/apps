// Pure helpers for the processing job: reading ffprobe output, building the FFmpeg commands and
// parsing scene changes. Kept apart from index.mjs so they can be tested without Cloud access.

/** Output frame rate for proxies and mezzanines. Timeline seconds line up because both use it. */
export const FPS = 30;

/** Transfer functions that mark a clip as HDR. iPhones record HLG (arib-std-b67). */
const HDR_TRANSFERS = new Set(["arib-std-b67", "smpte2084"]);

/** Storage paths for a clip's outputs, next to its original: .../originals/<id>.mov -> .../proxies/<id>.mp4 */
export function outputPaths(originalPath) {
  const swap = (folder, ext) =>
    originalPath.replace("/originals/", `/${folder}/`).replace(/(\.[A-Za-z0-9]{1,8})?$/, ext);
  return {
    proxy: swap("proxies", ".mp4"),
    mezzanine: swap("mezzanines", ".mp4"),
    poster: swap("posters", ".jpg"),
  };
}

function ratio(value) {
  const [n, d] = String(value ?? "").split("/").map(Number);
  return n && d ? n / d : null;
}

const round = (n, places = 3) => (n == null || Number.isNaN(n) ? null : Number(n.toFixed(places)));

/** Summary of the original from `ffprobe -show_format -show_streams -of json`. */
export function describeSource(probe) {
  const streams = probe.streams ?? [];
  const video = streams.find((s) => s.codec_type === "video" && !s.disposition?.attached_pic);
  if (!video) throw new Error("the file has no video stream");
  const audio = streams.find((s) => s.codec_type === "audio");
  const tags = probe.format?.tags ?? {};
  const rotation = Number(
    video.side_data_list?.find((d) => d.rotation !== undefined)?.rotation ?? video.tags?.rotate ?? 0,
  );
  const sideways = Math.abs(rotation) % 180 === 90;
  return {
    container: probe.format?.format_name ?? null,
    durationSec: round(Number(probe.format?.duration ?? video.duration)),
    codec: video.codec_name ?? null,
    profile: video.profile ?? null,
    pixFmt: video.pix_fmt ?? null,
    // Width and height as shown, after the phone's rotation flag.
    width: sideways ? video.height : video.width,
    height: sideways ? video.width : video.height,
    rotation,
    fps: round(ratio(video.avg_frame_rate), 2),
    variableFrameRate: video.avg_frame_rate !== video.r_frame_rate,
    colorTransfer: video.color_transfer ?? null,
    colorPrimaries: video.color_primaries ?? null,
    colorSpace: video.color_space ?? null,
    hdr: HDR_TRANSFERS.has(video.color_transfer),
    dolbyVision: Boolean(video.side_data_list?.some((d) => /dovi|dolby/i.test(d.side_data_type ?? ""))),
    audioCodec: audio?.codec_name ?? null,
    audioChannels: audio?.channels ?? null,
    recordedAt: tags.creation_time ?? tags["com.apple.quicktime.creationdate"] ?? null,
    location: tags["com.apple.quicktime.location.ISO6709"] ?? null,
    device: tags["com.apple.quicktime.model"] ?? null,
  };
}

// Shorter side at most `px`, never upscaled. Rotation is applied before the filters run, so
// iw and ih are the frame as shown.
const fitShortSide = (px) =>
  `scale=w='if(gte(iw,ih),-2,min(${px},iw))':h='if(gte(iw,ih),min(${px},ih),-2)'`;

/**
 * Tone-maps HLG or PQ to SDR Rec.709. zscale reads the input's transfer and primaries from the
 * frames; they're also passed explicitly in case the container tags are missing.
 */
export function toneMap(source) {
  const tin = source.colorTransfer === "smpte2084" ? "smpte2084" : "arib-std-b67";
  return [
    `zscale=tin=${tin}:pin=bt2020:min=bt2020nc:t=linear:npl=100`,
    "format=gbrpf32le",
    "zscale=p=bt709",
    "tonemap=tonemap=hable:desat=0",
    "zscale=t=bt709:m=bt709:r=tv",
    "format=yuv420p",
  ].join(",");
}

const sdrTags = ["-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-color_range", "tv"];

/**
 * One FFmpeg run that decodes the original once and writes both outputs at a constant 30 fps:
 * a 720p proxy for the browser and Gemini, and a 1080p mezzanine for the final render. Both use
 * a keyframe every second so seeking is fast.
 */
export function transcodeArgs(input, source, { proxy, mezzanine }) {
  // Downscale before tone-mapping, which runs in 32-bit float and is the slow part at 4K.
  const color = source.hdr ? toneMap(source) : "format=yuv420p";
  const graph = `[0:v:0]fps=${FPS},${fitShortSide(1080)},${color},split=2[m][p0];[p0]${fitShortSide(720)}[p]`;
  const gop = ["-g", String(FPS), "-keyint_min", String(FPS), "-sc_threshold", "0"];
  const audio = (bitrate) => ["-map", "0:a:0?", "-c:a", "aac", "-b:a", bitrate, "-ac", "2"];
  return [
    "-hide_banner", "-nostats", "-y",
    "-progress", "pipe:1",
    "-i", input,
    "-filter_complex", graph,
    "-map", "[p]", "-c:v", "libx264", "-preset", "veryfast", "-crf", "23", ...gop, ...sdrTags,
    ...audio("128k"), "-movflags", "+faststart", proxy,
    "-map", "[m]", "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", ...gop, ...sdrTags,
    ...audio("192k"), "-movflags", "+faststart", mezzanine,
  ];
}

/** Scene changes on the proxy, scaled down since detection doesn't need detail. */
export function sceneArgs(proxy, threshold = 0.3) {
  return [
    "-hide_banner", "-nostats", "-i", proxy, "-an",
    "-vf", `scale=320:-2,select='gt(scene,${threshold})',metadata=print:file=-`,
    "-f", "null", "-",
  ];
}

/** Seconds of each scene change from the metadata filter's output ("frame:12 pts:... pts_time:4.4"). */
export function parseScenes(output) {
  const times = [];
  for (const match of output.matchAll(/pts_time:([\d.]+)/g)) times.push(round(Number(match[1])));
  return times;
}

/** A poster frame one second in, or halfway through for clips shorter than two seconds. */
export function posterArgs(proxy, durationSec, poster) {
  const at = Math.min(1, (durationSec ?? 0) / 2);
  return ["-hide_banner", "-y", "-ss", String(at), "-i", proxy, "-frames:v", "1", "-q:v", "3", poster];
}

/** Seconds encoded so far, from one block of `-progress` output. */
export function progressSeconds(text) {
  const matches = [...text.matchAll(/out_time_us=(\d+)/g)];
  return matches.length ? Number(matches.at(-1)[1]) / 1e6 : null;
}
