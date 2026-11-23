import { Trip, Round, Player, Score, Course, MatchFormat, EventSettings } from '../types/models';
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

// allowance scales the course handicap (e.g. 0.9 for four-ball match play).
function netStrokes(course: Course, player: Player, holeNumber: number, strokes: number, allowance = 1): number {
  const hole = getHole(course, holeNumber);
  if (!hole) return strokes;
  const handicap = Math.round(courseHandicap(player.handicapIndex, course) * allowance);
  return strokes - strokesReceivedOnHole(handicap, hole.strokeIndex);
}

export const formatOf = (round: Round): MatchFormat => round.format ?? 'singles';

// WHS recommended match-play allowances: singles 100%, four-ball 90%.
export function allowanceFor(round: Round): number {
  return formatOf(round) === 'fourball' ? 0.9 : 1;
}

// Older trips have no event settings: teams mean Ryder Cup, otherwise stroke play.
export function eventOf(trip: Trip): EventSettings {
  return trip.event ?? { type: trip.teams.length === 2 ? 'rydercup' : 'strokeplay', skinValue: 5, matchStake: 20 };
}

// Stableford: 2 for net par, +1 per stroke better, 0 for net double bogey or worse.
export function stablefordPoints(net: number, par: number): number {
  return Math.max(0, 2 + par - net);
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
  points: number; // Stableford points so far
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
    let points = 0;
    for (const holeNumber of holes) {
      const s = getScore(scores, playerId, holeNumber);
      if (!s || !player) continue;
      const holeNet = netStrokes(course, player, holeNumber, s.strokes);
      const holePar = getHole(course, holeNumber)?.par ?? 0;
      gross += s.strokes;
      net += holeNet;
      thru += 1;
      par += holePar;
      points += stablefordPoints(holeNet, holePar);
    }
    return { playerId, playerName: player?.name ?? 'Unknown', thru, gross, net, netToPar: net - par, points };
  });
  const stableford = eventOf(trip).type === 'stableford';
  return rows.sort((a, b) =>
    a.thru === 0 && b.thru === 0 ? 0 : stableford ? b.points - a.points : a.net - b.net
  );
}

// ---------- Match play (singles or four-ball; sideA = team A, sideB = team B) ----------

export interface MatchPairing {
  sideA: string[];
  sideB: string[];
}

// Draft-order default: singles A[i] v B[i]; four-ball (A[2i],A[2i+1]) v (B[2i],B[2i+1]).
export function defaultPairings(trip: Trip, playerIds: string[], format: MatchFormat): MatchPairing[] {
  const [teamA, teamB] = trip.teams;
  if (!teamA || !teamB) return [];
  const rosterFor = (teamId: string) => trip.players.filter((p) => p.teamId === teamId && playerIds.includes(p.id));
  const a = rosterFor(teamA.id).map((p) => p.id);
  const b = rosterFor(teamB.id).map((p) => p.id);
  const size = format === 'fourball' ? 2 : 1;
  const count = Math.floor(Math.min(a.length, b.length) / size);
  return Array.from({ length: count }, (_, i) => ({
    sideA: a.slice(i * size, i * size + size),
    sideB: b.slice(i * size, i * size + size),
  }));
}

