/**
 * Drive the running app in a real browser and save frames, so the look can be
 * judged instead of guessed at.
 *
 *   tsx scripts/shoot.ts <outDir> '<json array of shots>'
 *
 * Each shot is { name, progress, camera?: [x,y,z], target?: [x,y,z] }.
 */
import { chromium } from "playwright";
import { mkdirSync } from "fs";

type Shot = {
  name: string;
  progress: number;
  camera?: [number, number, number];
  target?: [number, number, number];
  /** Look settings to apply before the shot, e.g. { debugLayers: true }. */
  look?: Record<string, unknown>;
  /** Mesh settings to apply before the shot, e.g. { thickness: 0.05 }. */
  mesh?: Record<string, unknown>;
};

async function main() {
  const [outDir, spec] = process.argv.slice(2);
  const shots: Shot[] = spec
    ? JSON.parse(spec)
    : [
        { name: "flat", progress: 0 },
        { name: "mid", progress: 0.5 },
        { name: "done", progress: 5 },
      ];
  const url = process.env.APP_URL ?? "http://127.0.0.1:3100";

  mkdirSync(outDir, { recursive: true });

  const browser = await chromium.launch({
    // The image ships a Chromium build; use it rather than downloading one.
    executablePath: process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
    args: [
      "--use-gl=angle",
      "--use-angle=swiftshader",
      "--enable-unsafe-swiftshader",
      "--disable-lcd-text",
    ],
  });
  const page = await browser.newPage({
    viewport: { width: 1280, height: 860 },
    deviceScaleFactor: 2,
  });

  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));

  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForSelector("canvas", { timeout: 30000 });
  await page.waitForTimeout(3500); // let the environment map and textures settle

  const canvas = await page.waitForSelector("main canvas");

  for (const shot of shots) {
    await page.evaluate((s) => {
      const w = window as unknown as {
        __setProgress?: (n: number) => void;
        __setCamera?: (p: number[], t: number[]) => void;
        __setLook?: (k: string, v: unknown) => void;
        __setMesh?: (k: string, v: unknown) => void;
      };
      for (const [k, v] of Object.entries(s.look ?? {})) w.__setLook?.(k, v);
      for (const [k, v] of Object.entries(s.mesh ?? {})) w.__setMesh?.(k, v);
      w.__setProgress?.(s.progress);
      // Always reposition, so one shot's close-up does not leak into the next.
      w.__setCamera?.(s.camera ?? [3.0, 3.4, 5.0], s.target ?? [0, 0.15, 0]);
    }, shot as unknown as Shot);
    await page.waitForTimeout(1100);
    const file = `${outDir}/${shot.name}.png`;
    await canvas.screenshot({ path: file });
    console.log("wrote", file);
  }

  const stats = await page.evaluate(() => {
    const w = window as unknown as { __stats?: () => unknown };
    return w.__stats?.();
  });
  console.log("stats:", JSON.stringify(stats));
  console.log(errors.length ? `CONSOLE ERRORS:\n${errors.slice(0, 10).join("\n")}` : "no console errors");

  await browser.close();
}

main();
