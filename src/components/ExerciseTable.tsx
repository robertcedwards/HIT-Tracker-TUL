import { useState, useEffect, useRef } from 'react';
import { Exercise, Session } from '../types/Exercise';
import { AllSessionsGraph } from './AllSessionsGraph';
import { Play, Square, Volume2, VolumeX, Trash2, Plus } from 'lucide-react';
import { ConfirmationModal } from './ConfirmationModal';
import { addNewExercise, deleteExercise } from '../lib/database';
import { supabase } from '../lib/supabase';
import { useWeightUnit } from '../contexts/WeightUnitContext';
import { trackEvent } from '../lib/analytics';

interface ExerciseTableProps {
  exercises: Exercise[];
  onSaveExercise: (exercise: Exercise) => void;
}

interface TimerState {
  isRunning: boolean;
  time: number;
  exerciseName: string | null;
}

interface TimerSettings {
  soundEnabled: boolean;
  countdownTime: number;
}

export function ExerciseTable({ exercises, onSaveExercise }: ExerciseTableProps) {
  const { weightUnit, toggleWeightUnit, convertWeight, formatWeight } = useWeightUnit();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  
  const [timerState, setTimerState] = useState<TimerState>({
    isRunning: false,
    time: 0,
    exerciseName: null
  });

  const [timerSettings, setTimerSettings] = useState<TimerSettings>(() => {
    const saved = localStorage.getItem('timerSettings');
    return saved ? JSON.parse(saved) : {
      soundEnabled: true,
      countdownTime: 10
    };
  });

  const [localExercises, setLocalExercises] = useState<Exercise[]>(exercises);

  const [weights, setWeights] = useState<Record<string, number>>(() => {
    const initialWeights: Record<string, number> = {};
    exercises.forEach(exercise => {
      const lastSession = exercise.sessions[exercise.sessions.length - 1];
      initialWeights[exercise.name] = lastSession?.weight || 0;
    });
    return initialWeights;
  });

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [exerciseToDelete, setExerciseToDelete] = useState<string | null>(null);
  const [newExerciseName, setNewExerciseName] = useState('');

  // Initialize audio element with correct path
  useEffect(() => {
    audioRef.current = new Audio('timer-beep.mp3');
    audioRef.current.load(); // Preload the audio
  }, []);

  useEffect(() => {
    setLocalExercises(exercises);
    // Update weights when exercises change
    const newWeights: Record<string, number> = {};
    exercises.forEach(exercise => {
      const lastSession = exercise.sessions[exercise.sessions.length - 1];
      newWeights[exercise.name] = lastSession?.weight || 0;
    });
    setWeights(newWeights);
  }, [exercises]);

  useEffect(() => {
    let interval: number | undefined;
    
    if (timerState.isRunning) {
      interval = window.setInterval(() => {
        setTimerState(prev => {
          const newTime = prev.time + 1;
          
          // Handle sound for countdown
          if (timerSettings.soundEnabled && prev.exerciseName && audioRef.current) {
            const exercise = localExercises.find(e => e.name === prev.exerciseName);
            const lastSession = exercise?.sessions[exercise.sessions.length - 1];
            const previousTime = lastSession?.timeUnderLoad || 0;
            
            const timeUntilPrevious = previousTime - newTime;
            if (timeUntilPrevious > 0 && timeUntilPrevious <= timerSettings.countdownTime) {
              try {
                // Clone and play the audio to allow overlapping sounds
                const audioClone = audioRef.current.cloneNode() as HTMLAudioElement;
                audioClone.play().catch(e => console.warn('Audio play failed:', e));
              } catch (error) {
                console.warn('Audio playback error:', error);
              }
            }
          }
          
          return {
            ...prev,
            time: newTime
          };
        });
      }, 1000);
    }

    return () => {
      if (interval) {
        window.clearInterval(interval);
      }
    };
  }, [timerState.isRunning, timerSettings, localExercises]);

  const handleStartTimer = (exerciseName: string) => {
    if (timerState.isRunning && timerState.exerciseName === exerciseName) {
      trackEvent('stop_timer', {
        exercise: exerciseName,
        duration: timerState.time
      });
      const exercise = localExercises.find(e => e.name === exerciseName);
      if (!exercise) return;

      const newSession: Session = {
        weight: weights[exerciseName],
        timeUnderLoad: timerState.time,
        timestamp: new Date().toISOString()
      };

      const updatedExercise: Exercise = {
        ...exercise,
        sessions: [...exercise.sessions, newSession],
        lastUpdated: new Date().toISOString()
      };

      setLocalExercises(prev => 
        prev.map(ex => ex.name === exerciseName ? updatedExercise : ex)
      );

      onSaveExercise(updatedExercise);

      setTimerState({
        isRunning: false,
        time: 0,
        exerciseName: null
      });
    } else {
      trackEvent('start_timer', { exercise: exerciseName });
      setTimerState({
        isRunning: true,
        time: 0,
        exerciseName
      });
    }
  };

  const handleWeightChange = (exerciseName: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === '') {
      trackEvent('clear_weight', { exercise: exerciseName });
      setWeights(prev => {
        const newWeights = { ...prev };
        delete newWeights[exerciseName];
        return newWeights;
      });
    } else {
      const numValue = Number(value);
      if (!isNaN(numValue)) {
        trackEvent('change_weight', {
          exercise: exerciseName,
          value: numValue,
          unit: weightUnit
        });
        // Convert input value from displayed unit to lbs for storage
        const weightInLbs = weightUnit === 'kg' ? Math.round(numValue * 2.205) : numValue;
        setWeights(prev => ({
          ...prev,
          [exerciseName]: weightInLbs
        }));
      }
    }
  };

  const updateTimerSettings = (updates: Partial<TimerSettings>) => {
    const newSettings = { ...timerSettings, ...updates };
    setTimerSettings(newSettings);
    localStorage.setItem('timerSettings', JSON.stringify(newSettings));
  };

  const allSessions = localExercises.flatMap(exercise => 
    exercise.sessions.map(session => ({
      ...session,
      exerciseName: exercise.name
    }))
  );

  // Test sound function with proper error handling
  const testSound = () => {
    if (audioRef.current && timerSettings.soundEnabled) {
      try {
        const audioClone = audioRef.current.cloneNode() as HTMLAudioElement;
        audioClone.play().catch(e => console.warn('Audio play failed:', e));
      } catch (error) {
        console.warn('Audio test playback error:', error);
      }
    }
  };

  const handleDeleteExercise = (exercise: Exercise) => {
    if (!exercise.id) return;
    trackEvent('delete_exercise', { name: exercise.name });
    setExerciseToDelete(exercise.id);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (exerciseToDelete) {
      const exercise = localExercises.find(ex => ex.id === exerciseToDelete);
      if (!exercise?.id) return;

      try {
        const user = (await supabase.auth.getUser()).data.user;
        if (!user) return;

        await deleteExercise(exercise.id, user.id);
        setLocalExercises(prev => prev.filter(ex => ex.id !== exerciseToDelete));
        setShowDeleteModal(false);
        setExerciseToDelete(null);
        
        // Trigger parent refresh
        const updatedExercise = { ...exercise };
        onSaveExercise(updatedExercise);
      } catch (error) {
        console.error('Error deleting exercise:', error);
      }
    }
  };

  const handleAddExercise = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newExerciseName.trim()) {
      trackEvent('add_exercise', { name: newExerciseName.trim() });
      try {
        const user = (await supabase.auth.getUser()).data.user;
        if (!user) return;

        const newExercise = await addNewExercise(newExerciseName.trim(), user.id);
        setLocalExercises(prev => [...prev, newExercise]);
        onSaveExercise(newExercise);
        setNewExerciseName('');
      } catch (error) {
        console.error('Error adding exercise:', error);
      }
    }
  };

  const handleWeightUnitToggle = () => {
    trackEvent('toggle_weight_unit', {
      from: weightUnit,
      to: weightUnit === 'lbs' ? 'kg' : 'lbs'
    });
    toggleWeightUnit();
  };

  return (
    <div>
      <div className="overflow-x-auto mb-8">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50">
              <th className="px-4 py-2 text-left">Exercise</th>
              <th className="px-4 py-2 text-left">
                <button 
                  onClick={handleWeightUnitToggle}
                  className="hover:bg-gray-100 px-1 py-0.5 rounded"
                  title="Click to toggle units"
                >
                  Weight ({weightUnit})
                </button>
              </th>
              <th className="px-4 py-2 text-left">
                <div className="flex items-center gap-4">
                  Timer
                  <div className="flex items-center gap-2 text-gray-600">
                    <button
                      onClick={() => {
                        const newState = !timerSettings.soundEnabled;
                        trackEvent('toggle_sound', { enabled: newState });
                        updateTimerSettings({ soundEnabled: newState });
                        if (!timerSettings.soundEnabled) {
                          setTimeout(testSound, 100);
                        }
                      }}
                      className="p-1 hover:bg-gray-200 rounded"
                      title={timerSettings.soundEnabled ? "Sound enabled" : "Sound disabled"}
                    >
                      {timerSettings.soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
                    </button>
                    <select
                      value={timerSettings.countdownTime}
                      onChange={(e) => updateTimerSettings({ countdownTime: Number(e.target.value) })}
                      className="text-sm border rounded p-1"
                      title="Countdown time"
                    >
                      {[5, 10, 15, 20, 30].map(time => (
                        <option key={time} value={time}>{time}s countdown</option>
                      ))}
                    </select>
                  </div>
                </div>
              </th>
              <th className="px-4 py-2 text-left">Last Session</th>
              <th className="px-4 py-2 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {localExercises.map((exercise) => {
              const lastSession = exercise.sessions[exercise.sessions.length - 1];
              const isTimerActive = timerState.exerciseName === exercise.name;

              return (
                <tr key={exercise.name} className="border-t">
                  <td className="px-4 py-2 font-medium">{exercise.name}</td>
                  <td className="px-4 py-2">
                    <input
                      type="number"
                      value={convertWeight(weights[exercise.name] || 0)}
                      onChange={(e) => handleWeightChange(exercise.name, e)}
                      className="w-24 p-1 border rounded"
                      min="0"
                      step="1"
                    />
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-4">
                      <button
                        onClick={() => handleStartTimer(exercise.name)}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg focus:ring-2 focus:outline-none ${
                          isTimerActive
                            ? 'bg-red-600 hover:bg-red-700 text-white focus:ring-red-500'
                            : 'bg-blue-700 hover:bg-blue-800 text-white focus:ring-blue-500'
                        }`}
                      >
                        {isTimerActive ? <Square size={16} /> : <Play size={16} />}
                        {isTimerActive ? `Stop (${timerState.time}s)` : 'Start'}
                      </button>
                      {isTimerActive && lastSession && (
                        <span className="text-sm text-gray-700">
                          {lastSession.timeUnderLoad - timerState.time > 0 && 
                           lastSession.timeUnderLoad - timerState.time <= timerSettings.countdownTime && 
                            `${lastSession.timeUnderLoad - timerState.time}s to go`
                          }
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-2 text-gray-500">
                    {lastSession ? (
                      <>
                        {formatWeight(lastSession.weight)} × {lastSession.timeUnderLoad}s
                      </>
                    ) : (
                      'No sessions yet'
                    )}
                  </td>
                  <td className="px-4 py-2">
                    <button
                      onClick={() => exercise.id && handleDeleteExercise(exercise)}
                      className="text-red-500 hover:text-red-700"
                      title="Delete exercise"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      

      <div className="mb-8 border-t pt-8">
        <h2 className="text-lg font-semibold mb-4">Add New Exercise</h2>
        <form onSubmit={handleAddExercise} className="flex gap-2">
          <input
            type="text"
            value={newExerciseName}
            onChange={(e) => setNewExerciseName(e.target.value)}
            placeholder="New exercise name"
            className="flex-grow p-2 border rounded-lg"
          />
          <button
            type="submit"
            className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
          >
            <Plus size={20} />
            Add Exercise
          </button>
        </form>
      </div>

      {allSessions.length > 0 && (
        <div className="mb-8">
          <AllSessionsGraph sessions={allSessions} />
        </div>
      )}

      <ConfirmationModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={confirmDelete}
        title="Delete Exercise"
        message={`Are you sure you want to delete ${exerciseToDelete}? This action cannot be undone.`}
      />
    </div>
    </div>
  );
}