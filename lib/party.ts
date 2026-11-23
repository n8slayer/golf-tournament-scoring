import { Trip } from '../types/models';
import { courseFor } from './scoring';

// Party Mode: every gross birdie or better in the event (strokes <= par - 1).
export interface PartyHole {
  key: string; // round:player:hole, what a phone remembers as already shown
  roundId: string;
  playerId: string;
  playerName: string;
  roundName: string;
  hole: number;
  label: string; // BIRDIE, EAGLE, ALBATROSS, HOLE IN ONE
}

const LABEL: Record<number, string> = { 1: 'BIRDIE', 2: 'EAGLE', 3: 'ALBATROSS' };

export function partyHoles(trip: Trip): PartyHole[] {
  const out: PartyHole[] = [];
  for (const sc of trip.scores) {
    const round = trip.rounds.find((r) => r.id === sc.roundId);
    const par = round && courseFor(trip, round)?.holes.find((h) => h.number === sc.holeNumber)?.par;
    if (!round || !par || !sc.strokes || sc.strokes > par - 1) continue;
    out.push({
      key: `${sc.roundId}:${sc.playerId}:${sc.holeNumber}`,
      roundId: sc.roundId,
      playerId: sc.playerId,
      playerName: trip.players.find((p) => p.id === sc.playerId)?.name ?? 'Someone',
      roundName: round.name,
      hole: sc.holeNumber,
      label: sc.strokes === 1 ? 'HOLE IN ONE' : (LABEL[par - sc.strokes] ?? 'ALBATROSS'),
    });
  }
  return out;
}

function selfCheck() {
  const holes = [4, 5, 3].map((par, i) => ({ number: i + 1, par, strokeIndex: i + 1 }));
  const trip = {
    players: [{ id: 'a', name: 'Mike', handicapIndex: 0 }],
    courses: [{ id: 'c', name: 'C', holes }],
    rounds: [{ id: 'r', name: 'Day 1', courseId: 'c' }],
    scores: [
      { roundId: 'r', playerId: 'a', holeNumber: 1, strokes: 3 }, // birdie
      { roundId: 'r', playerId: 'a', holeNumber: 2, strokes: 3 }, // eagle
      { roundId: 'r', playerId: 'a', holeNumber: 3, strokes: 1 }, // ace
      { roundId: 'r', playerId: 'a', holeNumber: 4, strokes: 2 }, // no such hole
      { roundId: 'x', playerId: 'a', holeNumber: 1, strokes: 2 }, // no such round
    ],
  } as unknown as Trip;
  const got = partyHoles(trip)
    .map((p) => p.label)
    .join();
  console.assert(got === 'BIRDIE,EAGLE,HOLE IN ONE', `party: finds birdie/eagle/ace, got ${got}`);
  const par = {
    ...trip,
    scores: [
      { roundId: 'r', playerId: 'a', holeNumber: 1, strokes: 4 },
      { roundId: 'r', playerId: 'a', holeNumber: 2, strokes: 6 },
    ],
  } as Trip;
  console.assert(partyHoles(par).length === 0, 'party: ignores par and bogey');
}
selfCheck();
