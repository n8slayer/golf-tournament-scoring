export interface Player {
  id: string;
  name: string;
  handicapIndex: number;
  teamId?: string;
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

export interface Round {
  id: string;
  name: string;
  date: string; // ISO date
  courseId: string;
  holesPlayed: HolesPlayed;
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

export interface Trip {
  id: string;
  name: string;
  createdAt: string;
  players: Player[];
  teams: Team[]; // 0 or 2 entries
  courses: Course[]; // at least one
  rounds: Round[];
  scores: Score[];
}
