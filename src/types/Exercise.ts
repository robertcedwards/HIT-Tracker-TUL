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

// Store EXERCISE_OPTIONS in localStorage
const getStoredExercises = (): string[] => {
  const stored = localStorage.getItem('exerciseOptions');
  return stored ? JSON.parse(stored) : [
    'Chest Press',
    'Shoulder Press',
    'Lat Pull Down',
    'Seated Row',
    'Leg Press',
  ];
};

export let EXERCISE_OPTIONS = getStoredExercises();

export const addExercise = (name: string) => {
  if (!EXERCISE_OPTIONS.includes(name)) {
    EXERCISE_OPTIONS = [...EXERCISE_OPTIONS, name];
    localStorage.setItem('exerciseOptions', JSON.stringify(EXERCISE_OPTIONS));
    return true;
  }
  return false;
};

export const removeExercise = (name: string) => {
  EXERCISE_OPTIONS = EXERCISE_OPTIONS.filter(exercise => exercise !== name);
  localStorage.setItem('exerciseOptions', JSON.stringify(EXERCISE_OPTIONS));
};