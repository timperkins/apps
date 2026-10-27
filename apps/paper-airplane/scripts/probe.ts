/**
 * Browser smoke test: the canvas comes up, playback advances, scrubbing works,
 * stepping works, and nothing logs an error.
 */
import { chromium } from "playwright";

type Stats = { fps: number; triangles: number; faces: number; rolls: number };

async function main() {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
    args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
  });
  const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));

  await page.goto(process.env.APP_URL ?? "http://127.0.0.1:3100", { waitUntil: "networkidle" });
  await page.waitForSelector("main canvas");
  await page.waitForTimeout(3000);

  const fails: string[] = [];
  const check = (name: string, ok: boolean, detail: string) => {
    if (!ok) fails.push(name);
    console.log(`${ok ? "pass" : "FAIL"}  ${name.padEnd(38)} ${detail}`);
  };

  const readProgress = () =>
    page.evaluate(() => {
      const w = window as unknown as { __progress?: () => number };
      return w.__progress?.() ?? -1;
    });

  const webgl = await page.evaluate(() => {
    const c = document.createElement("canvas");
    const gl = c.getContext("webgl2");
    return gl ? "webgl2" : "none";
  });
  check("webgl context", webgl === "webgl2", webgl);

  // Playback advances the timeline.
  await page.getByRole("button", { name: /^Play$/ }).click();
  const before = await readProgress();
  await page.waitForTimeout(2500);
  const after = await readProgress();
  check("play advances the timeline", after > before + 0.05, `${before.toFixed(3)} -> ${after.toFixed(3)}`);

  await page.getByRole("button", { name: /^Pause$/ }).click();
  const paused = await readProgress();
  await page.waitForTimeout(1200);
  const stillPaused = await readProgress();
  check("pause holds position", Math.abs(stillPaused - paused) < 1e-6, `${stillPaused.toFixed(3)}`);

  // Stepping snaps to step boundaries.
  await page.getByRole("button", { name: /^Next$/ }).click();
  const nextPos = await readProgress();
  check("next snaps to a step boundary", Math.abs(nextPos - Math.round(nextPos)) < 1e-6, `${nextPos}`);

  await page.getByRole("button", { name: /^Prev$/ }).click();
  const prevPos = await readProgress();
  check("prev steps back", prevPos < nextPos, `${prevPos} < ${nextPos}`);

  // Jumping to a bookmarked step from the list.
  await page.getByRole("button", { name: /Open the wings/ }).click();
  const jumped = await readProgress();
  check("step list jumps", Math.abs(jumped - 4) < 1e-6, `progress ${jumped}`);

  const stats = (await page.evaluate(() => {
    const w = window as unknown as { __stats?: () => Stats };
    return w.__stats?.();
  })) as Stats | undefined;
  check("geometry is built", !!stats && stats.triangles > 100, JSON.stringify(stats));

  check("no console errors", errors.length === 0, errors.slice(0, 3).join(" | ") || "none");

  await browser.close();
  console.log(fails.length ? `\n${fails.length} FAILURES` : "\nbrowser smoke test passed");
  process.exit(fails.length ? 1 : 0);
}

main();
