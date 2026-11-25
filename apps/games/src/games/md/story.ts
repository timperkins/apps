// M.D.'s storyline: the Hollow Crown and the five dungeons around Hearthstead. All original.
// Each chapter is a few pages; a page is one line said by a trader in camp (or the narrator).

export type Speaker = 'narrator' | 'smith' | 'armorer' | 'peddler' | 'mystic' | 'crown';
export interface Page {
  who: Speaker;
  text: string;
}
export interface Chapter {
  id: string;
  title: string;
  pages: Page[];
}

export const CHAPTERS: Chapter[] = [
  {
    id: 'intro',
    title: 'Prologue: The Empty Crown',
    pages: [
      { who: 'narrator', text: 'Long ago, five old dungeons ringed the little camp of Hearthstead. For a hundred years they were quiet.' },
      { who: 'crown', text: 'Then, deep under the black mountain, something woke: the Hollow Crown. An iron crown with no head inside it, and one wish. A kingdom of monsters.' },
      { who: 'smith', text: 'Every night more of them creep out of the old places. Hopping stones. Walking mushrooms. Rusty knights that should be dust.' },
      { who: 'mystic', text: 'The Crown split its power into four shards and gave each one to a guardian. While the guardians hold them, the Crown can’t be touched.' },
      { who: 'armorer', text: 'Beat the four guardians, take back the shards, and the way to the Obsidian Throne will open. Then someone has to finish it.' },
      { who: 'peddler', text: 'You’ve got a rusty sword, a little bow and a brave face. That’s more than the rest of us. Start with the Mossy Crypt. The mission table is by the fire.' },
    ],
  },
  {
    id: 'before:crypt',
    title: 'Chapter 1: The Mossy Crypt',
    pages: [
      { who: 'smith', text: 'The Mossy Crypt is where we buried the old kings. Now the gravestones hop around on their own, like frogs made of rock.' },
      { who: 'smith', text: 'The biggest one, Old Boulderback, holds the first shard. Hit it, then get out of the way when it stomps!' },
    ],
  },
  {
    id: 'after:crypt',
    title: 'The First Shard',
    pages: [
      { who: 'mystic', text: 'You found a shard! It’s warm, and it hums like a bee. The Crown felt you take it.' },
      { who: 'mystic', text: 'Look east: the mushrooms in Shroom Hollow are glowing brighter. The Crown is waking its next guardian.' },
    ],
  },
  {
    id: 'before:shroom',
    title: 'Chapter 2: Shroom Hollow',
    pages: [
      { who: 'peddler', text: 'Shroom Hollow was my favourite picking spot! Now the mushrooms pick you.' },
      { who: 'peddler', text: 'Queen Puffshroom guards the second shard. Her spores can put a grown knight to sleep for a week. Don’t breathe in!' },
    ],
  },
  {
    id: 'after:shroom',
    title: 'The Second Shard',
    pages: [
      { who: 'armorer', text: 'Two shards. Every piece of armor in my shop rattled when you walked back into camp.' },
      { who: 'armorer', text: 'And up north, the Frostdeep Halls froze solid overnight. That’s no normal winter.' },
    ],
  },
  {
    id: 'before:frost',
    title: 'Chapter 3: Frostdeep Halls',
    pages: [
      { who: 'armorer', text: 'My grandmother’s knights guarded the Frostdeep Halls. The Crown froze them, then woke them up again to fight for it.' },
      { who: 'armorer', text: 'Their captain is the Frozen Warden now. Beat him and the old knights can finally rest. Fire hits the ice wisps hardest.' },
    ],
  },
  {
    id: 'after:frost',
    title: 'The Third Shard',
    pages: [
      { who: 'smith', text: 'The ice is melting! I heard the old knights’ bells ring, all the way from here.' },
      { who: 'smith', text: 'But the forge mountain is smoking. Magmajaw is awake, and it’s guarding the last shard.' },
    ],
  },
  {
    id: 'before:forge',
    title: 'Chapter 4: The Cinder Forge',
    pages: [
      { who: 'smith', text: 'The Cinder Forge is where I learned to make swords, before the hounds came. Everything in there burns.' },
      { who: 'smith', text: 'Ice beats fire. Bring frost arrows, or an ice blade if you have one, and don’t stand in the lava!' },
    ],
  },
  {
    id: 'after:forge',
    title: 'The Fourth Shard',
    pages: [
      { who: 'mystic', text: 'Four shards! Look: they’re pulling toward the black mountain, like magnets.' },
      { who: 'mystic', text: 'The Obsidian Throne is open. The Hollow Crown is waiting for you, and it knows your name now.' },
      { who: 'crown', text: '“Little hero. Bring me my shards, and I will make you a king of monsters too.”' },
    ],
  },
  {
    id: 'before:throne',
    title: 'Chapter 5: The Obsidian Throne',
    pages: [
      { who: 'mystic', text: 'This is it. The Crown can’t be hurt by fear, only by courage. You have plenty of that.' },
      { who: 'peddler', text: 'Take extra arrows. And a bomb. And maybe two. We’ll have a feast ready when you get back!' },
    ],
  },
  {
    id: 'ending',
    title: 'Epilogue: Hearthstead Is Safe',
    pages: [
      { who: 'narrator', text: 'The Hollow Crown cracked in two, and its cold light went out. One by one, the five dungeons went quiet.' },
      { who: 'smith', text: 'You did it! I’m going to tell this story to everyone, every night, whether they want to hear it or not.' },
      { who: 'armorer', text: 'The old knights are resting, the mushrooms are just mushrooms again, and my armor has stopped rattling.' },
      { who: 'mystic', text: 'But the dungeons are still full of treasure… and harder paths, up to VIII, for heroes who want more. Your adventure doesn’t have to end.' },
    ],
  },
];

export const chapter = (id: string) => CHAPTERS.find((c) => c.id === id);

/** what each trader says in their shop, depending on how far the story has gone (dungeons cleared, 0..5) */
export function traderLine(id: string, cleared: number, won: boolean): string | null {
  if (won) {
    return { smith: 'The hero of Hearthstead! Your next sword is half price… no, wait, full price. But I’ll smile.', armorer: 'Even heroes need armor. Especially heroes.', peddler: 'Everyone wants to buy the hero’s favourite arrows now!', mystic: 'The shards are quiet. But there are always more relics in the deep places.' }[id] ?? null;
  }
  const lines: Record<string, string[]> = {
    smith: ['The Mossy Crypt first. A sharper sword helps!', 'One shard down! Mushrooms hate axes, you know.', 'Two shards! A fire blade would melt those frozen knights.', 'Magmajaw next. Ice beats fire: think about a Rimeblade.', 'The Throne. I’ve saved my best steel for this.'],
    armorer: ['Can’t win if you can’t take a hit, friend.', 'Spores can’t get through good armor. Mostly.', 'The Frostdeep knights hit hard. Wear something heavy.', 'Dragonscale armor laughs at lava. Just saying.', 'Whatever you wear to the Throne, wear it proudly.'],
    peddler: ['Potions, no. Arrows and bombs, yes!', 'Fire arrows work wonders on wet mushrooms.', 'Frost arrows? Fire arrows! For the Frostdeep, fire.', 'Frost arrows, lots of them, for the Cinder Forge.', 'Take everything. Pay me when you’re back.'],
    mystic: ['Charms and relics, each with a little magic inside.', 'The shard sings when you’re near. Keep it safe.', 'Three dungeons still dream of the Crown.', 'One shard left. I can feel the Crown getting nervous.', 'Four shards. Go and finish it.'],
  };
  return lines[id]?.[Math.min(4, cleared)] ?? null;
}
