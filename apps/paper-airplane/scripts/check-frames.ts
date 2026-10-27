/**
 * Walk the timeline in small steps and report how much the rendered frame
 * changes between one sample and the next.
 *
 * A step boundary should be no different from any other pair of frames. A
 * spike means the picture jumps: geometry appearing from nowhere, or paper
 * changing colour as the step commits.
 */
import { chromium } from "playwright";

type Sample = { grid: number[]; cols: number; rows: number };

async function main() {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
    args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
  });
  const page = await browser.newPage({ viewport: { width: 700, height: 520 } });
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(process.env.APP_URL ?? "http://127.0.0.1:3100", { waitUntil: "networkidle" });
  await page.waitForSelector("main canvas");
  await page.waitForTimeout(3000);

  const from = Number(process.argv[2] ?? 0.9);
  const to = Number(process.argv[3] ?? 1.1);
  const stepSize = Number(process.argv[4] ?? 0.01);

  const setProgress = async (v: number) => {
    await page.evaluate((n) => {
      const w = window as unknown as { __setProgress?: (n: number) => void };
      w.__setProgress?.(n);
    }, v);
    // Let the framing settle; it eases towards the subject over a few frames.
    await page.waitForTimeout(400);
  };
  const sample = async () =>
    (await page.evaluate(() => {
      const w = window as unknown as { __sampleFrame?: () => Sample };
      return w.__sampleFrame?.();
    })) as Sample | undefined;

  // Warm up: the first frames after load are still settling (shadows
  // accumulate, textures upload), so a sample taken then differs from every
  // later one and would read as a jump that no viewer ever sees.
  await setProgress(Number(from.toFixed(4)));
  await sample();
  await page.waitForTimeout(600);

  const rows: Array<{ p: number; s: Sample }> = [];
  for (let p = from; p <= to + 1e-9; p += stepSize) {
    await setProgress(Number(p.toFixed(4)));
    const s = await sample();
    if (s) rows.push({ p: Number(p.toFixed(4)), s });
  }

  let worst = { p: 0, d: 0, where: "" };
  console.log("progress   worst block change   mean block change");
  rows.forEach((row, i) => {
    const prev = rows[i - 1];
    let maxD = 0;
    let sumD = 0;
    let at = 0;
    if (prev) {
      for (let k = 0; k < row.s.grid.length; k++) {
        const d = Math.abs(row.s.grid[k] - prev.s.grid[k]);
        if (d > maxD) {
          maxD = d;
          at = k;
        }
        sumD += d;
      }
    }
    const meanD = prev ? sumD / row.s.grid.length : 0;
    if (maxD > worst.d) {
      // Grid rows count up from the bottom of the framebuffer.
      const col = at % row.s.cols;
      const gridRow = Math.floor(at / row.s.cols);
      worst = {
        p: row.p,
        d: maxD,
        where:
          `block (${col}, ${gridRow}) of ${row.s.cols}x${row.s.rows}, ` +
          `about ${(((col + 0.5) / row.s.cols) * 100).toFixed(0)}% across and ` +
          `${((1 - (gridRow + 0.5) / row.s.rows) * 100).toFixed(0)}% down`,
      };
    }
    console.log(
      `${row.p.toFixed(3).padStart(7)}   ` +
        (prev ? maxD.toFixed(2).padStart(10) : "         -") +
        (prev ? meanD.toFixed(3).padStart(20) : "                   -"),
    );
  });
  console.log(
    `\nlargest single-block change between neighbouring frames: ` +
      `${worst.d.toFixed(2)} of 255, at progress ${worst.p}\n  ${worst.where}`,
  );
  if (errors.length) console.log(`page errors: ${errors.slice(0, 3).join(" | ")}`);
  await browser.close();
}

main();
