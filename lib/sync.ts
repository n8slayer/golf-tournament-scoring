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
  // Player emails never go into the shared event data (see player_emails).
  return { ...data, players: data.players.map(({ email: _email, ...p }) => p) };
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
    db.from('trip_members').select('trip_id, player_id, role').eq('user_id', userId),
  ]);
  if (members.error) throw members.error;
  // Emails come back only for events I edit (RLS) and invites addressed to me.
  const emails = ids.length
    ? await db.from('player_emails').select('trip_id, player_id, email').in('trip_id', ids)
    : { data: [], error: null };
  if (emails.error) throw emails.error;
  const emailOf = (tripId: string, playerId: string) => emails.data?.find((e) => e.trip_id === tripId && e.player_id === playerId)?.email;
  return (rows ?? []).map((r) =>
    migrateTrip({
      ...(r.data as Trip),
      players: ((r.data as Trip).players ?? []).map((p) => {
        const email = emailOf(r.id, p.id);
        return email ? { ...p, email } : p;
      }),
      id: r.id,
      scores: scores
        .filter((s) => s.trip_id === r.id)
        .map((s) => ({ roundId: s.round_id, playerId: s.player_id, holeNumber: s.hole_number, strokes: s.strokes })),
      sync: (() => {
        const me = members.data?.find((m) => m.trip_id === r.id);
        return {
          inviteCode: r.invite_code,
          organizerId: r.organizer_id,
          myPlayerId: me?.player_id ?? undefined,
          role: r.organizer_id === userId ? 'owner' : me?.role === 'admin' ? 'admin' : 'player',
        } as const;
      })(),
    }),
  );
}

// New events are created (you become organizer); existing ones are updated, which RLS
// allows for the organizer and co-organizers. Returns the server's invite code / organizer id.
export async function pushTrip(trip: Trip): Promise<{ inviteCode: string; organizerId: string }> {
  const q = trip.sync
    ? client()
        .from('trips')
        .update({ data: tripData(trip) })
        .eq('id', trip.id)
    : client()
        .from('trips')
        .insert({ id: trip.id, data: tripData(trip) });
  const { data, error } = await q.select('invite_code, organizer_id').single();
  if (error) throw error;
  return { inviteCode: data.invite_code, organizerId: data.organizer_id };
}

// Editors: make the player_emails table match the players' emails on this device.
export async function pushPlayerEmails(trip: Trip): Promise<void> {
  const db = client();
  const withEmail = trip.players.filter((p) => p.email?.trim());
  if (withEmail.length) {
    const { error } = await db
      .from('player_emails')
      .upsert(withEmail.map((p) => ({ trip_id: trip.id, player_id: p.id, email: p.email!.trim().toLowerCase() })));
    if (error) throw error;
  }
  const keep = withEmail.map((p) => p.id);
  let del = db.from('player_emails').delete().eq('trip_id', trip.id);
  if (keep.length) del = del.not('player_id', 'in', `(${keep.map((k) => `"${k}"`).join(',')})`);
  const { error } = await del;
  if (error) throw error;
}

// Join every event whose organizer invited my email, linked to my player.
export async function acceptInvites(): Promise<void> {
  const { error } = await client().rpc('accept_invites');
  if (error) throw error;
}

export interface PlayerSlot {
  player_id: string;
  claimed: boolean;
  claimed_by: string | null;
  reserved: boolean;
  reserved_for_me: boolean;
  masked_email: string | null;
}

export async function playerSlots(tripId: string): Promise<PlayerSlot[]> {
  const { data, error } = await client().rpc('player_slots', { t: tripId });
  if (error) throw error;
  return (data ?? []) as PlayerSlot[];
}

export async function unlinkMember(tripId: string, userId: string): Promise<void> {
  const { error } = await client().rpc('unlink_member', { t: tripId, member: userId });
  if (error) throw error;
}

export interface Member {
  user_id: string;
  role: 'owner' | 'admin' | 'player';
  player_id: string | null;
  display_name: string | null;
}

export async function listMembers(tripId: string): Promise<Member[]> {
  const { data, error } = await client().rpc('list_members', { t: tripId });
  if (error) throw error;
  return (data ?? []) as Member[];
}

export async function setMemberRole(tripId: string, userId: string, role: 'admin' | 'player'): Promise<void> {
  const { error } = await client().rpc('set_member_role', { t: tripId, member: userId, new_role: role });
  if (error) throw error;
}

// Organizer only: switch the event to a new short code (old links stop working).
export async function regenerateCode(tripId: string): Promise<string> {
  const { data, error } = await client().rpc('regenerate_code', { t: tripId });
  if (error) throw error;
  return data as string;
}

export async function removeMember(tripId: string, userId: string): Promise<void> {
  const { error } = await client().rpc('remove_member', { t: tripId, member: userId });
  if (error) throw error;
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

// Demo Ryder Cup event anyone can join to look around.
export const DEMO_CODE = 'ad4b50adff';
