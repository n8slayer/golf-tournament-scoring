import { Course } from '../types/models';

// Plus handicaps are stored as negatives: "+5.4" → -5.4.
export const MAX_INDEX = 54;
export const MAX_PLUS = 10; // shortcut: WHS sets no plus floor; +10 just catches typos.

// Parses what a golfer types: "12.4", "+5.4". Returns null when invalid.
export function parseHandicapIndex(text: string): number | null {
  const m = text.trim().match(/^(\+)?(\d{1,2}(?:\.\d)?)$/);
  if (!m) return null;
  const value = parseFloat(m[2]);
  if (m[1]) return value === 0 ? 0 : value <= MAX_PLUS ? -value : null;
  return value <= MAX_INDEX ? value : null;
}

// Shows plus handicaps the way golfers write them: -5.4 → "+5.4".
export function formatHandicap(n: number): string {
  return n < 0 ? `+${-n}` : String(n);
}

// Strokes on a hole from a course handicap. Positive: strokes received on the
// hardest holes (second pass over 18). Negative (plus): strokes given back on
// the easiest holes, returned as a negative number.
export function strokesReceivedOnHole(handicap: number, strokeIndex: number): number {
  const rounded = Math.round(handicap);
  if (rounded === 0) return 0;
  if (rounded < 0) {
    const plus = -rounded;
    const base = Math.floor(plus / 18);
    const extra = plus % 18 >= 19 - strokeIndex ? 1 : 0;
    return -(base + extra);
  }
  const base = Math.floor(rounded / 18);
  const extra = rounded % 18 >= strokeIndex ? 1 : 0;
  return base + extra;
}

// WHS course handicap: index × slope/113 + (rating − par). Falls back to the
// raw index when the course has no slope/rating (hand-entered courses).
export function courseHandicap(handicapIndex: number, course: Pick<Course, 'holes' | 'slope' | 'rating'>): number {
  if (!course.slope || !course.rating) return Math.round(handicapIndex);
  const par = course.holes.reduce((sum, h) => sum + h.par, 0);
  return Math.round((handicapIndex * course.slope) / 113 + (course.rating - par));
}

function selfCheck() {
  // 9-handicap: strokes on the 9 hardest holes (strokeIndex 1-9) only.
  console.assert(strokesReceivedOnHole(9, 1) === 1, 'handicap: hardest hole should get a stroke');
  console.assert(strokesReceivedOnHole(9, 9) === 1, 'handicap: 9th hardest should get a stroke');
  console.assert(strokesReceivedOnHole(9, 10) === 0, 'handicap: easier than 9th should get none');
  // 22-handicap: every hole gets at least 1, plus the 4 hardest get a 2nd.
  console.assert(strokesReceivedOnHole(22, 1) === 2, 'handicap: 22 should give 2 on hardest holes');
  console.assert(strokesReceivedOnHole(22, 18) === 1, 'handicap: 22 should give 1 on easiest hole');
  console.assert(strokesReceivedOnHole(0, 5) === 0, 'handicap: scratch golfer gets nothing');
  // +3: gives a stroke back on the 3 easiest holes (SI 18, 17, 16) only.
  console.assert(strokesReceivedOnHole(-3, 18) === -1, 'handicap: plus gives back on easiest hole');
  console.assert(strokesReceivedOnHole(-3, 16) === -1, 'handicap: plus gives back on 3rd easiest');
  console.assert(strokesReceivedOnHole(-3, 15) === 0, 'handicap: plus 3 keeps 4th easiest');
  console.assert(strokesReceivedOnHole(-3, 1) === 0, 'handicap: plus keeps hardest hole');
  // Input parsing.
  console.assert(parseHandicapIndex('+5.4') === -5.4, 'handicap: +5.4 parses to -5.4');
  console.assert(parseHandicapIndex('12.4') === 12.4, 'handicap: 12.4 parses');
  console.assert(parseHandicapIndex('54') === 54, 'handicap: 54 allowed');
  console.assert(parseHandicapIndex('54.1') === null, 'handicap: over 54 rejected');
  console.assert(parseHandicapIndex('+10.5') === null, 'handicap: beyond +10 rejected');
  console.assert(parseHandicapIndex('-5') === null, 'handicap: minus sign rejected (use +)');
  console.assert(parseHandicapIndex('abc') === null, 'handicap: junk rejected');
  console.assert(formatHandicap(-5.4) === '+5.4' && formatHandicap(8) === '8', 'handicap: plus formatting');
  // Plus index on a sloped course: -5.4 × 144/113 + (74.9 − 72) = -3.98 → -4
  console.assert(courseHandicap(-5.4, { holes: Array.from({ length: 18 }, (_, i) => ({ number: i + 1, par: 4, strokeIndex: i + 1 })), slope: 144, rating: 74.9 }) === -4, 'handicap: plus course handicap');
  const holes = Array.from({ length: 18 }, (_, i) => ({ number: i + 1, par: 4, strokeIndex: i + 1 }));
  // 14 × 144/113 + (75.5 − 72) = 21.3 → 21
  console.assert(courseHandicap(14, { holes, slope: 144, rating: 75.5 }) === 21, 'handicap: slope/rating course handicap');
  console.assert(courseHandicap(14.4, { holes }) === 14, 'handicap: no slope falls back to index');
}
selfCheck();
