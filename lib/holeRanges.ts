import { HolesPlayed } from '../types/models';

export function holeNumbersFor(holesPlayed: HolesPlayed): number[] {
  if (holesPlayed === 'front9') return range(1, 9);
  if (holesPlayed === 'back9') return range(10, 18);
  return range(1, 18);
}

function range(start: number, end: number): number[] {
  const out: number[] = [];
  for (let i = start; i <= end; i++) out.push(i);
  return out;
}
