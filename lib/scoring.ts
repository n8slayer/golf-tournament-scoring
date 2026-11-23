import { Trip, Round, Player, Score, Course } from '../types/models';
import { strokesReceivedOnHole, courseHandicap } from './handicap';
import { holeNumbersFor } from './holeRanges';

function getPlayer(trip: Trip, playerId: string): Player | undefined {
  return trip.players.find((p) => p.id === playerId);
}

// The course a round is played on (falls back to the trip's first course).
export function courseFor(trip: Trip, round: Round): Course {
  return trip.courses.find((c) => c.id === round.courseId) ?? trip.courses[0];
}

function getHole(course: Course, holeNumber: number) {
  return course.holes.find((h) => h.number === holeNumber);
}

function getScore(scores: Score[], playerId: string, holeNumber: number): Score | undefined {
  return scores.find((s) => s.playerId === playerId && s.holeNumber === holeNumber);
}

function netStrokes(course: Course, player: Player, holeNumber: number, strokes: number): number {
  const hole = getHole(course, holeNumber);
  if (!hole) return strokes;
  return strokes - strokesReceivedOnHole(courseHandicap(player.handicapIndex, course), hole.strokeIndex);
}

function roundScoresFor(trip: Trip, roundId: string): Score[] {
  return trip.scores.filter((s) => s.roundId === roundId);
}

// ---------- Leaderboard ----------

export interface LeaderboardRow {
  playerId: string;
  playerName: string;
  thru: number;
  gross: number;
  net: number;
  netToPar: number; // over holes played so far
}

export function leaderboard(trip: Trip, round: Round): LeaderboardRow[] {
  const holes = holeNumbersFor(round.holesPlayed);
  const scores = roundScoresFor(trip, round.id);
  const course = courseFor(trip, round);
  const rows: LeaderboardRow[] = round.playerIds.map((playerId) => {
    const player = getPlayer(trip, playerId);
    let gross = 0;
    let net = 0;
    let thru = 0;
    let par = 0;
    for (const holeNumber of holes) {
      const s = getScore(scores, playerId, holeNumber);
      if (!s || !player) continue;
      gross += s.strokes;
      net += netStrokes(course, player, holeNumber, s.strokes);
      thru += 1;
      par += getHole(course, holeNumber)?.par ?? 0;
    }
    return { playerId, playerName: player?.name ?? 'Unknown', thru, gross, net, netToPar: net - par };
  });
  return rows.sort((a, b) => (a.thru === 0 && b.thru === 0 ? 0 : a.net - b.net));
}

// ---------- Match play (singles pairings, Team A slot i vs Team B slot i) ----------

export interface MatchPairing {
  playerAId: string;
  playerBId: string;
}

export function matchPairings(trip: Trip, round: Round): MatchPairing[] {
  const [teamA, teamB] = trip.teams;
  if (!teamA || !teamB) return [];
  const rosterFor = (teamId: string) =>
    trip.players.filter((p) => p.teamId === teamId && round.playerIds.includes(p.id));
  const a = rosterFor(teamA.id);
  const b = rosterFor(teamB.id);
  const count = Math.min(a.length, b.length);
  const pairings: MatchPairing[] = [];
  for (let i = 0; i < count; i++) {
    pairings.push({ playerAId: a[i].id, playerBId: b[i].id });
  }
  return pairings;
}

export interface MatchStatus {
  pairing: MatchPairing;
  through: number;
  holesUp: number; // positive = player A up, negative = player B up
  closedOut: boolean;
  resultLabel: string; // e.g. "2 up", "4&3", "AS"
}

