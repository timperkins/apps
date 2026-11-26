// The Audio page's words and numbers match the game's clips.
import { existsSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ANNOUNCE, GAIN, MUSIC_VOLUME, UNIT_CLIPS } from '../audio-config';
import { ANNOUNCEMENTS, LINES, MUSIC, SFX, SFX_OPTIONS, VOICE_OPTIONS, VOICES } from './data';

const pub = new URL('../../public/', import.meta.url).pathname;
const mp3s = (dir: string) =>
  readdirSync(pub + dir)
    .filter((f) => f.endsWith('.mp3'))
    .map((f) => f.slice(0, -4))
    .sort();

describe('audio page', () => {
  it('describes every sound effect file, and only those', () => {
    expect(Object.keys(SFX).sort()).toEqual(mp3s('sfx'));
  });

  it('has an in-game volume for every sound effect', () => {
    for (const n of Object.keys(SFX)) expect(GAIN[n as keyof typeof GAIN], n).toBeTypeOf('number');
  });

  it('has a transcript for every take the game plays, and a file for each', () => {
    const files = new Set<string>();
    for (const v of Object.keys(VOICES)) for (const f of mp3s(`voice/${v}`)) files.add(`${v}/${f}`);
    const want = new Set<string>();
    for (const [v, lines] of Object.entries(UNIT_CLIPS))
      for (const [line, n] of Object.entries(lines)) {
        expect(LINES[v as keyof typeof LINES][line as keyof (typeof LINES)['soldier']], `${v} ${line}`).toHaveLength(n!);
        for (let i = 1; i <= n!; i++) want.add(`${v}/${v}_${line}_${i}`);
      }
    for (const a of ANNOUNCE) {
      expect(ANNOUNCEMENTS[a].says, a).toBeTruthy();
      want.add(`announcer/announcer_${a}_1`);
    }
    expect([...want].sort()).toEqual([...files].sort());
  });

  it('describes every music loop', () => {
    expect(Object.keys(MUSIC).sort()).toEqual(mp3s('music'));
    expect(Object.keys(MUSIC_VOLUME).sort()).toEqual(mp3s('music'));
  });

  it('has every new option the page offers, and only those', () => {
    const want: string[] = [];
    for (const n of Object.keys(SFX)) for (let i = 1; i <= SFX_OPTIONS; i++) want.push(`${n}_${i}`);
    expect(mp3s('sfx/options')).toEqual(want.sort());
    for (const [v, vo] of Object.entries(VOICE_OPTIONS)) {
      expect(vo.options, v).toHaveLength(3);
      expect(mp3s(`voice-options/${v}`), v).toEqual(vo.options.map((o) => `${v}_select_${o.slug}`).sort());
    }
    const dirs = existsSync(pub + 'voice-options') ? readdirSync(pub + 'voice-options') : [];
    expect(dirs.sort()).toEqual(Object.keys(VOICE_OPTIONS).sort());
  });
});
