export type Session = {
  id?: string;
  weight: number;
  timeUnderLoad: number;
  timestamp: string;
  exercise_id?: string;
  exerciseName?: string; // For display in recent sessions table
};

export type Exercise = {
  id?: string;
  name: string;
  sessions: Session[];
  lastUpdated: string;
  user_id?: string;
};

export const DEFAULT_EXERCISES = [
  'Chest Press',
  'Shoulder Press',
  'Lat Pull Down',
  'Seated Row',
  'Leg Press'
].sort();