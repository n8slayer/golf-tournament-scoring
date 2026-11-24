import { Trip, Round, EventType, Player } from '../types/models';
import { courseFor, eventOf, leaderboard, sideHandicap } from './scoring';
import { courseHandicap, strokesReceivedOnHole } from './handicap';
import { holeNumbersFor } from './holeRanges';

export const EVENT_LABEL: Record<EventType, string> = {
  rydercup: 'Ryder Cup',
  strokeplay: 'Stroke Play',
  stableford: 'Stableford',
  merit: 'Order of Merit',
  wolf: 'Wolf',
  'team-stroke': 'Team Stroke Play',
  'team-stableford': 'Team Stableford',
  'best-ball': 'Best Ball',
  'team-scramble': 'Team Scramble',
};

// Games beyond plain stroke play / Stableford / Ryder Cup. Rows are teams when `teams`, else players.
type Game = Exclude<EventType, 'rydercup' | 'strokeplay' | 'stableford'>;
export const GAME_RULES: Record<Game, { teams: boolean; higherWins: boolean; unit: 'pts' | 'toPar'; rule: string }> = {
  merit: { teams: false, higherWins: true, unit: 'pts', rule: 'Each round pays 10, 8, 6, 5, 4, 3, 2, 1 points by net finish. Ties share.' },
  wolf: {
    teams: false,
    higherWins: true,
    unit: 'pts',
    rule: 'The wolf rotates each hole and picks a partner or goes alone. Best net ball wins the hole: 1 point to each winner; a lone wolf who wins gets 1 per opponent, and each opponent gets 1 if the lone wolf loses.',
  },
  'team-stroke': { teams: true, higherWins: false, unit: 'toPar', rule: 'Every player’s net score to par counts for the team.' },
  'team-stableford': { teams: true, higherWins: true, unit: 'pts', rule: 'Every player’s Stableford points count for the team.' },
  'best-ball': { teams: true, higherWins: false, unit: 'toPar', rule: 'On each hole the team’s best net score counts.' },
  'team-scramble': {
    teams: true,
    higherWins: false,
    unit: 'toPar',
    rule: 'One ball per team. Team handicap: 35/15% of the two players, 25/20/15/10% for four.',
  },
};

export const gameOf = (trip: Trip) => {
  const type = eventOf(trip).type;
  return type in GAME_RULES ? { type: type as Game, ...GAME_RULES[type as Game] } : null;
};
export const isTeamEvent = (trip: Trip) => eventOf(trip).type === 'rydercup' || !!gameOf(trip)?.teams;

// Wolf picks are saved as a score row (anyone can score; no schema change):
// player WOLF_ID, strokes = partner's position in round.playerIds + 1, or LONE.
export const WOLF_ID = '_wolf';
export const LONE = 20;

export function wolfOn(round: Round, holeIndex: number): string | undefined {
  return round.playerIds[holeIndex % round.playerIds.length];
}
export function wolfPick(trip: Trip, round: Round, holeNumber: number): string | 'lone' | undefined {
  const sc = trip.scores.find((x) => x.roundId === round.id && x.playerId === WOLF_ID && x.holeNumber === holeNumber);
  if (!sc) return undefined;
  return sc.strokes === LONE ? 'lone' : round.playerIds[sc.strokes - 1];
}

// One team's players in this round.
const teamIn = (trip: Trip, round: Round, teamId: string) =>
  round.playerIds.filter((id) => trip.players.find((p) => p.id === id)?.teamId === teamId);

export interface GameRow {
  id: string; // player or team id
  name: string;
  value: number | null; // null = nothing scored yet
}

function netOn(trip: Trip, round: Round, player: Player | undefined, holeNumber: number): number | undefined {
  const sc = trip.scores.find((x) => x.roundId === round.id && x.playerId === player?.id && x.holeNumber === holeNumber);
  const hole = courseFor(trip, round).holes.find((h) => h.number === holeNumber);
  if (!sc || !player || !hole) return undefined;
  return sc.strokes - strokesReceivedOnHole(courseHandicap(player.handicapIndex, courseFor(trip, round)), hole.strokeIndex);
}