// Picked pairings when the round has them; older rounds fall back to draft-order singles.
export function matchPairings(trip: Trip, round: Round): MatchPairing[] {
  return round.matches ?? defaultPairings(trip, round.playerIds, 'singles');
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
  const allowance = allowanceFor(round);
  // Best ball: a side's score on a hole is its lowest net (singles = the one player).
  // The hole counts only once every player in the match has a score.
  const sideNet = (ids: string[], holeNumber: number): number | null => {
    let best: number | null = null;
    for (const id of ids) {
      const player = getPlayer(trip, id);
      const sc = getScore(scores, id, holeNumber);
      if (!player || !sc) return null;
      const net = netStrokes(course, player, holeNumber, sc.strokes, allowance);
      best = best === null ? net : Math.min(best, net);
    }
    return best;
  };
  let holesUp = 0;
  let through = 0;
  let closedOut = false;

  for (let i = 0; i < holes.length; i++) {
    const holeNumber = holes[i];
    const netA = sideNet(pairing.sideA, holeNumber);
    const netB = sideNet(pairing.sideB, holeNumber);
    if (netA === null || netB === null) break;
    if (netA < netB) holesUp += 1;
    else if (netB < netA) holesUp -= 1;
    through += 1;

    const remaining = holes.length - through;
    // Closed out early (e.g. 3&2); a match won on the last hole is "1 up", not "1&0".
    if (remaining > 0 && Math.abs(holesUp) > remaining) {
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
        // Each losing player pays the stake to their counterpart on the winning side.
        const winners = status.holesUp > 0 ? pairing.sideA : pairing.sideB;
        const losers = status.holesUp > 0 ? pairing.sideB : pairing.sideA;
        losers.forEach((loserId, i) => {
          add(winners[i] ?? winners[0], round.matchStake);
          add(loserId, -round.matchStake);
        });
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

// ---------- Trip standings (stroke play / Stableford across all rounds) ----------

export interface StandingRow {
  playerId: string;
  playerName: string;
  rounds: number; // rounds with at least one hole scored
  holes: number;
  gross: number;
  netToPar: number;
  points: number;
}

export function tripStandings(trip: Trip): StandingRow[] {
  const rows = new Map<string, StandingRow>(
    trip.players.map((p) => [p.id, { playerId: p.id, playerName: p.name, rounds: 0, holes: 0, gross: 0, netToPar: 0, points: 0 }])
  );
  for (const round of trip.rounds) {
    for (const r of leaderboard(trip, round)) {
      const row = rows.get(r.playerId);
      if (!row || r.thru === 0) continue;
      row.rounds += 1;
      row.holes += r.thru;
      row.gross += r.gross;
      row.netToPar += r.netToPar;
      row.points += r.points;
    }
  }
  const stableford = eventOf(trip).type === 'stableford';
  return [...rows.values()].sort((a, b) => {
    if (!a.holes || !b.holes) return b.holes - a.holes; // players with no scores go last
    return stableford ? b.points - a.points : a.netToPar - b.netToPar;
  });
}

// ---------- Team points (Ryder Cup style: win 1, halve ½, in progress 0) ----------

export interface TeamPoints {
  a: number;
  b: number;
  totalAvailable: number; // one point per match created so far
  toWin: number;
}

export function matchPoints(status: MatchStatus, totalHoles: number): { a: number; b: number } | null {
  if (!isMatchDecided(status, totalHoles)) return null;
  if (status.holesUp > 0) return { a: 1, b: 0 };
  if (status.holesUp < 0) return { a: 0, b: 1 };
  return { a: 0.5, b: 0.5 };
}

export function teamPoints(trip: Trip): TeamPoints {
  let a = 0;
  let b = 0;
  let totalAvailable = 0;
  for (const round of trip.rounds) {
    if (!round.matchEnabled) continue;
    const holes = holeNumbersFor(round.holesPlayed).length;
    for (const pairing of matchPairings(trip, round)) {
      totalAvailable += 1;
      const pts = matchPoints(matchStatus(trip, round, pairing), holes);
      if (pts) {
        a += pts.a;
        b += pts.b;
      }
    }
  }
  return { a, b, totalAvailable, toWin: totalAvailable / 2 + 0.5 };
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
  console.assert(pairings[0].sideA[0] === 'p1' && pairings[0].sideB[0] === 'p2', 'match: slot 1 pairing (legacy fallback)');

  const status = matchStatus(trip, trip.rounds[0], pairings[0]);
  console.assert(status.holesUp === 1 && status.through === 1, 'match: Alice 1 up thru 1 (3 beats 5)');

  // Four-ball: (Alice, Cara) v (Bob, Dee) on hole 1 -> best nets 3 v 4, team A 1 up.
  const fb: Round = { ...trip.rounds[0], format: 'fourball', matches: [{ id: 'm1', sideA: ['p1', 'p3'], sideB: ['p2', 'p4'] }] };
  const fbStatus = matchStatus(trip, fb, fb.matches![0]);
  console.assert(fbStatus.holesUp === 1 && fbStatus.through === 1, 'fourball: best ball 3 beats 4');
  console.assert(allowanceFor(fb) === 0.9 && allowanceFor(trip.rounds[0]) === 1, 'fourball: 90% allowance, singles 100%');
  const dp = defaultPairings(trip, ['p1', 'p2', 'p3', 'p4'], 'fourball');
  console.assert(dp.length === 1 && dp[0].sideA.join() === 'p1,p3' && dp[0].sideB.join() === 'p2,p4', 'fourball: default pairs by draft order');

  // Points: win 1, halve half each, in progress none.
  const done = (holesUp: number): MatchStatus => ({ pairing: dp[0], through: 9, holesUp, closedOut: false, resultLabel: '' });
  console.assert(JSON.stringify(matchPoints(done(1), 9)) === '{"a":1,"b":0}', 'points: win = 1');
  console.assert(JSON.stringify(matchPoints(done(0), 9)) === '{"a":0.5,"b":0.5}', 'points: halve = half each');
  console.assert(matchPoints({ ...done(2), through: 4 }, 9) === null, 'points: in progress = none');
  const tp = teamPoints(trip);
  console.assert(tp.totalAvailable === 2 && tp.toWin === 1.5 && tp.a === 0 && tp.b === 0, 'points: 2 live matches, 1.5 to win');

  // Four-ball settlement over 18 holes: team A wins hole 1 then all halved -> each loser pays $20.
  const fb18: Round = { ...fb, holesPlayed: '18', skinsEnabled: false };
  const extra = [];
  for (let h = 2; h <= 18; h++) for (const p of ['p1', 'p2', 'p3', 'p4']) extra.push({ roundId: 'r1', playerId: p, holeNumber: h, strokes: 4 });
  const fbLines = computeSettlement({ ...trip, rounds: [fb18], scores: [...trip.scores, ...extra] });
  console.assert(fbLines.length === 2 && fbLines.every((l) => l.amount === 20), 'fourball settlement: both losers pay $20');
  const lastHole = matchStatus({ ...trip, scores: [...trip.scores, ...extra] }, fb18, fb18.matches![0]);
  console.assert(lastHole.resultLabel === '1 up' && !lastHole.closedOut && lastHole.through === 18, 'match: won on 18 reads "1 up", not "1&0"');

  // Stableford: net birdie 3, par 2, bogey 1, double 0 (never negative).
  console.assert(
    [stablefordPoints(3, 4), stablefordPoints(4, 4), stablefordPoints(5, 4), stablefordPoints(6, 4), stablefordPoints(9, 4)].join() === '3,2,1,0,0',
    'stableford: points per hole'
  );
  // Standings across two rounds: second round copies the first with Alice making 5s.
  const r2: Round = { ...trip.rounds[0], id: 'r2' };
  const two: Trip = {
    ...trip,
    rounds: [trip.rounds[0], r2],
    scores: [...trip.scores, { roundId: 'r2', playerId: 'p1', holeNumber: 1, strokes: 5 }],
  };
  const st = tripStandings(two);
  const aliceRow = st.find((r) => r.playerId === 'p1')!;
  console.assert(aliceRow.rounds === 2 && aliceRow.gross === 8 && aliceRow.netToPar === 0, 'standings: 3 + 5 on par 4s = E over 2 rounds');
  console.assert(st[0].playerId === 'p1', 'standings: stroke play leader has lowest net to par');
  const stb = tripStandings({ ...two, event: { type: 'stableford', skinValue: 0, matchStake: 0 } });
  console.assert(stb[0].points >= stb[1].points, 'standings: stableford sorts by points');

  const settlement = computeSettlement(trip);
  const net = settlement.reduce((sum, l) => sum + l.amount, 0) - settlement.reduce((sum, l) => sum + l.amount, 0);
  console.assert(net === 0, 'settlement: lines should always net to zero by construction');
}
selfCheck();
