import { supabase } from './supabase';
import { migrateTrip } from './storage';
import { Trip, Score } from '../types/models';

// Server shape: trips.data = the Trip minus id/scores/sync; scores live in their own table.

export function uuid(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c?.randomUUID) return c.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    return (ch === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export const isUuid = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

export function tripData(trip: Trip) {
  const { id: _id, scores: _scores, sync: _sync, ...data } = trip;
  return data;
}

// A network failure (keep queued, retry later) vs a refusal from the server (drop it).
export function isNetworkError(e: unknown): boolean {
  const msg = String((e as { message?: string })?.message ?? e).toLowerCase();
  return /fetch|network|timeout|offline|load failed/.test(msg);
}

function client() {
  if (!supabase) throw new Error('Sharing is not configured');
  return supabase;
}

// PostgREST returns at most 1000 rows per request, so page through scores.
async function allScores(tripIds: string[]) {
  const rows: { trip_id: string; round_id: string; player_id: string; hole_number: number; strokes: number }[] = [];
  for (let from = 0; tripIds.length; from += 1000) {
    const { data, error } = await client()
      .from('scores')
      .select('trip_id, round_id, player_id, hole_number, strokes')
      .in('trip_id', tripIds)
      .order('trip_id')
      .order('round_id')
      .order('player_id')
      .order('hole_number')
      .range(from, from + 999);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return rows;
}

// Every event this device organizes or has joined (RLS decides which).
export async function fetchTrips(userId: string): Promise<Trip[]> {
  const db = client();
  const { data: rows, error } = await db.from('trips').select('id, organizer_id, invite_code, data');
  if (error) throw error;
  const ids = (rows ?? []).map((r) => r.id as string);
  const [scores, members] = await Promise.all([
    allScores(ids),
    db.from('trip_members').select('trip_id, player_id').eq('user_id', userId),
  ]);
  if (members.error) throw members.error;
  return (rows ?? []).map((r) =>
    migrateTrip({
      ...(r.data as Trip),
      id: r.id,
      scores: scores
        .filter((s) => s.trip_id === r.id)
        .map((s) => ({ roundId: s.round_id, playerId: s.player_id, holeNumber: s.hole_number, strokes: s.strokes })),
      sync: {
        inviteCode: r.invite_code,
        organizerId: r.organizer_id,
        myPlayerId: members.data?.find((m) => m.trip_id === r.id)?.player_id ?? undefined,
      },
    })
  );
}

// Organizer only (RLS). Returns the server's invite code / organizer id.
export async function pushTrip(trip: Trip): Promise<{ inviteCode: string; organizerId: string }> {
  const { data, error } = await client()
    .from('trips')
    .upsert({ id: trip.id, data: tripData(trip) })
    .select('invite_code, organizer_id')
    .single();
  if (error) throw error;
  return { inviteCode: data.invite_code, organizerId: data.organizer_id };
}

export async function pushScore(tripId: string, s: Score): Promise<void> {
  const { error } = await client().from('scores').upsert({
    trip_id: tripId,
    round_id: s.roundId,
    player_id: s.playerId,
    hole_number: s.holeNumber,
    strokes: s.strokes,
  });
  if (error) throw error;
}

export async function joinTrip(code: string): Promise<string> {
  const { data, error } = await client().rpc('join_trip', { code });
  if (error) throw error;
  return data as string;
}

export async function claimPlayer(tripId: string, userId: string, playerId: string): Promise<void> {
  const { error } = await client().from('trip_members').update({ player_id: playerId }).eq('trip_id', tripId).eq('user_id', userId);
  if (error) throw error;
}

export async function addSelfAsPlayer(tripId: string, playerId: string, name: string, handicapIndex: number): Promise<void> {
  const { error } = await client().rpc('add_self_as_player', {
    t: tripId,
    player_id: playerId,
    player_name: name,
    handicap_index: handicapIndex,
  });
  if (error) throw error;
}