const MERIT = [10, 8, 6, 5, 4, 3, 2, 1];

// This round's game result per player or team, best first.
export function roundGame(trip: Trip, round: Round): GameRow[] {
  const game = gameOf(trip);
  if (!game) return [];
  const holes = holeNumbersFor(round.holesPlayed);
  const course = courseFor(trip, round);
  const parOf = (n: number) => course.holes.find((h) => h.number === n)?.par ?? 0;
  const board = leaderboard(trip, round);
  let rows: GameRow[];

  if (game.type === 'merit') {
    const started = board.filter((r) => r.thru > 0).sort((a, b) => a.netToPar - b.netToPar);
    rows = board.map((r) => {
      if (r.thru === 0) return { id: r.playerId, name: r.playerName, value: null };
      const first = started.findIndex((x) => x.netToPar === r.netToPar);
      const tied = started.filter((x) => x.netToPar === r.netToPar).length;
      const pts = MERIT.slice(first, first + tied).reduce((a, b) => a + b, 0) / tied;
      return { id: r.playerId, name: r.playerName, value: pts };
    });
  } else if (game.type === 'wolf') {
    const pts = new Map<string, number>(round.playerIds.map((id) => [id, 0]));
    let any = false;
    holes.forEach((n, i) => {
      const wolf = wolfOn(round, i);
      const pick = wolfPick(trip, round, n);
      const nets = round.playerIds.map((id) => netOn(trip, round, trip.players.find((p) => p.id === id), n));
      if (!wolf || !pick || nets.some((x) => x === undefined)) return;
      any = true;
      const side = pick === 'lone' ? [wolf] : [wolf, pick];
      const best = (ids: string[]) => Math.min(...ids.map((id) => nets[round.playerIds.indexOf(id)]!));
      const others = round.playerIds.filter((id) => !side.includes(id));
      const diff = best(side) - best(others);
      if (diff === 0 || !others.length) return;
      const add = (ids: string[], k: number) => ids.forEach((id) => pts.set(id, pts.get(id)! + k));
      if (diff < 0) add(side, pick === 'lone' ? others.length : 1);
      else add(others, 1);
    });
    rows = board.map((r) => ({ id: r.playerId, name: r.playerName, value: any ? pts.get(r.playerId)! : null }));
  } else {
    rows = trip.teams.map((t) => {
      const ids = teamIn(trip, round, t.id);
      const mine = board.filter((r) => ids.includes(r.playerId) && r.thru > 0);
      let value: number | null = null;
      const add = (v: number) => (value = (value ?? 0) + v);
      if (game.type === 'team-stroke') mine.forEach((r) => add(r.netToPar));
      else if (game.type === 'team-stableford') mine.forEach((r) => add(r.points));
      else if (game.type === 'best-ball') {
        for (const n of holes) {
          const nets = ids.map((id) => netOn(trip, round, trip.players.find((p) => p.id === id), n)).filter((x): x is number => x !== undefined);
          if (nets.length) add(Math.min(...nets) - parOf(n));
        }
      } else {
        const ch = sideHandicap(trip, round, ids);
        for (const n of holes) {
          const sc = trip.scores.find((x) => x.roundId === round.id && ids.includes(x.playerId) && x.holeNumber === n);
          const si = course.holes.find((h) => h.number === n)?.strokeIndex ?? 99;
          if (sc) add(sc.strokes - strokesReceivedOnHole(ch, si) - parOf(n));
        }
      }
      return { id: t.id, name: t.name, value };
    });
  }
  return sortRows(rows, game.higherWins);
}

function sortRows<T extends { value: number | null }>(rows: T[], higherWins: boolean): T[] {
  return rows.sort((a, b) => {
    if (a.value === null || b.value === null) return (a.value === null ? 1 : 0) - (b.value === null ? 1 : 0);
    return higherWins ? b.value - a.value : a.value - b.value;
  });
}

