import { supabase } from './supabase';
import { Exercise, Session, DEFAULT_EXERCISES } from '../types/Exercise';

export async function getExercises(userId: string, shouldInitialize = false): Promise<Exercise[]> {
  if (shouldInitialize) {
    await initializeDefaultExercises(userId);
  }

  const { data: exercises, error } = await supabase
    .from('exercises')
    .select(`
      id,
      name,
      last_updated,
      sessions (
        id,
        weight,
        time_under_load,
        timestamp
      )
    `)
    .eq('user_id', userId)
    .order('name');

  if (error) throw error;

  return exercises.map(exercise => ({
    id: exercise.id,
    name: exercise.name,
    sessions: exercise.sessions.map(session => ({
      id: session.id,
      weight: session.weight,
      timeUnderLoad: session.time_under_load,
      timestamp: session.timestamp,
      exercise_id: exercise.id
    })),
    lastUpdated: exercise.last_updated,
    user_id: userId
  }));
}

export async function initializeDefaultExercises(userId: string) {
  // First, get all exercises in a transaction
  const { data: existing, error } = await supabase
    .from('exercises')
    .select('*')
    .eq('user_id', userId);

  if (error) throw error;

  // If user already has exercises, don't initialize
  if (existing && existing.length > 0) {
    return;
  }

  // If no exercises exist, add all default exercises at once
  const exercisesToAdd = DEFAULT_EXERCISES.map(name => ({
    name,
    user_id: userId,
    last_updated: new Date().toISOString()
  }));

  const { error: insertError } = await supabase
    .from('exercises')
    .insert(exercisesToAdd);

  if (insertError) throw insertError;
}

export async function saveSession(exerciseId: string, session: Omit<Session, 'id' | 'exercise_id'>) {
  const { data, error } = await supabase
    .from('sessions')
    .insert({
      exercise_id: exerciseId,
      weight: session.weight,
      time_under_load: session.timeUnderLoad,
      timestamp: session.timestamp
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteExercise(exerciseId: string, userId: string) {
  const { error } = await supabase
    .from('exercises')
    .delete()
    .eq('id', exerciseId)
    .eq('user_id', userId);

  if (error) throw error;
}

export async function addNewExercise(name: string, userId: string): Promise<Exercise> {
  const { data, error } = await supabase
    .from('exercises')
    .insert({
      name,
      user_id: userId,
      last_updated: new Date().toISOString()
    })
    .select()
    .single();

  if (error) throw error;
  return {
    id: data.id,
    name: data.name,
    sessions: [],
    lastUpdated: data.last_updated,
    user_id: userId
  };
} 