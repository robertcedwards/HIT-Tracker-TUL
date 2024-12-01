import { useState, useEffect, useRef } from 'react';
import { Exercise, Session } from '../types/Exercise';
import { AllSessionsGraph } from './AllSessionsGraph';
import { Play, Square, Volume2, VolumeX } from 'lucide-react';

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

  // Initialize audio element with correct path
  useEffect(() => {
    audioRef.current = new Audio('timer-beep.mp3');
    audioRef.current.load(); // Preload the audio
  }, []);

  useEffect(() => {
    setLocalExercises(exercises);
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
      setWeights(prev => {
        const newWeights = { ...prev };
        delete newWeights[exerciseName];
        return newWeights;
      });
    } else {
      const numValue = Number(value);
      if (!isNaN(numValue)) {
        setWeights(prev => ({
          ...prev,
          [exerciseName]: numValue
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

  return (
    <div>
      <div className="overflow-x-auto mb-8">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50">
              <th className="px-4 py-2 text-left">Exercise</th>
              <th className="px-4 py-2 text-left">Weight (lbs)</th>
              <th className="px-4 py-2 text-left">
                <div className="flex items-center gap-4">
                  Timer
                  <div className="flex items-center gap-2 text-gray-600">
                    <button
                      onClick={() => {
                        updateTimerSettings({ soundEnabled: !timerSettings.soundEnabled });
                        if (!timerSettings.soundEnabled) {
                          // Test sound when enabling
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
                      value={weights[exercise.name] || ''}
                      onChange={(e) => handleWeightChange(exercise.name, e)}
                      className="w-24 p-1 border rounded"
                      min="0"
                    />
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-4">
                      <button
                        onClick={() => handleStartTimer(exercise.name)}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${
                          isTimerActive
                            ? 'bg-red-500 hover:bg-red-600 text-white'
                            : 'bg-blue-500 hover:bg-blue-600 text-white'
                        }`}
                      >
                        {isTimerActive ? <Square size={16} /> : <Play size={16} />}
                        {isTimerActive ? `Stop (${timerState.time}s)` : 'Start'}
                      </button>
                      {isTimerActive && lastSession && (
                        <span className="text-sm text-gray-500">
                          {lastSession.timeUnderLoad - timerState.time > 0 && 
                           lastSession.timeUnderLoad - timerState.time <= timerSettings.countdownTime && 
                            `${lastSession.timeUnderLoad - timerState.time}s to go`
                          }
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-2 text-gray-600">
                    {lastSession ? (
                      `${lastSession.weight}lbs × ${lastSession.timeUnderLoad}s`
                    ) : (
                      'No sessions yet'
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="bg-gray-50 p-4 rounded-lg">
        <h2 className="text-lg font-semibold mb-4">Training Progress</h2>
        <AllSessionsGraph sessions={allSessions} />
      </div>
    </div>
  );
}