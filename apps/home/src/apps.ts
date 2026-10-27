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
];
