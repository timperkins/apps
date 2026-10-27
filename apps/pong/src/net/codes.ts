// Consonants only: no lookalikes (I, O) and no accidental words.
export const CODE_ALPHABET = 'BCDFGHJKLMNPQRSTVWXZ';
export const CODE_LENGTH = 4;

export function randomCode(rand: () => number = Math.random): string {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) code += CODE_ALPHABET[Math.floor(rand() * CODE_ALPHABET.length)];
  return code;
}

export function normalizeCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z]/g, '').slice(0, CODE_LENGTH);
}

export function isValidCode(code: string): boolean {
  return code.length === CODE_LENGTH && [...code].every((c) => CODE_ALPHABET.includes(c));
}
