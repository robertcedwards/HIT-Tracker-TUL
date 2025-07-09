import { useState, useEffect, useRef } from 'react';
import { Exercise, Session } from '../types/Exercise';
import { AllSessionsGraph } from './AllSessionsGraph';
import { Play, Square, Volume2, VolumeX, Trash2, Plus } from 'lucide-react';
import { ConfirmationModal } from './ConfirmationModal';
import { addNewExercise, deleteExercise } from '../lib/database';
import { supabase } from '../lib/supabase';
import { useWeightUnit } from '../contexts/WeightUnitContext';
import { trackEvent } from '../lib/analytics';
import { SessionTable } from './SessionTable';

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
      if (lastSession?.weight && lastSession.weight > 0) {
        initialWeights[exercise.name] = lastSession.weight;
      }
    });
    return initialWeights;
  });

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [exerciseToDelete, setExerciseToDelete] = useState<string | null>(null);
  const [newExerciseName, setNewExerciseName] = useState('');
  const [showSessionsModal, setShowSessionsModal] = useState(false);
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);
  const [sessionsToShow, setSessionsToShow] = useState(5);
  const [editedSessions, setEditedSessions] = useState<Record<string, Session>>({});
  const [isEditing, setIsEditing] = useState(false);
  const [sessionToDelete, setSessionToDelete] = useState<string | null>(null);
  const [showDeleteSessionModal, setShowDeleteSessionModal] = useState(false);
  const newExerciseInputRef = useRef<HTMLInputElement | null>(null);
  const [deleteWarning, setDeleteWarning] = useState(false);

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
      if (lastSession?.weight && lastSession.weight > 0) {
        newWeights[exercise.name] = lastSession.weight;
      }
    });
    setWeights(newWeights);
  }, [exercises]);

  useEffect(() => {
    if (newExerciseInputRef.current) {
      newExerciseInputRef.current.focus();
    }
  }, []);

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
      // Allow empty input, remove the key from weights
      setWeights(prev => {
        const newWeights = { ...prev };
        delete newWeights[exerciseName];
        return newWeights;
      });
      trackEvent('clear_weight', { exercise: exerciseName });
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
    setDeleteWarning(exercise.sessions && exercise.sessions.length > 0);
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

  const handleUpdateSession = (sessionId: string, updates: Partial<Session>) => {
    if (!selectedExercise) return;
    
    setEditedSessions(prev => ({
      ...prev,
      [sessionId]: {
        ...(prev[sessionId] || selectedExercise.sessions.find(s => s.id === sessionId)!),
        ...updates
      }
    }));
    setIsEditing(true);
  };

  const handleDeleteSession = async (sessionId: string) => {
    setSessionToDelete(sessionId);
    setShowDeleteSessionModal(true);
  };

  const confirmDeleteSession = async () => {
    if (!selectedExercise || !sessionToDelete) return;
    
    try {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) return;

      // Delete from database
      const { error } = await supabase
        .from('sessions')
        .delete()
        .eq('id', sessionToDelete);

      if (error) throw error;

      // Update local state
      const updatedExercise = {
        ...selectedExercise,
        sessions: selectedExercise.sessions.filter(s => s.id !== sessionToDelete)
      };
      
      setSelectedExercise(updatedExercise);
      setLocalExercises(prev => 
        prev.map(ex => ex.id === selectedExercise.id ? updatedExercise : ex)
      );
      
      // Trigger parent refresh
      onSaveExercise(updatedExercise);
      
      // Clear deletion state
      setSessionToDelete(null);
      setShowDeleteSessionModal(false);
    } catch (error) {
      console.error('Error deleting session:', error);
    }
  };

  const handleSaveSessions = async () => {
    if (!selectedExercise || Object.keys(editedSessions).length === 0) return;
    
    try {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) return;

      // Update each edited session in the database
      for (const [sessionId, updatedSession] of Object.entries(editedSessions)) {
        const { error } = await supabase
          .from('sessions')
          .update({
            weight: updatedSession.weight,
            time_under_load: updatedSession.timeUnderLoad,
            timestamp: updatedSession.timestamp
          })
          .eq('id', sessionId);

        if (error) throw error;
      }

      // Update local state
      const updatedSessions = selectedExercise.sessions.map(session => 
        editedSessions[session.id!] || session
      );
      
      const updatedExercise = {
        ...selectedExercise,
        sessions: updatedSessions
      };
      
      setSelectedExercise(updatedExercise);
      setLocalExercises(prev => 
        prev.map(ex => ex.id === selectedExercise.id ? updatedExercise : ex)
      );
      
      // Clear editing state
      setEditedSessions({});
      setIsEditing(false);
      
      // Trigger parent refresh
      onSaveExercise(updatedExercise);
    } catch (error) {
      console.error('Error saving sessions:', error);
    }
  };

  const handleCancelEditing = () => {
    setEditedSessions({});
    setIsEditing(false);
  };

  const handleModalClose = () => {
    setShowSessionsModal(false);
    setSelectedExercise(null);
    setSessionsToShow(5);
    setEditedSessions({});
    setIsEditing(false);
  };

  const handleModalBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      handleModalClose();
    }
  };

  return (
    <div>
      <div className="mb-8">
        {/* Mobile view - cards for each exercise */}
        <div className="md:hidden space-y-4">
          {localExercises.map((exercise) => {
            const lastSession = exercise.sessions[exercise.sessions.length - 1];
            const isTimerActive = timerState.exerciseName === exercise.name;

            return (
              <div key={exercise.name} className="bg-white rounded-lg border p-4 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-lg">{exercise.name}</h3>
                  <button
                    onClick={() => exercise.id && handleDeleteExercise(exercise)}
                    className="text-red-500 hover:text-red-700 p-2"
                    title="Delete exercise"
                  >
                    <Trash2 size={20} />
                  </button>
                </div>

                {/* Weight section */}
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-gray-700">
                      Weight ({weightUnit})
                    </label>
                    <button 
                      onClick={handleWeightUnitToggle}
                      className="text-xs text-blue-600 hover:text-blue-800"
                    >
                      Toggle Units
                    </button>
                  </div>
                  <div className="flex items-center">
                    <button
                      onClick={() => {
                        const currentWeight = weights[exercise.name] || 0;
                        const newWeight = Math.max(0, currentWeight - 5);
                        setWeights(prev => ({ ...prev, [exercise.name]: newWeight }));
                        trackEvent('change_weight', {
                          exercise: exercise.name,
                          value: convertWeight(newWeight),
                          unit: weightUnit,
                          action: 'decrement'
                        });
                      }}
                      className="px-4 py-3 bg-gray-100 hover:bg-gray-200 border border-r-0 rounded-l-lg transition-colors text-lg font-bold"
                      title="Decrease weight by 5"
                    >
                      −
                    </button>
                    <input
                      type="number"
                      value={Object.prototype.hasOwnProperty.call(weights, exercise.name) ? convertWeight(weights[exercise.name]) : ''}
                      onChange={(e) => handleWeightChange(exercise.name, e)}
                      className="flex-1 p-3 border-y text-center text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                      min="0"
                      step="1"
                    />
                    <button
                      onClick={() => {
                        const currentWeight = weights[exercise.name] || 0;
                        const newWeight = currentWeight + 5;
                        setWeights(prev => ({ ...prev, [exercise.name]: newWeight }));
                        trackEvent('change_weight', {
                          exercise: exercise.name,
                          value: convertWeight(newWeight),
                          unit: weightUnit,
                          action: 'increment'
                        });
                      }}
                      className="px-4 py-3 bg-gray-100 hover:bg-gray-200 border border-l-0 rounded-r-lg transition-colors text-lg font-bold"
                      title="Increase weight by 5"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Timer section */}
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-gray-700">Timer</label>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          const newState = !timerSettings.soundEnabled;
                          trackEvent('toggle_sound', { enabled: newState });
                          updateTimerSettings({ soundEnabled: newState });
                          if (!timerSettings.soundEnabled) {
                            setTimeout(testSound, 100);
                          }
                        }}
                        className="p-2 hover:bg-gray-200 rounded"
                        title={timerSettings.soundEnabled ? "Sound enabled" : "Sound disabled"}
                      >
                        {timerSettings.soundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
                      </button>
                      <select
                        value={timerSettings.countdownTime}
                        onChange={(e) => updateTimerSettings({ countdownTime: Number(e.target.value) })}
                        className="text-sm border rounded p-1"
                        title="Countdown time"
                      >
                        {[5, 10, 15, 20, 30].map(time => (
                          <option key={time} value={time}>{time}s</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <button
                    onClick={() => handleStartTimer(exercise.name)}
                    className={`w-full flex items-center justify-center gap-2 py-4 rounded-lg text-lg font-semibold focus:ring-2 focus:outline-none ${
                      isTimerActive
                        ? 'bg-red-600 hover:bg-red-700 text-white focus:ring-red-500'
                        : 'bg-blue-700 hover:bg-blue-800 text-white focus:ring-blue-500'
                    }`}
                  >
                    {isTimerActive ? <Square size={24} /> : <Play size={24} />}
                    {isTimerActive ? `Stop (${timerState.time}s)` : 'Start Timer'}
                  </button>
                  {isTimerActive && lastSession && (
                    <div className="mt-2 text-center text-xs text-gray-500">
                      Last session: {formatWeight(lastSession.weight)} × {lastSession.timeUnderLoad}s
                    </div>
                  )}
                </div>

                {/* Last session section */}
                <div className="border-t pt-3">
                  {lastSession ? (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">
                        Last: {formatWeight(lastSession.weight)} × {lastSession.timeUnderLoad}s
                      </span>
                      <button
                        className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                        onClick={() => {
                          setSelectedExercise(exercise);
                          setSessionsToShow(5);
                          setShowSessionsModal(true);
                        }}
                      >
                        View History
                      </button>
                    </div>
                  ) : (
                    <span className="text-sm text-gray-500">No sessions yet</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Desktop view - table */}
        <div className="hidden md:block overflow-x-auto">
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
                      <div className="flex items-center">
                        <button
                          onClick={() => {
                            const currentWeight = weights[exercise.name] || 0;
                            const newWeight = Math.max(0, currentWeight - 5);
                            setWeights(prev => ({ ...prev, [exercise.name]: newWeight }));
                            trackEvent('change_weight', {
                              exercise: exercise.name,
                              value: convertWeight(newWeight),
                              unit: weightUnit,
                              action: 'decrement'
                            });
                          }}
                          className="px-3 py-2 bg-gray-100 hover:bg-gray-200 border border-r-0 rounded-l-lg transition-colors"
                          title="Decrease weight by 5"
                        >
                          −
                        </button>
                        <input
                          type="number"
                          value={Object.prototype.hasOwnProperty.call(weights, exercise.name) ? convertWeight(weights[exercise.name]) : ''}
                          onChange={(e) => handleWeightChange(exercise.name, e)}
                          className="w-20 p-2 border-y text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                          min="0"
                          step="1"
                        />
                        <button
                          onClick={() => {
                            const currentWeight = weights[exercise.name] || 0;
                            const newWeight = currentWeight + 5;
                            setWeights(prev => ({ ...prev, [exercise.name]: newWeight }));
                            trackEvent('change_weight', {
                              exercise: exercise.name,
                              value: convertWeight(newWeight),
                              unit: weightUnit,
                              action: 'increment'
                            });
                          }}
                          className="px-3 py-2 bg-gray-100 hover:bg-gray-200 border border-l-0 rounded-r-lg transition-colors"
                          title="Increase weight by 5"
                        >
                          +
                        </button>
                      </div>
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
                          <span className="block text-xs text-gray-500 ml-2">
                            Last: {formatWeight(lastSession.weight)} × {lastSession.timeUnderLoad}s
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2 text-gray-500">
                      {lastSession ? (
                        <>
                          {formatWeight(lastSession.weight)} × {lastSession.timeUnderLoad}s
                          <button
                            className="ml-2 text-blue-600 hover:underline text-xs"
                            onClick={() => {
                              setSelectedExercise(exercise);
                              setSessionsToShow(5);
                              setShowSessionsModal(true);
                            }}
                          >
                            Previous Sessions
                          </button>
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
        </div>
      </div>

      <div className="mb-8 border-t pt-8">
        <h2 className="text-lg font-semibold mb-4">Add New Exercise</h2>
        <form onSubmit={handleAddExercise} className="flex gap-2">
          <input
            type="text"
            ref={newExerciseInputRef}
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

      {showSessionsModal && selectedExercise && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={handleModalBackdropClick}
        >
          <div className="bg-white rounded-2xl p-6 max-w-lg w-full relative">
            <button
              className="absolute top-2 right-2 text-gray-700 hover:text-red-600 text-3xl font-bold p-2 rounded-full bg-white/80 shadow-md z-10"
              style={{ lineHeight: '1', width: '2.5rem', height: '2.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              aria-label="Close"
              onClick={handleModalClose}
            >
              ×
            </button>
            <h2 className="text-xl font-bold mb-4">Previous Sessions for {selectedExercise.name}</h2>
            <SessionTable
              sessions={[...selectedExercise.sessions]
                .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                .slice(0, sessionsToShow)
              }
              onUpdateSession={(index, updates) => {
                const session = selectedExercise.sessions.slice(-sessionsToShow).reverse()[index];
                if (session.id) {
                  handleUpdateSession(session.id, updates);
                }
              }}
              onDeleteSession={(index) => {
                const session = selectedExercise.sessions.slice(-sessionsToShow).reverse()[index];
                if (session.id) {
                  handleDeleteSession(session.id);
                }
              }}
              editable={true}
              deletable={true}
              editedSessions={editedSessions}
            />
            {isEditing && (
              <div className="mt-4 flex gap-2 justify-end">
                <button
                  onClick={handleCancelEditing}
                  className="px-4 py-2 text-gray-600 bg-gray-200 rounded hover:bg-gray-300"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveSessions}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Save Changes
                </button>
              </div>
            )}
            {selectedExercise.sessions.length > sessionsToShow && (
              <button
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                onClick={() => setSessionsToShow(s => s + 5)}
              >
                Load More
              </button>
            )}
          </div>
        </div>
      )}

      <ConfirmationModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={confirmDelete}
        title="Delete Exercise"
        message={`Are you sure you want to delete ${localExercises.find(ex => ex.id === exerciseToDelete)?.name || ''}?${deleteWarning ? ' This exercise has sessions and deleting it will remove all associated data.' : ' This action cannot be undone.'}`}
      />

      <ConfirmationModal
        isOpen={showDeleteSessionModal}
        onClose={() => setShowDeleteSessionModal(false)}
        onConfirm={confirmDeleteSession}
        title="Confirm Deletion"
        message={`Are you sure you want to delete this session? This action cannot be undone.`}
      />
    </div>
  );
}