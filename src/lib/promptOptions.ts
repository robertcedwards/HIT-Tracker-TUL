import { supabase } from './supabase';

export type SlotKind = 'exercise' | 'supplement' | 'time_window' | 'metric';

export const TIME_WINDOWS = [
  'this week',
  'the last 14 days',
  'the last 30 days',
  'the last quarter',
  'this year',
];

export const METRICS = [
  'heaviest weight',
  'longest time under load',
  'most sessions',
  'highest total volume',
];

export async function loadExerciseOptions(): Promise<string[]> {
  const { data, error } = await supabase
    .from('exercises')
    .select('name')
    .order('name');
  if (error) {
    console.error('Failed to load exercises', error);
    return [];
  }
  return Array.from(new Set((data ?? []).map((r: { name: string }) => r.name).filter(Boolean)));
}

export async function loadSupplementOptions(): Promise<string[]> {
  const { data, error } = await supabase
    .from('user_supplements')
    .select('supplements:supplement_id(name)');
  if (error) {
    console.error('Failed to load supplements', error);
    return [];
  }
  const names = (data ?? [])
    .map((r: { supplements?: { name?: string } | { name?: string }[] | null }) => {
      const s = r.supplements;
      if (Array.isArray(s)) return s[0]?.name;
      return s?.name;
    })
    .filter((n): n is string => typeof n === 'string' && n.length > 0);
  return Array.from(new Set(names)).sort();
}