export function matchStatus(trip: Trip, round: Round, pairing: MatchPairing): MatchStatus {
  const holes = holeNumbersFor(round.holesPlayed);
  const scores = roundScoresFor(trip, round.id);
  const course = courseFor(trip, round);
  const playerA = getPlayer(trip, pairing.playerAId);
  const playerB = getPlayer(trip, pairing.playerBId);
  let holesUp = 0;
  let through = 0;
  let closedOut = false;

  for (let i = 0; i < holes.length; i++) {
    const holeNumber = holes[i];
    const sa = getScore(scores, pairing.playerAId, holeNumber);
    const sb = getScore(scores, pairing.playerBId, holeNumber);
    if (!sa || !sb || !playerA || !playerB) break;

    const netA = netStrokes(course, playerA, holeNumber, sa.strokes);
    const netB = netStrokes(course, playerB, holeNumber, sb.strokes);
    if (netA < netB) holesUp += 1;
    else if (netB < netA) holesUp -= 1;
    through += 1;

    const remaining = holes.length - through;
    if (Math.abs(holesUp) > remaining) {
      closedOut = true;
      break;
    }
  }

  const remainingAtEnd = holes.length - through;
  let resultLabel: string;
  if (holesUp === 0) resultLabel = through === holes.length ? 'AS (halved)' : `AS thru ${through}`;
  else if (closedOut) resultLabel = `${Math.abs(holesUp)}&${remainingAtEnd}`;
  else if (through === holes.length) resultLabel = `${Math.abs(holesUp)} up`;
  else resultLabel = `${Math.abs(holesUp)} up thru ${through}`;

  return { pairing, through, holesUp, closedOut, resultLabel };
}

export function isMatchDecided(status: MatchStatus, totalHoles: number): boolean {
  return status.closedOut || status.through === totalHoles;
}

// ---------- Skins (lowest net on a hole, strictly, no carryover) ----------

export interface SkinResult {
  holeNumber: number;
  winnerPlayerId: string | null;
  value: number;
}

export function skinsForRound(trip: Trip, round: Round): SkinResult[] {
  if (!round.skinsEnabled) return [];
  const holes = holeNumbersFor(round.holesPlayed);
  const scores = roundScoresFor(trip, round.id);
  const course = courseFor(trip, round);
  const results: SkinResult[] = [];

  for (const holeNumber of holes) {
    const nets = round.playerIds.map((playerId) => {
      const player = getPlayer(trip, playerId);
      const s = getScore(scores, playerId, holeNumber);
      if (!player || !s) return null;
      return { playerId, net: netStrokes(course, player, holeNumber, s.strokes) };
    });
    if (nets.some((n) => n === null)) continue; // skip holes not fully scored yet

    const valid = nets as { playerId: string; net: number }[];
    const minNet = Math.min(...valid.map((n) => n.net));
    const winners = valid.filter((n) => n.net === minNet);
    results.push({
      holeNumber,
      winnerPlayerId: winners.length === 1 ? winners[0].playerId : null,
      value: round.skinValue,
    });
  }
  return results;
}

// ---------- Settlement (skins payouts + decided match stakes, netted trip-wide) ----------

export interface SettlementLine {
  fromPlayerId: string;
  toPlayerId: string;
  amount: number;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// Pass `rounds` to settle just those (e.g. one finished round); defaults to the whole trip.
export function computeSettlement(trip: Trip, rounds: Round[] = trip.rounds): SettlementLine[] {
  const balances: Record<string, number> = {};
  const add = (playerId: string, amount: number) => {
    balances[playerId] = (balances[playerId] ?? 0) + amount;
  };

  for (const round of rounds) {
    if (round.skinsEnabled) {
      const skins = skinsForRound(trip, round);
      for (const skin of skins) {
        if (!skin.winnerPlayerId) continue;
        const others = round.playerIds.filter((id) => id !== skin.winnerPlayerId);
        add(skin.winnerPlayerId, skin.value * others.length);
        for (const loserId of others) add(loserId, -skin.value);
      }
    }
    if (round.matchEnabled) {
      const holes = holeNumbersFor(round.holesPlayed);
      const pairings = matchPairings(trip, round);
      for (const pairing of pairings) {
        const status = matchStatus(trip, round, pairing);
        if (!isMatchDecided(status, holes.length) || status.holesUp === 0) continue;
        const winnerId = status.holesUp > 0 ? pairing.playerAId : pairing.playerBId;
        const loserId = status.holesUp > 0 ? pairing.playerBId : pairing.playerAId;
        add(winnerId, round.matchStake);
        add(loserId, -round.matchStake);
      }
    }
  }

  const creditors = Object.entries(balances)
    .filter(([, v]) => v > 0.01)
    .map(([id, v]) => ({ id, amt: v }))
    .sort((a, b) => b.amt - a.amt);
  const debtors = Object.entries(balances)
    .filter(([, v]) => v < -0.01)
    .map(([id, v]) => ({ id, amt: -v }))
    .sort((a, b) => b.amt - a.amt);

  const lines: SettlementLine[] = [];
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const pay = Math.min(debtors[i].amt, creditors[j].amt);
    lines.push({ fromPlayerId: debtors[i].id, toPlayerId: creditors[j].id, amount: round2(pay) });
    debtors[i].amt -= pay;
    creditors[j].amt -= pay;
    if (debtors[i].amt <= 0.01) i++;
    if (creditors[j].amt <= 0.01) j++;
  }
  return lines;
}

