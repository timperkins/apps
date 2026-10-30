// Timeline time is measured in months: t = year * 12 + (month - 1), fractional in between.

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export function monthIndex(date: string): number {
  const m = /^(\d{4})-(\d{2})$/.exec(date);
  if (!m) throw new Error(`Bad date "${date}", expected YYYY-MM`);
  const month = Number(m[2]);
  if (month < 1 || month > 12) throw new Error(`Bad month in "${date}"`);
  return Number(m[1]) * 12 + month - 1;
}

export function formatMonth(t: number): string {
  const i = Math.floor(t);
  return `${MONTHS[((i % 12) + 12) % 12]} ${Math.floor(i / 12)}`;
}

export function yearOf(t: number): number {
  return Math.floor(Math.floor(t) / 12);
}

/**
 * Reads what someone types into the date box: "2014", "June 2014", "jun 2014", "2014-06", "6/2014".
 * Returns a month index, or null when it can't tell.
 */
export function parseDateInput(text: string): number | null {
  const s = text.trim().toLowerCase().replace(/,/g, ' ').replace(/\s+/g, ' ');
  let m = /^(\d{4})$/.exec(s);
  if (m) return Number(m[1]) * 12;
  m = /^(\d{4})[-/.](\d{1,2})$/.exec(s);
  if (m) return withMonth(Number(m[1]), Number(m[2]));
  m = /^(\d{1,2})[-/.](\d{4})$/.exec(s);
  if (m) return withMonth(Number(m[2]), Number(m[1]));
  m = /^([a-z]+)\.? (\d{4})$/.exec(s);
  const reversed = /^(\d{4}) ([a-z]+)$/.exec(s);
  const word = m ? m[1] : reversed?.[2];
  const year = m ? m[2] : reversed?.[1];
  if (word && year && word.length >= 3) {
    const month = MONTHS.findIndex((name) => name.toLowerCase().startsWith(word));
    if (month >= 0) return Number(year) * 12 + month;
  }
  return null;
}

function withMonth(year: number, month: number): number | null {
  return month >= 1 && month <= 12 ? year * 12 + month - 1 : null;
}
