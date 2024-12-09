import { Play, Square, Plus, Minus } from 'lucide-react';
import { useState, useEffect } from 'react';

type DemoExercise = {
  name: string;
  weight: number;
  lastSession: string;
};

const DEMO_EXERCISES: DemoExercise[] = [
  { name: 'Chest Press', weight: 160, lastSession: '160lbs × 62s' },
  { name: 'Leg Press', weight: 430, lastSession: '430lbs × 66s' },
  { name: 'Lat Pull Down', weight: 120, lastSession: '120lbs × 65s' }
];

export function DemoTable() {
  const [exercises, setExercises] = useState<DemoExercise[]>(() => {
    const stored = localStorage.getItem('demoExercises');
    return stored ? JSON.parse(stored) : DEMO_EXERCISES;
  });
  const [activeTimer, setActiveTimer] = useState<string | null>(null);
  const [time, setTime] = useState(0);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (activeTimer) {
      interval = setInterval(() => {
        setTime(prevTime => prevTime + 1);
      }, 1000);
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [activeTimer]);

  useEffect(() => {
    localStorage.setItem('demoExercises', JSON.stringify(exercises));
  }, [exercises]);

  const handleStartTimer = (exerciseName: string) => {
    if (activeTimer === exerciseName) {
      setExercises(prev => prev.map(ex => 
        ex.name === exerciseName
          ? { ...ex, lastSession: `${ex.weight}lbs × ${time}s` }
          : ex
      ));
      setActiveTimer(null);
      setTime(0);
    } else {
      setActiveTimer(exerciseName);
      setTime(0);
    }
  };

  const handleWeightChange = (exerciseName: string, delta: number) => {
    setExercises(prev => prev.map(ex =>
      ex.name === exerciseName
        ? { ...ex, weight: Math.max(0, ex.weight + delta) }
        : ex
    ));
  };

  return (
    <div className="overflow-x-auto mb-8 opacity-75">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50">
            <th className="px-2 py-2 text-left">Exercise</th>
            <th className="px-2 py-2 text-center whitespace-nowrap">🏋️‍♂️</th>
            <th className="px-2 py-2 text-left">Timer</th>
            <th className="px-2 py-2 text-center">↩</th>
          </tr>
        </thead>
        <tbody>
          {exercises.map((exercise) => (
            <tr key={exercise.name} className="border-t">
              <td className="px-4 py-2 font-medium">{exercise.name}</td>
              <td className="px-2 py-2">
                <div className="flex items-center">
                  <button
                    onClick={() => handleWeightChange(exercise.name, -5)}
                    className="px-1.5 py-1 bg-gray-100 rounded-l hover:bg-gray-200 border border-r-0"
                  >
                    <Minus size={12} />
                  </button>
                  <input
                    type="number"
                    value={exercise.weight}
                    className="w-12 p-0 border-y bg-gray-50 text-center"
                    disabled
                  />
                  <button
                    onClick={() => handleWeightChange(exercise.name, 5)}
                    className="px-1.5 py-1 bg-gray-100 rounded-r hover:bg-gray-200 border border-l-0"
                  >
                    <Plus size={12} />
                  </button>
                </div>
              </td>
              <td className="px-2 py-2">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleStartTimer(exercise.name)}
                    className={`flex items-center justify-center w-10 h-10 rounded-lg ${
                      activeTimer === exercise.name
                        ? 'bg-red-600 hover:bg-red-700 text-white'
                        : 'bg-blue-700 hover:bg-blue-800 text-white'
                    }`}
                  >
                    {activeTimer === exercise.name ? (
                      <div className="flex items-center gap-1">
                        <Square size={16} />
                      </div>
                    ) : (
                      <Play size={16} />
                    )}
                  </button>
                  {activeTimer === exercise.name && <span>{time}s</span>}
                </div>
              </td>
              <td className="px-2 py-2 text-gray-500 text-center">
                <span title={exercise.lastSession}>{exercise.lastSession}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
} 