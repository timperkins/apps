// What Jeff and Lenny say. Indexed by stage (0 = levels 1-10 ... 4 = levels 41-50).

export const JEFF_INTRO: Record<number, string[]> = {
  1: [
    "Ah. You're awake. Welcome to my home, Lenny. You'll be staying... permanently.",
    'The door is locked, the halls are guarded, and the dogs are hungry. Do try to relax.',
  ],
  6: ["The wine cellar? How enterprising. Mind the racks. Some of those vintages are older than you'll ever be."],
  11: ["My kitchen staff have been told to keep an eye out for a scruffy little rat. That's you, Lenny."],
  16: ['Out of the servant quarters already? Well. The Grand Hall has eyes everywhere. Mine, mostly.'],
  21: ['The library. Please, read something. Read about all the people who never left.'],
  26: ["Admire my portraits, Lenny. I'm told the eyes follow you. They do. I paid extra."],
  31: ['You... you are not supposed to be up here. These are my private rooms! GUARDS!'],
  36: ["The conservatory is glass, Lenny. Glass! Everyone can see you! ...Can't they? WHY CAN'T THEY SEE YOU?"],
  41: ['No. No no no. You are NOT going into my hedge maze. Nobody solves the hedge maze. Not even me!'],
  46: ["Lenny. Lenny, please. Let's talk about this. I'll give you the east wing. Your own butler! Just STAY!"],
  50: ['This is it, Lenny. The front gate. You will NOT pass. I will stop you MYSELF!'],
};

export const LENNY_INTRO: Record<number, string> = {
  1: 'Wh-who are you?! Where am I?! Okay. Okay okay okay. Breathe, Lenny.',
  6: "I-I'm out of the cell. I can do this. Probably.",
  11: 'Something smells terrible in here. Keep moving.',
  16: "He's watching. Fine. Let him watch.",
  21: 'Lots of books on hiding. Taking notes.',
  26: 'Those paintings are worse than the real thing.',
  31: "You sound nervous, Jeff.",
  36: 'They cannot see me because I am very good at this now.',
  41: 'Hedges are just walls that smell nice.',
  46: "No deal, Jeff. I've got somewhere to be.",
  50: "Then let's go, Jeff.",
};

