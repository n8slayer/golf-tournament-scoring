import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { loadState, saveState, migrateTrip } from '../lib/storage';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import {
  fetchTrips,
  pushTrip,
  pushPlayerEmails,
  acceptInvites,
  pushScore,
  joinTrip,
  claimPlayer,
  addSelfAsPlayer,
  uuid,
  isUuid,
  isNetworkError,
} from '../lib/sync';
import { Trip, Player, Round, HolesPlayed, NewCourse, EventSettings, Score } from '../types/models';

// Everything the setup page collects. team: 0 / 1 = first / second team, undefined = draft later.
export interface TripSetup {
  name: string;
  courses: NewCourse[];
  event: EventSettings;
  players: { name: string; handicapIndex: number; email?: string; team?: 0 | 1 }[];
  teamNames?: [string, string];
}

function genId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// Writes waiting for the server (kept across restarts for bad signal on the course).
const PENDING_KEY = 'golf-trip-app:pending:v1';
type Op = { k: 'trip'; tripId: string } | { k: 'score'; tripId: string; score: Score };
const sameScore = (a: Score, b: Score) =>
  a.roundId === b.roundId && a.playerId === b.playerId && a.holeNumber === b.holeNumber;

interface TripsContextValue {
  trips: Trip[];
  loaded: boolean;
  synced: boolean; // first server load finished (or not sharing / failed)
  sharing: boolean; // Supabase configured
  userId: string | null;
  offline: boolean;
  pending: number;
  getTrip: (tripId: string) => Trip | undefined;
  canEdit: (trip: Trip) => boolean; // organizer or co-organizer
  isOwner: (trip: Trip) => boolean; // the organizer
  addTrip: (setup: TripSetup) => string;
  addPlayer: (tripId: string, name: string, handicapIndex: number, email?: string) => void;
  updatePlayer: (tripId: string, playerId: string, patch: Partial<Player>) => void;
  removePlayer: (tripId: string, playerId: string) => void;
  ensureTeams: (tripId: string) => void;
  renameTeam: (tripId: string, teamId: string, name: string) => void;
  assignPlayerToTeam: (tripId: string, playerId: string, teamId: string) => void;
  updateHole: (
    tripId: string,
    courseId: string,
    holeNumber: number,
    patch: { par?: number; strokeIndex?: number }
  ) => void;
  addCourse: (tripId: string, course: NewCourse) => string;
  removeCourse: (tripId: string, courseId: string) => void;
  createRound: (tripId: string, round: Omit<Round, 'id'>) => string;
  recordScore: (tripId: string, roundId: string, playerId: string, holeNumber: number, strokes: number) => void;
  joinEvent: (code: string) => Promise<string>;
  claimMyPlayer: (tripId: string, playerId: string) => Promise<void>;
  addMyself: (tripId: string, name: string, handicapIndex: number) => Promise<void>;
  refresh: () => Promise<void>;
}

const TripsContext = createContext<TripsContextValue | undefined>(undefined);

