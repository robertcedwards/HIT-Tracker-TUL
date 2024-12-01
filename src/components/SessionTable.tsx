import { Session } from '../types/Exercise';
import { Trash2 } from 'lucide-react';

interface SessionTableProps {
  sessions: Session[];
  onUpdateSession: (index: number, updates: Partial<Session>) => void;
  onDeleteSession: (index: number) => void;
}

export function SessionTable({ sessions, onUpdateSession, onDeleteSession }: SessionTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50">
            <th className="px-4 py-2 text-left">Date</th>
            <th className="px-4 py-2 text-left">Weight (lbs)</th>
            <th className="px-4 py-2 text-left">Time (s)</th>
            <th className="px-4 py-2 text-left">Actions</th>
          </tr>
        </thead>
        <tbody>
          {sessions.map((session, index) => (
            <tr key={session.timestamp} className="border-t">
              <td className="px-4 py-2">
                {new Date(session.timestamp).toLocaleDateString()}
              </td>
              <td className="px-4 py-2">
                <input
                  type="number"
                  value={session.weight}
                  onChange={(e) => onUpdateSession(index, { weight: Number(e.target.value) })}
                  className="w-20 p-1 border rounded"
                  min="0"
                />
              </td>
              <td className="px-4 py-2">
                <input
                  type="number"
                  value={session.timeUnderLoad}
                  onChange={(e) => onUpdateSession(index, { timeUnderLoad: Number(e.target.value) })}
                  className="w-20 p-1 border rounded"
                  min="0"
                />
              </td>
              <td className="px-4 py-2">
                <button
                  onClick={() => onDeleteSession(index)}
                  className="text-red-500 hover:text-red-700"
                  title="Delete session"
                >
                  <Trash2 size={16} />
                </button>
              </td>
            </tr>
          ))}
          {sessions.length === 0 && (
            <tr>
              <td colSpan={4} className="px-4 py-2 text-center text-gray-500">
                No sessions recorded yet
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}