export const JEFF_CAMEO: string[][] = [
  // levels 1-10: smug, serene, deeply strange
  [
    'Wandering again? How tiresome.',
    'My guards have orders not to hurt you. Much.',
    'Every door in this house answers to me. Most of them by name.',
    'You look tired, Lenny. Your cell has a lovely bucket.',
    'Run along, little mouse. I do so enjoy a chase before breakfast.',
    'Do you hear the dogs? They hear you. They hear everything. Even my thoughts, I suspect.',
    'I once traded a Rembrandt for a particularly lovely spoon. I regret nothing.',
    'I bathe in goat milk on Tuesdays. Today is Tuesday. Do not make me leave the tub again.',
    'My grandfather built this dungeon with his own hands. Well, other people\'s hands. He owned the hands.',
    'Have you met Reginald? He is a stuffed heron. He disapproves of you.',
    'I collect three things, Lenny. Clocks, teaspoons, and guests who never leave.',
    'The east wing is haunted. The west wing is also haunted. I have an excellent haunting budget.',
    'I had my portrait painted forty times this year. Forty. The painter has stopped blinking.',
    'Do you like caviar? I feed it to the moths. They have refined palates.',
    'One does not simply leave. One is excused. And you, Lenny, are not excused.',
    'I wear this tuxedo to bed. A gentleman must be ready to host at all hours.',
    'My mother was a duchess and my father was a very confident walrus. Or so the family legend goes.',
    'The stones in my dungeon were imported from a castle that owed me money.',
    'Shh. Listen. That is the sound of my wine collection appreciating in value.',
    'I keep a harpsichord in every bathroom. For emergencies.',
    'Your shoes squeak, Lenny. I can hear them from the drawing room. Over the harp.',
    'I have not seen the sun since 1987. I find it gauche.',
    'Tonight I dine on swan and regret. Mostly swan.',
    'My butler, Pemberton, is made of wax. He is my most loyal employee.',
  ],
  // levels 11-20: amused, a touch irritated
  [
    'A temporary inconvenience. Nothing more. Like weather. Or peasants.',
    'My staff will have you back in irons by supper. The good irons. Silver.',
    'You missed a spot. On your face. Everywhere, actually.',
    'Still crawling about? How quaint. How very... rodent.',
    'I have had houseguests like you before. Briefly. Then I had them stuffed. Kidding! Mostly.',
    'Please stop sneaking through my kitchen. The soufflé can sense fear.',
    'I own a thimble that belonged to Napoleon. It is the only thing in this house smaller than your chances.',
    'Do you know what this tuxedo cost? Neither do I. I paid in emeralds.',
    'My chef cries into every soup. It is the secret ingredient. I pay him extra to be sad.',
    'I named all the guards Gerald. It saves so much time.',
    'The dogs have been fed. Mostly. Hopefully.',
    'I keep a small orchestra in the attic. They only know one song. It is about me.',
    'You are tracking mud on a carpet woven by blind Venetian monks. Ninety of them.',
    'Lenny, darling, do stop. You are upsetting the chandeliers.',
    'The Grand Hall has three hundred candles. I light them myself, one a day. It is very soothing.',
    'I once challenged a duke to a duel and then sent my cousin. Delegation, Lenny.',
    'My private zoo has a pygmy hippo named Sir Bartholomew. He bites. Like me.',
    'I pickle my own eggs. Ostrich, of course. Chicken eggs are for the help.',
    'Have you seen my monocle? I have never needed one. I just like to lose it.',
    'Everything here is an antique. Including the guards.',
  ],
  // levels 21-30: rattled, still grand
  [
    "You're... further than the others got.",
    'Stop touching my things! Those books are first editions! Of other first editions!',
    'Guards! GUARDS! What am I paying you for?! Besides the hats.',
    "That was luck. That's all that was. Luck and... cardio.",
    'Hm. You seem... taller. Stop that at once.',
    'Do you know how hard it is to find good henchmen? I advertise in the opera programme!',
    'I am not shouting. I am projecting. I took lessons from a Viennese baritone.',
    'If you break my Ming vase I will have it repaired and then break YOU. Figuratively. In court.',
    'This is a private library! You need a library card! It is made of gold! I am the only member!',
    'My portraits are watching you. Report back, portraits!',
    'I did not spend nine million on a ceiling fresco for you to ignore it.',
    'You have been in that corridor for an hour. It is my best corridor. I am flattered and furious.',
    'My great-aunt Philippa escaped this house once. She came back. They all come back. For the brunch.',
    'I will have you know I own seventeen islands and none of them want you either.',
    'Is that my bathrobe? No? Then why do I feel violated?',
    'I am taking a bubble bath to calm down. It is not working. The bubbles are judging me.',
    'Pemberton! Bring me my fainting couch! The big one!',
    'Every clock in this house is now five minutes slow. I did that. To spite you.',
  ],
  // levels 31-40: worried and wheedling
  [
    "Lenny, let's be reasonable. Stay for dinner? There's lobster. In a smaller lobster.",
    "You can't leave! Who would I talk to?! The heron?!",
    'Where did you GET those arms?!',
    "I'm not sweating. The house is humid. I keep tropical orchids. And anxiety.",
    'I can change! I can get you a nicer cell! With a view! Of a slightly nicer cell!',
    'I will give you a peacock. A whole peacock. Please stop walking.',
    'I had the bedrooms perfumed with crushed pearls. For YOU. And this is the thanks?',
    'You are breathing on my silk wallpaper. Each strand was hand-spun by an anxious caterpillar!',
    'Please. Have you no respect for a man who owns three gondolas?',
    'Do not open that wardrobe. That is where I keep my emotions.',
    'I will write a sonnet about you. It will be unflattering. It will rhyme "Lenny" with "absolutely not."',
    'This is fine. Everything is fine. I am ringing for a soothing cello.',
    'The armour in the hall is not decorative, Lenny. Neither am I. I am ornamental AND dangerous.',
    'I have summoned my lawyers. All forty of them. They are coming by hot air balloon.',
    'You smell like freedom and it is RUINING my potpourri.',
    'If you leave, the pigeons win. Do you want the pigeons to win, Lenny?',
  ],
  // levels 41-50: unravelling
  [
    'No no no NO! Not like this! Not in my HEDGES!',
    'Release the dogs! ALL the dogs! The small one too! Especially the small one!',
    "I'm not crying. YOU'RE crying. The topiary is crying.",
    'Please! I have nothing else! Just this house! And the yacht! And the other yacht! And you!',
    'Fine! FINE! Go! ...No, wait, come back! I made scones!',
    'I have trimmed these hedges into the shape of your face so you will feel at home. STAY.',
    'You cannot leave. I have already monogrammed your towels.',
    'Lenny! I will name a wing after you! The Lenny Wing! It has a moat!',
    'I am tearing my tuxedo with my bare hands. Look what you made me do. This was Italian.',
    'Who will play croquet with me now?! The guards cheat! The dogs eat the balls!',
    'I have not slept in four days. I have been arguing with my reflection. It is on your side.',
    'I am offering you a lifetime supply of swan. That is an extremely generous amount of swan.',
    'The moon is not on your side, Lenny! I OWN the moon! Well, I have a painting of it.',
    'If you go, I shall simply have to adopt another guest. It will not be the same! They will not twitch!',
    'My gnomes are watching. All four hundred of them. They do not blink. I removed the blinking.',
    'I am going to lie down on the lawn and refuse to get up. That will show you.',
  ],
];

