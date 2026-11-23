export interface Player {
  id: string;
  name: string;
  handicapIndex: number;
  teamId?: string;
  // Invite email. Kept on this device + in the private player_emails table (editors only),
  // never in the shared event data.
  email?: string;
}

export interface Team {
  id: string;
  name: string;
}

export interface Hole {
  number: number; // 1-18
  par: number;
  strokeIndex: number; // 1-18 difficulty rank, unique per hole
  yardage?: number;
}

export interface Course {
  id: string;
  name: string;
  holes: Hole[]; // length 18
  tee?: string;
  // From the tee's scorecard; when both are set, players get course handicaps.
  slope?: number;
  rating?: number;
}

export type NewCourse = Omit<Course, 'id'>;

export type HolesPlayed = 'front9' | 'back9' | '18';

export type MatchFormat = 'singles' | 'fourball';

// sideA = team A players, sideB = team B players (1 each for singles, 2 for four-ball).
export interface Match {
  id: string;
  sideA: string[];
  sideB: string[];
}

export interface Round {
  id: string;
  name: string;
  date: string; // ISO date
  courseId: string;
  holesPlayed: HolesPlayed;
  format?: MatchFormat; // missing = singles (rounds made before formats existed)
  matches?: Match[]; // missing = automatic draft-order singles
  skinsEnabled: boolean;
  skinValue: number;
  matchEnabled: boolean;
  matchStake: number;
  playerIds: string[];
}

// Raw input only — everything else (net score, match status, skins, settlement) is derived.
export interface Score {
  roundId: string;
  playerId: string;
  holeNumber: number;
  strokes: number;
}

export type EventType = 'rydercup' | 'strokeplay' | 'stableford';

export interface EventSettings {
  type: EventType;
  startDate?: string; // YYYY-MM-DD
  endDate?: string;
  skinValue: number; // defaults for new rounds
  matchStake: number;
}

export interface Trip {
  id: string;
  name: string;
  createdAt: string;
  event?: EventSettings; // missing on trips made before event setup
  // Set once the event is shared (stored in Supabase). Missing = only on this device.
  sync?: { inviteCode: string; organizerId: string; myPlayerId?: string; role?: 'owner' | 'admin' | 'player' };
  players: Player[];
  teams: Team[]; // 0 or 2 entries
  courses: Course[]; // at least one
  rounds: Round[];
  scores: Score[];
}
