import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { loadState, saveState } from '../lib/storage';
import { Trip, Player, Round, HolesPlayed, NewCourse } from '../types/models';

function genId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

interface TripsContextValue {
  trips: Trip[];
  loaded: boolean;
  getTrip: (tripId: string) => Trip | undefined;
  addTrip: (name: string, courses: NewCourse[]) => string;
  addPlayer: (tripId: string, name: string, handicapIndex: number) => void;
  updatePlayer: (tripId: string, playerId: string, patch: Partial<Player>) => void;
  removePlayer: (tripId: string, playerId: string) => void;
  ensureTeams: (tripId: string) => void;
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
}

const TripsContext = createContext<TripsContextValue | undefined>(undefined);

export function TripsProvider({ children }: { children: React.ReactNode }) {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loaded, setLoaded] = useState(false);
  const hasLoaded = useRef(false);

  useEffect(() => {
    loadState().then((state) => {
      setTrips(state.trips);
      setLoaded(true);
      hasLoaded.current = true;
    });
  }, []);

  useEffect(() => {
    if (!hasLoaded.current) return; // don't overwrite storage with the initial empty state
    saveState({ trips });
  }, [trips]);

  const getTrip = (tripId: string) => trips.find((t) => t.id === tripId);

  const updateTrip = (tripId: string, updater: (trip: Trip) => Trip) => {
    setTrips((prev) => prev.map((t) => (t.id === tripId ? updater(t) : t)));
  };

  const addTrip = (name: string, courses: NewCourse[]) => {
    const id = genId();
    const trip: Trip = {
      id,
      name,
      createdAt: new Date().toISOString(),
      players: [],
      teams: [],
      courses: courses.map((c) => ({ ...c, id: genId() })),
      rounds: [],
      scores: [],
    };
    setTrips((prev) => [...prev, trip]);
    return id;
  };

  const addPlayer = (tripId: string, name: string, handicapIndex: number) => {
    updateTrip(tripId, (t) => ({
      ...t,
      players: [...t.players, { id: genId(), name, handicapIndex }],
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

  const recordScore = (tripId: string, roundId: string, playerId: string, holeNumber: number, strokes: number) => {
    updateTrip(tripId, (t) => {
      const without = t.scores.filter(
        (s) => !(s.roundId === roundId && s.playerId === playerId && s.holeNumber === holeNumber)
      );
      return { ...t, scores: [...without, { roundId, playerId, holeNumber, strokes }] };
    });
  };

  return (
    <TripsContext.Provider
      value={{
        trips,
        loaded,
        getTrip,
        addTrip,
        addPlayer,
        updatePlayer,
        removePlayer,
        ensureTeams,
        assignPlayerToTeam,
        updateHole,
        addCourse,
        removeCourse,
        createRound,
        recordScore,
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
