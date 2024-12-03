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

export let EXERCISE_OPTIONS = [
  'Chest Press',
  'Shoulder Press',
  'Lat Pull Down',
  'Seated Row',
  'Leg Press',
];

export type ExerciseName = typeof EXERCISE_OPTIONS[number];

export const addExercise = (name: string) => {
  if (!EXERCISE_OPTIONS.includes(name)) {
    EXERCISE_OPTIONS.push(name);
  }
};

export const removeExercise = (name: string) => {
  EXERCISE_OPTIONS = EXERCISE_OPTIONS.filter(exercise => exercise !== name);
};