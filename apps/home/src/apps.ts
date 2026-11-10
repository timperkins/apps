// Every app that is live on trom.dev. Add a line when an app's prod deploy is verified.
export interface AppLink {
  name: string;
  url: string;
  blurb: string;
}

export const APPS: AppLink[] = [
  {
    name: 'Sky Defender',
    url: 'https://sky-defender.trom.dev',
    blurb: 'Tilt your phone to aim the flak gun and hold off the waves.',
  },
  {
    name: 'Sky Defender 2: Your worst nightmare',
    url: 'https://sky-defender-2.trom.dev',
    blurb: 'The sequel to Sky Defender. Tilt your phone to aim and survive the onslaught.',
  },
  {
    name: 'Pong',
    url: 'https://pong.trom.dev',
    blurb: 'Two-player Pong on a big screen. Tilt your phone to move your paddle.',
  },
  {
    name: 'Slither',
    url: 'https://slither.trom.dev',
    blurb: 'Party snake game on a big screen. Steer from your phone, eat, grow, and cut off your friends.',
  },
  {
    name: 'Scorched',
    url: 'https://scorched.trom.dev',
    blurb: 'Realtime artillery on destructible terrain, with phones as controllers.',
  },
  {
    name: 'You Have Been Chosen',
    url: 'https://chosen.trom.dev',
    blurb: 'Everyone puts a finger on the screen and the app picks one.',
  },
  {
    name: 'Paper Airplane',
    url: 'https://paper-airplane.trom.dev',
    blurb: 'Step-by-step paper airplane folding, animated in 3D.',
  },
  {
    name: 'My Hotel',
    url: 'https://my-hotel.trom.dev',
    blurb: 'Run a 3D hotel: check guests in, clean rooms and buy land. Play alone or with a friend.',
  },
  {
    name: 'Tim News',
    url: 'https://news.trom.dev',
    blurb: "Today's news, written up from real reporting, with local stories and topics you care about.",
  },
  {
    name: 'Bad Guys and Good Guys',
    url: 'https://bad-guys-good-guys.trom.dev',
    blurb: 'Brawl your way home on the last day of school, with up to four friends joining by code or QR.',
  },
  {
    name: 'Your doom',
    url: 'https://your-doom.trom.dev',
    blurb: 'Chop wood in the snowy woods, sell it to the camp for eeeddd, and pick from 8 ways to play.',
  },
  {
    name: 'Ground Defender',
    url: 'https://ground-defender.trom.dev',
    blurb: 'Hold off bears from spawners in the woods: dig ore, smelt it, and build a factory of belts, drills and turrets.',
  },
];