export const LENNY_CAMEO: string[][] = [
  ['Th-that guy is so creepy...', 'Okay. Keep moving. Keep m-moving.', "Don't look at him. Don't look at him.", 'W-why is he always smiling?', 'Is that... is he holding a spoon?', 'I want to go home.'],
  ['Not going back in that cell.', 'Just keep moving.', 'You smell like mothballs.', 'I am NOT stuffing a heron.'],
  ["I'm getting the hang of this.", 'Your guards nap a lot.', 'Nice tux. Bit tight.', 'Who has a harpsichord in a bathroom?'],
  ['Getting nervous, Jeff?', 'Your swan is overcooked.', 'I read your diary. It was mostly about swans.'],
  ['See you at the front door.', 'Been working out. In your dungeon.', 'Tell Pemberton I said hi.'],
  ['Is that sweat, Jeff?', 'Nice hedges. Shame about the owner.', 'Keep the peacock.'],
  ['Bye, Jeff.', 'Hold my rock.', 'I will send you a postcard. From outside.'],
];

export const JEFF_CAUGHT: string[][] = [
  ['Back to the beginning, little mouse.', 'Tsk tsk. Again.', 'Did you really think that would work?', 'Splendid! Do it again. I shall fetch my opera glasses.', 'Gerald! A gold star for you. A small one.', 'Ah. Delightful. Like watching a moth meet a lamp.'],
  ['Caught! Delightful. Again, please.', 'Back you go. Mind the bucket.', 'Pemberton, note the time. I am winning.', 'And THAT is why I pay the guards in rubies.', 'Oh, bravo. Bravo, Gerald.'],
  ['Ha! ...Again. Yes. Good.', "That's what you get!", 'You see? The house always wins. I had that embroidered.', 'Back to the start! I shall celebrate with a single grape.'],
  ['HA! I got you! ...I did, right?', 'See? This is where you belong!', 'Oh thank goodness. I mean, naturally. As planned.', 'Pemberton! Cancel the lawyers!'],
  ['HA! HA! Stay down! ...Please?', 'Got you! Oh thank goodness.', 'Yes! YES! Somebody ring the dinner gong!', 'I knew the small dog would come through.'],
];

export const JEFF_FINAL_CHASE = [
  'STAY!',
  'You belong to the mansion!',
  'Come BACK here!',
  "I'm old, Lenny! Slow down!",
  'MINE!',
  'I have a CROQUET MALLET and I am NOT afraid to use it!',
  'Think of the TOWELS, Lenny!',
  'I will buy you a horse! A FAST horse! So you can ride it BACK!',
  'My knees! My beautiful knees!',
  'Nobody leaves before dessert!',
  'This tuxedo is NOT made for running!',
  'I shall write you out of my will! You are NOT in my will! I shall add you and then REMOVE you!',
];

export function stageLines<T>(arr: T[][], stage: number): T[] {
  return arr[Math.max(0, Math.min(arr.length - 1, stage))];
}

/**
 * Picks a line that hasn't been said yet. Remembers what was said (in localStorage)
 * and only starts repeating once every line in the pool has been used.
 */
export function freshLine(pool: string[], key: string, rand: () => number = Math.random): string {
  const k = `escape-the-mansion/said/${key}`;
  let said: number[] = [];
  try {
    said = JSON.parse(localStorage.getItem(k) ?? '[]');
  } catch {
    said = [];
  }
  let left = pool.map((_, i) => i).filter((i) => !said.includes(i));
  if (!left.length) {
    const last = said[said.length - 1];
    said = [];
    left = pool.map((_, i) => i).filter((i) => i !== last);
  }
  const i = left[Math.floor(rand() * left.length)];
  said.push(i);
  try {
    localStorage.setItem(k, JSON.stringify(said));
  } catch {
    /* private mode: repeats are fine */
  }
  return pool[i];
}

export const ENDING = {
  jeff: "No... no, my house... my guest... Lenny! LENNY! Come back! ...Who's going to listen to my stories now?",
  lenny: "Goodbye, Jeff. Get a hobby.",
};
