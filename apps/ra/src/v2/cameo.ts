// The build menu's pictures are photo-like renders of each building and unit,
// made once with an image model, then shrunk to 240x180 and cut down to 48
// colors so they sit with the pixel art. They live in public/cameos/<id>.png
// and are the same for every faction, so they use neutral colors.
export const CAMEO_W = 240;
export const CAMEO_H = 180;

export const cameoUrl = (id: string) => `${import.meta.env.BASE_URL}cameos/${id}.png`;

// The box round the solid pixels of an image: x, y, width, height.
export function trimBox(img: HTMLCanvasElement): [number, number, number, number] {
  const c = img.getContext('2d', { willReadFrequently: true })!;
  const { width: w, height: h } = img;
  const px = c.getImageData(0, 0, w, h).data;
  let l = w, r = -1, t = h, b = -1;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (px[(y * w + x) * 4 + 3] > 200) {
        if (x < l) l = x;
        if (x > r) r = x;
        if (y < t) t = y;
        if (y > b) b = y;
      }
  if (r < l) return [0, 0, w, h];
  return [l, t, r - l + 1, b - t + 1];
}
