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
import NoSleep from 'nosleep.js';

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
  const noSleepRef = useRef<NoSleep | null>(null);
  
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
  // Mobile-focused exercise state
  const [activeExerciseId, setActiveExerciseId] = useState<string | null>(null);
  // Animation helpers
  const [showOverlay, setShowOverlay] = useState(false);
  useEffect(() => {
    if (activeExerciseId) {
      setShowOverlay(true);
    } else {
      // Delay removal for fade-out
      const timeout = setTimeout(() => setShowOverlay(false), 300);
      return () => clearTimeout(timeout);
    }
  }, [activeExerciseId]);

  // State for mobile previous sessions sheet
  const [showMobileSessionsSheet, setShowMobileSessionsSheet] = useState(false);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editSessionValues, setEditSessionValues] = useState<{ weight: string; timeUnderLoad: string }>({ weight: '', timeUnderLoad: '' });
  const [mobileSessionsToShow, setMobileSessionsToShow] = useState(5);

  // Initialize audio element and NoSleep
  useEffect(() => {
    audioRef.current = new Audio('timer-beep.mp3');
    audioRef.current.load(); // Preload the audio
    
    // Initialize NoSleep
    noSleepRef.current = new NoSleep();
    
    return () => {
      // Cleanup: disable NoSleep if it's enabled
      if (noSleepRef.current?.isEnabled) {
        noSleepRef.current.disable();
      }
    };
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

  // Cleanup NoSleep when timer stops
  useEffect(() => {
    if (!timerState.isRunning && noSleepRef.current?.isEnabled) {
      noSleepRef.current.disable();
    }
  }, [timerState.isRunning]);

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

  const handleStartTimer = async (exerciseName: string) => {
    if (timerState.isRunning && timerState.exerciseName === exerciseName) {
      // Stop timer
      trackEvent('stop_timer', {
        exercise: exerciseName,
        duration: timerState.time
      });
      
      // Disable NoSleep when stopping timer
      if (noSleepRef.current?.isEnabled) {
        noSleepRef.current.disable();
      }
      
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
      // Start timer
      trackEvent('start_timer', { exercise: exerciseName });
      
      // Enable NoSleep when starting timer to prevent screen sleep
      try {
        if (noSleepRef.current && !noSleepRef.current.isEnabled) {
          await noSleepRef.current.enable();
        }
      } catch (error) {
        console.warn('Failed to enable NoSleep:', error);
      }
      
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
        {/* Mobile view - focused exercise card with overlay and animation */}
        <div className="md:hidden">
          {/* Soft blur overlay */}
          {showOverlay && (
            <div
              className={`fixed inset-0 z-40 bg-black/30 backdrop-blur-sm transition-opacity duration-700 ${activeExerciseId ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
              onClick={() => setActiveExerciseId(null)}
              aria-label="Close exercise focus"
            />
          )}
          {showOverlay && activeExerciseId && (() => {
            const exercise = localExercises.find(e => e.id === activeExerciseId);
            if (!exercise) return null;
            const lastSession = exercise.sessions[exercise.sessions.length - 1];
            const isTimerActive = timerState.exerciseName === exercise.name;
            return (
              <div className={`fixed inset-x-0 bottom-0 z-50 bg-white/60 backdrop-blur-md rounded-t-2xl border-t p-4 shadow-2xl flex flex-col max-h-[90vh] min-h-[33vh] transition-transform duration-700 ease-out ${activeExerciseId ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'} w-full`} style={{transitionProperty: 'transform, opacity'}}>
                <div className="flex flex-col gap-1 mb-2">
                  <div className="flex items-center justify-between gap-2 w-full">
                    <div className="flex-1 flex items-center min-w-0">
                      <h3 className="font-semibold text-2xl pr-2 break-words truncate font-sans">{exercise.name}</h3>
                      {lastSession && (
                        <span className="ml-2 text-base text-gray-500 whitespace-nowrap font-normal">
                          {new Date(lastSession.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} - {formatWeight(lastSession.weight)} × {lastSession.timeUnderLoad}s
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {/* Hide delete button on mobile */}
                      <button
                        className="hidden md:flex text-red-500 hover:text-red-700 p-2"
                        onClick={() => exercise.id && handleDeleteExercise(exercise)}
                        title="Delete exercise"
                        style={{ minWidth: 36 }}
                      >
                        <Trash2 size={24} />
                      </button>
                      <button
                        className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 hover:text-blue-700 text-xl font-bold focus:outline-none focus:ring-2 focus:ring-blue-400 transition"
                        onClick={() => setActiveExerciseId(null)}
                        aria-label="Close"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                  <button
                    className="w-full mt-2 py-3 rounded-xl bg-white/70 hover:bg-blue-50 text-blue-700 font-semibold text-base shadow transition"
                    onClick={() => setShowMobileSessionsSheet(true)}
                  >
                    Previous Sessions
                  </button>
                </div>
                {/* Thumb-friendly controls */}
                <div className="flex flex-col gap-3 mt-auto">
                  {/* Timer controls */}
                  <div className="flex items-center justify-between mb-1 gap-2 w-full">
                    <button
                      onClick={() => {
                        const newState = !timerSettings.soundEnabled;
                        trackEvent('toggle_sound', { enabled: newState });
                        updateTimerSettings({ soundEnabled: newState });
                        if (!timerSettings.soundEnabled) {
                          setTimeout(testSound, 100);
                        }
                      }}
                      className="p-2 hover:bg-gray-200 rounded-full"
                      title={timerSettings.soundEnabled ? "Sound enabled" : "Sound disabled"}
                    >
                      {timerSettings.soundEnabled ? <Volume2 size={24} /> : <VolumeX size={24} />}
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
                    <div className="flex-1 flex flex-col items-center justify-center">
                      <span className="text-base text-gray-700 font-medium block text-center w-full">Weight ({weightUnit})</span>
                    </div>
                    <button
                      onClick={handleWeightUnitToggle}
                      className="text-base font-medium text-blue-600 hover:text-blue-800 px-2"
                      style={{ minWidth: 'max-content' }}
                    >
                      Toggle Units
                    </button>
                  </div>
                  {/* Weight controls row */}
                  <div className="flex w-full gap-4 justify-center items-end">
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
                      className="flex-1 h-24 bg-gray-100 hover:bg-gray-200 rounded-2xl text-4xl font-bold flex items-center justify-center transition-colors"
                      title="Decrease weight by 5"
                      style={{ minWidth: 0, aspectRatio: '1/1' }}
                    >
                      −
                    </button>
                    <input
                      type="number"
                      value={Object.prototype.hasOwnProperty.call(weights, exercise.name) ? convertWeight(weights[exercise.name]) : ''}
                      onChange={(e) => handleWeightChange(exercise.name, e)}
                      className="flex-1 h-24 text-center text-3xl font-semibold border-2 border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 mx-2"
                      min="0"
                      step="1"
                      style={{ minWidth: 0, maxWidth: 120 }}
                      aria-label="Weight"
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
                      className="flex-1 h-24 bg-gray-100 hover:bg-gray-200 rounded-2xl text-4xl font-bold flex items-center justify-center transition-colors"
                      title="Increase weight by 5"
                      style={{ minWidth: 0, aspectRatio: '1/1' }}
                    >
                      +
                    </button>
                  </div>
                  {/* Start/Stop Timer button (now below weight row) */}
                  <div className="flex justify-center items-center w-full mb-2">
                    <div className="relative flex items-center justify-center">
                      {/* Progress ring (visual only) */}
                      <svg className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none" width="96" height="96" viewBox="0 0 96 96">
                        <circle cx="48" cy="48" r="44" fill="none" stroke="#2563eb" strokeWidth="6" opacity="0.15" />
                        {/* Future: animated progress */}
                      </svg>
                      <button
                        onClick={() => handleStartTimer(exercise.name)}
                        className={`w-28 h-28 flex flex-col items-center justify-center gap-2 rounded-full text-2xl font-semibold focus:ring-2 focus:outline-none transition-all duration-200 active:scale-95 hover:scale-105 shadow-xl ${
                          isTimerActive
                            ? 'bg-gradient-to-br from-red-500 to-red-700 text-white focus:ring-red-500 shadow-red-400/40'
                            : 'bg-gradient-to-br from-blue-500 to-blue-700 text-white focus:ring-blue-500 shadow-blue-400/40'
                        }`}
                        style={{ minHeight: 96, boxShadow: isTimerActive ? '0 0 32px 8px rgba(239,68,68,0.25)' : '0 0 32px 8px rgba(37,99,235,0.25)' }}
                      >
                        <span className="flex items-center justify-center">
                          {isTimerActive ? <Square size={40} /> : <Play size={40} />}
                        </span>
                        <span className="font-bold text-lg font-sans mt-1 tracking-wide select-none">{isTimerActive ? `Stop (${timerState.time}s)` : 'Timer'}</span>
                      </button>
                    </div>
                  </div>
                </div>
                {/* End thumb-friendly controls */}
                {/* Last session section moved above, so remove here */}
              </div>
            );
          })()}
          {!activeExerciseId && (
            <div className="space-y-4">
              {localExercises.map((exercise) => {
                const lastSession = exercise.sessions[exercise.sessions.length - 1];
                return (
                  <button
                    key={exercise.id}
                    className="w-full bg-white rounded-xl border p-4 shadow flex flex-col items-start hover:bg-blue-50 focus:bg-blue-100 transition-colors"
                    onClick={() => setActiveExerciseId(exercise.id || null)}
                  >
                    <div className="flex w-full items-center justify-between">
                      <span className="text-lg font-semibold">{exercise.name}</span>
                      <span className="text-xs text-gray-400">Tap to focus</span>
                    </div>
                    {lastSession && (
                      <div className="mt-1 text-sm text-gray-500">
                        Previous: {new Date(lastSession.timestamp).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })} - {formatWeight(lastSession.weight)} × {lastSession.timeUnderLoad}s
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
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

      {/* Hide add new exercise and chart when focused on mobile */}
      {!(activeExerciseId && window.innerWidth < 768) && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-4">Add New Exercise</h2>
          <form onSubmit={handleAddExercise} className="flex flex-col gap-2 sm:flex-row sm:gap-2">
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
              className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 w-full sm:w-auto justify-center"
            >
              <Plus size={20} />
              Add Exercise
            </button>
          </form>
        </div>
      )}

      {allSessions.length > 0 && (
        <div className="mb-8 hidden md:block">
          <AllSessionsGraph sessions={allSessions} />
        </div>
      )}

      {/* Mobile: Recent Sessions Table where chart was */}
      {allSessions.length > 0 && (
        <div className="mb-8 md:hidden">
          <h2 className="text-lg font-semibold mb-2">Recent Sessions</h2>
          <SessionTable
            sessions={(() => {
              if (activeExerciseId) {
                const exercise = localExercises.find(e => e.id === activeExerciseId);
                return exercise ? [...exercise.sessions].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 5) : [];
              }
              return allSessions.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 5);
            })()}
            onUpdateSession={() => {}}
            onDeleteSession={() => {}}
            editable={false}
            deletable={false}
          />
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

      {/* Mobile Previous Sessions Slide-up Sheet */}
      {showMobileSessionsSheet && activeExerciseId && (() => {
        const exercise = localExercises.find(e => e.id === activeExerciseId);
        if (!exercise) return null;
        const sessions = [...exercise.sessions].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        return (
          <div className="fixed inset-0 z-50 flex items-end justify-center">
            {/* Overlay */}
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity" onClick={() => setShowMobileSessionsSheet(false)} />
            {/* Sheet */}
            <div className="relative w-full max-w-md bg-white/80 backdrop-blur-md rounded-t-2xl shadow-2xl p-4 pb-8 animate-slideUp z-10">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold">Previous Sessions</h3>
                <button className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 hover:text-blue-700 text-xl font-bold focus:outline-none focus:ring-2 focus:ring-blue-400 transition" onClick={() => setShowMobileSessionsSheet(false)} aria-label="Close">×</button>
              </div>
              <div className="space-y-2 max-h-[40vh] overflow-y-auto">
                {sessions.slice(0, mobileSessionsToShow).map((session, idx) => (
                  <div key={session.id || idx} className="flex items-center gap-2 bg-white/80 rounded-xl px-3 py-2 shadow-sm">
                    <div className="flex-1">
                      <div className="text-xs text-gray-400">{new Date(session.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</div>
                      {editingSessionId === session.id ? (
                        <div className="flex gap-2 mt-1">
                          <input
                            type="number"
                            className="w-16 px-2 py-1 border rounded text-sm"
                            value={editSessionValues.weight}
                            onChange={e => setEditSessionValues(v => ({ ...v, weight: e.target.value }))}
                          />
                          <input
                            type="number"
                            className="w-16 px-2 py-1 border rounded text-sm"
                            value={editSessionValues.timeUnderLoad}
                            onChange={e => setEditSessionValues(v => ({ ...v, timeUnderLoad: e.target.value }))}
                          />
                          <button className="text-green-600 font-bold px-2" onClick={() => {
                            // Save edit
                            setLocalExercises(prev => prev.map(ex =>
                              ex.id === exercise.id ? {
                                ...ex,
                                sessions: ex.sessions.map(s =>
                                  s.id === session.id ? {
                                    ...s,
                                    weight: editSessionValues.weight === '' ? 0 : Number(editSessionValues.weight),
                                    timeUnderLoad: editSessionValues.timeUnderLoad === '' ? 0 : Number(editSessionValues.timeUnderLoad)
                                  } : s
                                )
                              } : ex
                            ));
                            setEditingSessionId(null);
                          }}>✓</button>
                          <button className="text-gray-400 px-2" onClick={() => setEditingSessionId(null)}>✕</button>
                        </div>
                      ) : (
                        <div className="text-base font-medium">
                          {session.weight}lbs × {session.timeUnderLoad}s
                        </div>
                      )}
                    </div>
                    <button className="text-blue-600 hover:text-blue-800 px-2" onClick={() => {
                      setEditingSessionId(session.id || null);
                      setEditSessionValues({ weight: String(session.weight), timeUnderLoad: String(session.timeUnderLoad) });
                    }} aria-label="Edit session">✎</button>
                    <button className="text-red-500 hover:text-red-700 px-2" onClick={() => {
                      // Delete session
                      setLocalExercises(prev => prev.map(ex =>
                        ex.id === exercise.id ? {
                          ...ex,
                          sessions: ex.sessions.filter(s => s.id !== session.id)
                        } : ex
                      ));
                    }} aria-label="Delete session">🗑️</button>
                  </div>
                ))}
                {sessions.length > mobileSessionsToShow && (
                  <button className="w-full mt-2 py-2 rounded-lg bg-blue-100 hover:bg-blue-200 text-blue-700 font-semibold" onClick={() => setMobileSessionsToShow(n => n + 5)}>
                    Load More
                  </button>
                )}
                {sessions.length === 0 && (
                  <div className="text-center text-gray-400 py-8">No previous sessions yet.</div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

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