export interface GameStanding extends GameRow {
  perRound: (number | null)[];
}

// The event's standings: each round's result added up.
export function gameStandings(trip: Trip): GameStanding[] {
  const game = gameOf(trip);
  if (!game) return [];
  const perRound = trip.rounds.map((r) => new Map(roundGame(trip, r).map((x) => [x.id, x.value])));
  const entities = game.teams ? trip.teams : trip.players;
  const rows = entities.map((e) => {
    const values = perRound.map((m) => m.get(e.id) ?? null);
    const scored = values.filter((v): v is number => v !== null);
    return { id: e.id, name: e.name, perRound: values, value: scored.length ? scored.reduce((a, b) => a + b, 0) : null };
  });
  return sortRows(rows, game.higherWins);
}

export const fmtGame = (v: number | null, unit: 'pts' | 'toPar') =>
  v === null ? '–' : unit === 'pts' ? `${Number.isInteger(v) ? v : v.toFixed(1)}` : v === 0 ? 'E' : v > 0 ? `+${v}` : `−${-v}`;

// ---------- Self-check ----------
function selfCheck() {
  const holes = Array.from({ length: 18 }, (_, i) => ({ number: i + 1, par: 4, strokeIndex: i + 1 }));
  const players = ['a', 'b', 'c', 'd'].map((id, i) => ({ id, name: id.toUpperCase(), handicapIndex: 0, teamId: i < 2 ? 'T1' : 'T2' }));
  const round: Round = {
    id: 'r', name: 'R1', date: '', courseId: 'c', holesPlayed: '18', skinsEnabled: false, skinValue: 0,
    matchEnabled: false, matchStake: 0, playerIds: ['a', 'b', 'c', 'd'],
  };
  const base = (type: EventType, scores: Trip['scores']): Trip => ({
    id: 't', name: 't', createdAt: '', event: { type, skinValue: 0, matchStake: 0 }, players,
    teams: [{ id: 'T1', name: 'One' }, { id: 'T2', name: 'Two' }], courses: [{ id: 'c', name: 'C', holes }], rounds: [round], scores,
  });
  // Hole 1: a 3, b 5, c 4, d 4.
  const h1 = [['a', 3], ['b', 5], ['c', 4], ['d', 4]].map(([p, s]) => ({ roundId: 'r', playerId: p as string, holeNumber: 1, strokes: s as number }));
  const v = (t: Trip) => roundGame(t, round).map((r) => `${r.id}:${r.value}`).join();
  console.assert(v(base('team-stroke', h1)) === 'T1:0,T2:0', 'team stroke: sum of net to par');
  console.assert(v(base('team-stableford', h1)) === 'T1:4,T2:4', 'team stableford: sum of points');
  console.assert(v(base('best-ball', h1)) === 'T1:-1,T2:0', 'best ball: best net per hole');
  console.assert(v(base('team-scramble', [h1[0], { ...h1[0], playerId: 'b' }])) === 'T1:-1,T2:null', 'scramble: one ball per team');
  console.assert(v(base('merit', h1)) === 'a:10,c:7,d:7,b:5', 'merit: places, ties share');
  // Wolf on hole 1 is a; picks b: best 3 v best 4 -> a, b +1. Lone: a 3 beats 4 -> a +3.
  const pick = (k: number) => ({ roundId: 'r', playerId: WOLF_ID, holeNumber: 1, strokes: k });
  console.assert(v(base('wolf', [...h1, pick(2)])).startsWith('a:1,b:1'), 'wolf: partners win a point each');
  console.assert(v(base('wolf', [...h1, pick(LONE)])) === 'a:3,c:0,d:0,b:0', 'wolf: lone wolf wins 1 per opponent');
  console.assert(v(base('wolf', h1)) === 'a:null,c:null,d:null,b:null', 'wolf: no pick, no points');
  console.assert(gameStandings(base('best-ball', h1))[0].id === 'T1', 'standings: lowest to par first');
}
selfCheck();
