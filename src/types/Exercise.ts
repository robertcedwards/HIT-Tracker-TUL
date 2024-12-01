export type Session = {
  weight: number;
  timeUnderLoad: number;
  timestamp: string;
};

export type Exercise = {
  name: string;
  sessions: Session[];
  lastUpdated: string;
};

export const EXERCISE_OPTIONS = [
  'Chest Press',
  'Shoulder Press',
  'Lat Pull Down',
  'Seated Row',
  'Leg Press',
] as const;

export type ExerciseName = typeof EXERCISE_OPTIONS[number];