export function TripsProvider({ children }: { children: React.ReactNode }) {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [synced, setSynced] = useState(!supabase);
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [offline, setOffline] = useState(false);
  const [pending, setPending] = useState(0);
  const hasLoaded = useRef(false);
  const tripsRef = useRef<Trip[]>([]);
  const userIdRef = useRef<string | null>(null);
  const queue = useRef<Op[]>([]);
  const flushing = useRef(false);
  const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Single place that changes trips, so the ref is always current for async sync code.
  const commit = (fn: (prev: Trip[]) => Trip[]) => {
    const next = fn(tripsRef.current);
    tripsRef.current = next;
    setTrips(next);
  };

  const isOwner = (trip: Trip) => !trip.sync || trip.sync.organizerId === userIdRef.current;
  const canEdit = (trip: Trip) => isOwner(trip) || trip.sync?.role === 'admin';

  const persistQueue = () => {
    setPending(queue.current.length);
    AsyncStorage.setItem(PENDING_KEY, JSON.stringify(queue.current)).catch(() => {});
  };

  const flush = async () => {
    if (!supabase || !userIdRef.current || flushing.current) return;
    flushing.current = true;
    try {
      while (queue.current.length) {
        const op = queue.current[0];
        try {
          if (op.k === 'trip') {
            const trip = tripsRef.current.find((t) => t.id === op.tripId);
            if (trip && canEdit(trip)) {
              const res = await pushTrip(trip);
              if (!trip.sync) commit((prev) => prev.map((t) => (t.id === trip.id ? { ...t, sync: res } : t)));
              await pushPlayerEmails(trip);
            }
          } else {
            await pushScore(op.tripId, op.score);
          }
          setOffline(false);
        } catch (e) {
          if (isNetworkError(e)) {
            setOffline(true);
            break; // keep it queued, in order; retried on next change / app focus
          }
          console.warn('Sync refused, dropping change:', (e as Error)?.message ?? e);
        }
        queue.current.shift();
        persistQueue();
      }
    } finally {
      flushing.current = false;
    }
  };

  const enqueue = (op: Op) => {
    if (!supabase) return;
    if (op.k === 'trip') {
      // One pending trip push is enough: it sends the latest version when it runs.
      if (!queue.current.some((o) => o.k === 'trip' && o.tripId === op.tripId)) queue.current.push(op);
    } else {
      const i = queue.current.findIndex((o) => o.k === 'score' && o.tripId === op.tripId && sameScore(o.score, op.score));
      if (i >= 0) queue.current[i] = op;
      else queue.current.push(op);
    }
    persistQueue();
    if (flushTimer.current) clearTimeout(flushTimer.current);
    flushTimer.current = setTimeout(flush, 400);
  };

  // Server copy wins, except changes from this device that haven't been sent yet.
  const mergeRemote = (remote: Trip[]) => {
    commit((prev) => {
      const merged = remote.map((r) => {
        const local = prev.find((t) => t.id === r.id);
        const tripPending = queue.current.some((o) => o.k === 'trip' && o.tripId === r.id);
        const base = tripPending && local ? { ...local, sync: { ...r.sync!, ...local.sync } } : r;
        let scores = tripPending && local ? [...local.scores] : [...r.scores];
        if (tripPending && local) for (const s of r.scores) if (!scores.some((x) => sameScore(x, s))) scores.push(s);
        for (const o of queue.current)
          if (o.k === 'score' && o.tripId === r.id) scores = [...scores.filter((x) => !sameScore(x, o.score)), o.score];
        return { ...base, scores };
      });
      // Keep trips that only exist here (not uploaded yet); drop shared ones the server no longer gives us.
      const localOnly = prev.filter((t) => !t.sync && !remote.some((r) => r.id === t.id));
      return [...merged, ...localOnly];
    });
  };

  const refresh = async () => {
    const uid = userIdRef.current;
    if (!supabase || !uid) return;
    try {
      await flush();
      await acceptInvites().catch((e) => console.warn('Invites:', (e as Error)?.message ?? e));
      mergeRemote(await fetchTrips(uid));
      setOffline(false);
    } catch (e) {
      if (isNetworkError(e)) setOffline(true);
      else console.warn('Refresh failed:', (e as Error)?.message ?? JSON.stringify(e));
    } finally {
      setSynced(true);
    }
  };

  useEffect(() => {
    (async () => {
      const state = await loadState();
      try {
        queue.current = JSON.parse((await AsyncStorage.getItem(PENDING_KEY)) ?? '[]');
      } catch {
        queue.current = [];
      }
      commit(() => state.trips);
      setPending(queue.current.length);
      setLoaded(true);
      hasLoaded.current = true;
    })();
  }, []);

  // Signed in (or switched account): upload trips that only exist here, then load ours.
  // Signed out: forget this account's events on the device (shared phones).
  const prevUser = useRef<string | null>(null);
  useEffect(() => {
    if (!loaded || !supabase) return;
    userIdRef.current = userId;
    if (!userId) {
      if (prevUser.current) {
        queue.current = [];
        persistQueue();
        commit(() => []);
      }
      prevUser.current = null;
      return;
    }
    prevUser.current = userId;
    const unsynced = tripsRef.current.filter((t) => !t.sync);
    if (unsynced.length) {
      const renamed = new Map(unsynced.filter((t) => !isUuid(t.id)).map((t) => [t.id, uuid()]));
      commit((prev) => prev.map((t) => (renamed.has(t.id) ? { ...t, id: renamed.get(t.id)! } : t)));
      for (const t of unsynced) {
        const id = renamed.get(t.id) ?? t.id;
        enqueue({ k: 'trip', tripId: id });
        for (const score of t.scores) enqueue({ k: 'score', tripId: id, score });
      }
    }
    refresh();
  }, [userId, loaded]);

  // Live updates from other phones. Our own echoes are skipped (we already have them).
  useEffect(() => {
    const db = supabase;
    if (!db || !userId) return;
    const channel = db
      .channel('golf-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'scores' }, (payload) => {
        const row = payload.new as { trip_id?: string; round_id: string; player_id: string; hole_number: number; strokes: number; updated_by?: string };
        if (!row?.trip_id || row.updated_by === userIdRef.current) return;
        const score = { roundId: row.round_id, playerId: row.player_id, holeNumber: row.hole_number, strokes: row.strokes };
        commit((prev) =>
          prev.map((t) => (t.id === row.trip_id ? { ...t, scores: [...t.scores.filter((s) => !sameScore(s, score)), score] } : t))
        );
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'trips' }, (payload) => {
        const row = payload.new as { id: string; updated_by?: string; data: Trip };
        if (row.updated_by === userIdRef.current) return; // our own save echoing back
        // trips.data never carries emails: keep the ones this device already has, or the next
        // save would wipe the invite emails.
        commit((prev) =>
          prev.map((t) => {
            if (t.id !== row.id) return t;
            const emailOf = new Map(t.players.filter((p) => p.email).map((p) => [p.id, p.email]));
            const next = migrateTrip({ ...row.data, id: t.id, scores: t.scores, sync: t.sync });
            return { ...next, players: next.players.map((p) => (emailOf.has(p.id) ? { ...p, email: emailOf.get(p.id) } : p)) };
          })
        );
      })
      // Someone was made co-organizer / removed: reload roles.
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trip_members' }, () => refresh())
      .subscribe();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') refresh();
    });
    // Browsers tell us when signal comes back: send what was queued offline.
    const onOnline = () => refresh();
    const win = typeof window !== 'undefined' && typeof window.addEventListener === 'function' ? window : null;
    win?.addEventListener('online', onOnline);
    return () => {
      db.removeChannel(channel);
      sub.remove();
      win?.removeEventListener('online', onOnline);
    };
  }, [userId]);

  useEffect(() => {
    if (!hasLoaded.current) return; // don't overwrite storage with the initial empty state
    saveState({ trips });
  }, [trips]);

  const getTrip = (tripId: string) => trips.find((t) => t.id === tripId);

  // Settings changes: organizer and co-organizers (the server enforces this too).
  const updateTrip = (tripId: string, updater: (trip: Trip) => Trip) => {
    const trip = tripsRef.current.find((t) => t.id === tripId);
    if (!trip || !canEdit(trip)) return;
    commit((prev) => prev.map((t) => (t.id === tripId ? updater(t) : t)));
    enqueue({ k: 'trip', tripId });
  };

  const addTrip = ({ name, courses, event, players, teamNames }: TripSetup) => {
    const id = supabase ? uuid() : genId();
    const teams = teamNames ? teamNames.map((n) => ({ id: genId(), name: n })) : [];
    const trip: Trip = {
      id,
      name,
      createdAt: new Date().toISOString(),
      event,
      players: players.map((p) => ({
        id: genId(),
        name: p.name,
        handicapIndex: p.handicapIndex,
        ...(p.email?.trim() ? { email: p.email.trim().toLowerCase() } : {}),
        ...(p.team !== undefined && teams[p.team] ? { teamId: teams[p.team].id } : {}),
      })),
      teams,
      courses: courses.map((c) => ({ ...c, id: genId() })),
      rounds: [],
      scores: [],
    };
    commit((prev) => [...prev, trip]);
    enqueue({ k: 'trip', tripId: id });
    return id;
  };

  const addPlayer = (tripId: string, name: string, handicapIndex: number, email?: string) => {
    updateTrip(tripId, (t) => ({
      ...t,
      players: [...t.players, { id: genId(), name, handicapIndex, ...(email?.trim() ? { email: email.trim().toLowerCase() } : {}) }],
    }));
  };

  const updatePlayer = (tripId: string, playerId: string, patch: Partial<Player>) => {
    updateTrip(tripId, (t) => ({
      ...t,
      players: t.players.map((p) => (p.id === playerId ? { ...p, ...patch } : p)),
    }));
  };

  const removePlayer = (tripId: string, playerId: string) => {
    updateTrip(tripId, (t) => ({ ...t, players: t.players.filter((p) => p.id !== playerId) }));
  };

  const ensureTeams = (tripId: string) => {
    updateTrip(tripId, (t) =>
      t.teams.length === 2
        ? t
        : { ...t, teams: [{ id: genId(), name: 'Team A' }, { id: genId(), name: 'Team B' }] }
    );
  };

  const renameTeam = (tripId: string, teamId: string, name: string) => {
    updateTrip(tripId, (t) => ({ ...t, teams: t.teams.map((tm) => (tm.id === teamId ? { ...tm, name } : tm)) }));
  };

  // Moves the player to the end of the roster so each team's filtered order
  // reflects draft-assignment order (used as the singles match "slot index").
  const assignPlayerToTeam = (tripId: string, playerId: string, teamId: string) => {
    updateTrip(tripId, (t) => {
      const player = t.players.find((p) => p.id === playerId);
      if (!player) return t;
      const rest = t.players.filter((p) => p.id !== playerId);
      return { ...t, players: [...rest, { ...player, teamId }] };
    });
  };

  const updateHole = (
    tripId: string,
    courseId: string,
    holeNumber: number,
    patch: { par?: number; strokeIndex?: number }
  ) => {
    updateTrip(tripId, (t) => ({
      ...t,
      courses: t.courses.map((c) =>
        c.id === courseId ? { ...c, holes: c.holes.map((h) => (h.number === holeNumber ? { ...h, ...patch } : h)) } : c
      ),
    }));
  };

  const addCourse = (tripId: string, course: NewCourse) => {
    const id = genId();
    updateTrip(tripId, (t) => ({ ...t, courses: [...t.courses, { ...course, id }] }));
    return id;
  };

  // Courses with rounds on them are kept so those rounds still score.
  const removeCourse = (tripId: string, courseId: string) => {
    updateTrip(tripId, (t) =>
      t.rounds.some((r) => r.courseId === courseId) || t.courses.length <= 1
        ? t
        : { ...t, courses: t.courses.filter((c) => c.id !== courseId) }
    );
  };

  const createRound = (tripId: string, round: Omit<Round, 'id'>) => {
    const id = genId();
    updateTrip(tripId, (t) => ({ ...t, rounds: [...t.rounds, { ...round, id }] }));
    return id;
  };

  // Anyone in the event can score.
  const recordScore = (tripId: string, roundId: string, playerId: string, holeNumber: number, strokes: number) => {
    const score = { roundId, playerId, holeNumber, strokes };
    commit((prev) =>
      prev.map((t) => (t.id === tripId ? { ...t, scores: [...t.scores.filter((s) => !sameScore(s, score)), score] } : t))
    );
    enqueue({ k: 'score', tripId, score });
  };

  const joinEvent = async (code: string) => {
    if (!userIdRef.current) throw new Error('Sign in with your email first');
    const id = await joinTrip(code);
    await refresh();
    return id;
  };

  const claimMyPlayer = async (tripId: string, playerId: string) => {
    if (!userIdRef.current) throw new Error('Not signed in');
    await claimPlayer(tripId, userIdRef.current, playerId);
    commit((prev) => prev.map((t) => (t.id === tripId && t.sync ? { ...t, sync: { ...t.sync, myPlayerId: playerId } } : t)));
  };

  const addMyself = async (tripId: string, name: string, handicapIndex: number) => {
    await addSelfAsPlayer(tripId, genId(), name, handicapIndex);
    await refresh();
  };

  return (
    <TripsContext.Provider
      value={{
        trips,
        loaded,
        synced,
        sharing: !!supabase,
        userId,
        offline,
        pending,
        getTrip,
        canEdit,
        isOwner,
        addTrip,
        addPlayer,
        updatePlayer,
        removePlayer,
        ensureTeams,
        renameTeam,
        assignPlayerToTeam,
        updateHole,
        addCourse,
        removeCourse,
        createRound,
        recordScore,
        joinEvent,
        claimMyPlayer,
        addMyself,
        refresh,
      }}
    >
      {children}
    </TripsContext.Provider>
  );
}

export function useTrips() {
  const ctx = useContext(TripsContext);
  if (!ctx) throw new Error('useTrips must be used within a TripsProvider');
  return ctx;
}

export type { HolesPlayed };
