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
  [
    'Wandering again? How tiresome.',
    'My guards have orders not to hurt you. Much.',
    'Every door in this house answers to me.',
    'You look tired, Lenny. Your cell has a lovely bucket.',
    'Run along, little mouse. I do so enjoy the chase.',
    'Do you hear the dogs? They hear you.',
  ],
  [
    'A temporary inconvenience. Nothing more.',
    'My staff will have you back in irons by supper.',
    'You missed a spot. On your face. Everywhere, actually.',
    'Still crawling about? How quaint.',
    "I've had houseguests like you before. Briefly.",
  ],
  [
    "You're... further than the others got.",
    'Stop touching my things!',
    'Guards! GUARDS! What am I paying you for?!',
    "That was luck. That's all that was.",
    'Hm. You seem... taller.',
  ],
  [
    "Lenny, let's be reasonable. Stay for dinner?",
    "You can't leave! Who would I talk to?!",
    'Where did you GET those arms?!',
    "I'm not sweating. The house is humid.",
    'I can change! I can get you a nicer cell!',
  ],
  [
    'No no no NO! Not like this!',
    'Release the dogs! ALL the dogs!',
    "I'm not crying. YOU'RE crying.",
    'Please! I have nothing else! Just this house! And you!',
    'Fine! FINE! Go! ...No, wait, come back!',
  ],
];

export const LENNY_CAMEO: string[][] = [
  ['Th-that guy is so creepy...', 'Okay. Keep moving. Keep m-moving.', "Don't look at him. Don't look at him."],
  ['Not going back in that cell.', 'Just keep moving.', 'You smell like mothballs.'],
  ["I'm getting the hang of this.", 'Your guards nap a lot.', 'Nice tux. Bit tight.'],
  ['Getting nervous, Jeff?', 'See you at the front door.', 'Been working out. In your dungeon.'],
  ['Bye, Jeff.', 'Is that sweat, Jeff?', 'Hold my rock.'],
];

export const JEFF_CAUGHT: string[][] = [
  ['Back to the beginning, little mouse.', 'Tsk tsk. Again.', 'Did you really think that would work?'],
  ['Caught! Delightful. Again, please.', 'Back you go.'],
  ['Ha! ...Again. Yes. Good.', "That's what you get!"],
  ['HA! I got you! ...I did, right?', "See? This is where you belong!"],
  ['HA! HA! Stay down! ...Please?', 'Got you! Oh thank goodness.'],
];

export const JEFF_FINAL_CHASE = ['STAY!', 'You belong to the mansion!', 'Come BACK here!', "I'm old, Lenny! Slow down!", 'MINE!'];

export const ENDING = {
  jeff: "No... no, my house... my guest... Lenny! LENNY! Come back! ...Who's going to listen to my stories now?",
  lenny: "Goodbye, Jeff. Get a hobby.",
};

export function stageLines<T>(arr: T[][], stage: number): T[] {
  return arr[Math.max(0, Math.min(arr.length - 1, stage))];
}