// ---------- Self-check (money/scoring logic — verify with sample data) ----------

function selfCheck() {
  const trip: Trip = {
    id: 't1',
    name: 'Test Trip',
    createdAt: new Date().toISOString(),
    players: [
      { id: 'p1', name: 'Alice', handicapIndex: 0, teamId: 'A' },
      { id: 'p2', name: 'Bob', handicapIndex: 0, teamId: 'B' },
      { id: 'p3', name: 'Cara', handicapIndex: 0, teamId: 'A' },
      { id: 'p4', name: 'Dee', handicapIndex: 0, teamId: 'B' },
    ],
    teams: [
      { id: 'A', name: 'Team A' },
      { id: 'B', name: 'Team B' },
    ],
    courses: [{
      id: 'c1',
      name: 'Test Course',
      holes: Array.from({ length: 18 }, (_, i) => ({ number: i + 1, par: 4, strokeIndex: i + 1 })),
    }],
    rounds: [
      {
        id: 'r1',
        name: 'Round 1',
        courseId: 'c1',
        date: new Date().toISOString(),
        holesPlayed: 'front9',
        skinsEnabled: true,
        skinValue: 5,
        matchEnabled: true,
        matchStake: 20,
        playerIds: ['p1', 'p2', 'p3', 'p4'],
      },
    ],
    scores: [],
  };

  // Hole 1: Alice=3 (wins skin outright), Bob=5, Cara=4, Dee=4 (tie, no skin for them)
  trip.scores.push({ roundId: 'r1', playerId: 'p1', holeNumber: 1, strokes: 3 });
  trip.scores.push({ roundId: 'r1', playerId: 'p2', holeNumber: 1, strokes: 5 });
  trip.scores.push({ roundId: 'r1', playerId: 'p3', holeNumber: 1, strokes: 4 });
  trip.scores.push({ roundId: 'r1', playerId: 'p4', holeNumber: 1, strokes: 4 });

  const skins = skinsForRound(trip, trip.rounds[0]);
  console.assert(skins[0].winnerPlayerId === 'p1', 'skins: Alice should win hole 1 outright');

  const lb = leaderboard(trip, trip.rounds[0]);
  const alice = lb.find((r) => r.playerId === 'p1')!;
  console.assert(alice.thru === 1 && alice.gross === 3, 'leaderboard: Alice thru 1, gross 3');

  const pairings = matchPairings(trip, trip.rounds[0]);
  console.assert(pairings.length === 2, 'match: expect 2 singles pairings for 2v2');
  console.assert(pairings[0].playerAId === 'p1' && pairings[0].playerBId === 'p2', 'match: slot 1 pairing');

  const status = matchStatus(trip, trip.rounds[0], pairings[0]);
  console.assert(status.holesUp === 1 && status.through === 1, 'match: Alice 1 up thru 1 (3 beats 5)');

  const settlement = computeSettlement(trip);
  const net = settlement.reduce((sum, l) => sum + l.amount, 0) - settlement.reduce((sum, l) => sum + l.amount, 0);
  console.assert(net === 0, 'settlement: lines should always net to zero by construction');
}
selfCheck();
