import { Play, Square, Volume2 } from 'lucide-react';
import { useState } from 'react';

const DEMO_EXERCISES = [
  { name: 'Chest Press', weight: 100, lastSession: '100lbs × 90s' },
  { name: 'Leg Press', weight: 200, lastSession: '200lbs × 120s' },
  { name: 'Lat Pull Down', weight: 80, lastSession: '80lbs × 75s' }
];

export function DemoTable() {
  const [activeTimer, setActiveTimer] = useState<string | null>(null);
  const [time, setTime] = useState(0);

  const handleStartTimer = (exerciseName: string) => {
    if (activeTimer === exerciseName) {
      setActiveTimer(null);
      setTime(0);
    } else {
      setActiveTimer(exerciseName);
      setTime(0);
    }
  };

  return (
    <div className="overflow-x-auto mb-8 opacity-75">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50">
            <th className="px-4 py-2 text-left">Exercise</th>
            <th className="px-2 py-2 text-center whitespace-nowrap">🏋️‍♂️</th>
            <th className="px-4 py-2 text-left">
              <div className="flex items-center gap-4">
                Timer
                <Volume2 size={16} className="text-gray-400" />
              </div>
            </th>
            <th className="px-4 py-2 text-left">Last Session</th>
          </tr>
        </thead>
        <tbody>
          {DEMO_EXERCISES.map((exercise) => (
            <tr key={exercise.name} className="border-t">
              <td className="px-4 py-2 font-medium">{exercise.name}</td>
              <td className="px-2 py-2">
                <input
                  type="number"
                  value={exercise.weight}
                  className="w-14 p-1 border rounded bg-gray-50 text-center"
                  disabled
                />
              </td>
              <td className="px-4 py-2">
                <button
                  onClick={() => handleStartTimer(exercise.name)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${
                    activeTimer === exercise.name
                      ? 'bg-red-600 hover:bg-red-700 text-white'
                      : 'bg-blue-700 hover:bg-blue-800 text-white'
                  }`}
                >
                  {activeTimer === exercise.name ? <Square size={16} /> : <Play size={16} />}
                  {activeTimer === exercise.name ? `Stop (${time}s)` : 'Start'}
                </button>
              </td>
              <td className="px-4 py-2 text-gray-500">{exercise.lastSession}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
} 