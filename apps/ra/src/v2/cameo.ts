// The build menu's pictures are photo-like renders of each building and unit,
// made once with an image model, then shrunk to 240x180 and cut down to 48
// colors so they sit with the pixel art. They live in public/cameos/<id>.png
// and are the same for every faction, so they use neutral colors. The tab
// buttons' icons are cut out of the same kind of render, in public/tabs/.
// How to make new ones: CAMEOS.md.
export const cameoUrl = (id: string) => `${import.meta.env.BASE_URL}cameos/${id}.png`;
export const tabIconUrl = (tab: string) => `${import.meta.env.BASE_URL}tabs/${tab}.png`;
