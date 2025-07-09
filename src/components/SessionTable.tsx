import { Session } from '../types/Exercise';
import { Trash2 } from 'lucide-react';

interface SessionTableProps {
  sessions: Session[];
  onUpdateSession: (index: number, updates: Partial<Session>) => void;
  onDeleteSession: (index: number) => void;
  editable?: boolean;
  deletable?: boolean;
  editedSessions?: Record<string, Session>;
}

export function SessionTable({ sessions, onUpdateSession, onDeleteSession, editable = true, deletable = true, editedSessions = {} }: SessionTableProps) {
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
          {sessions.map((session, index) => {
            const editedSession = editedSessions[session.id!];
            const displaySession = editedSession || session;
            
            return (
              <tr key={session.id || session.timestamp + '-' + index} className="border-t">
                <td className="px-4 py-2">
                  {editable ? (
                    <input
                      type="date"
                      value={displaySession.timestamp.split('T')[0]}
                      onChange={(e) => {
                        const newDate = new Date(e.target.value);
                        newDate.setHours(12, 0, 0, 0); // Set to noon to avoid timezone issues
                        onUpdateSession(index, { timestamp: newDate.toISOString() });
                      }}
                      className="w-32 p-1 border rounded text-sm"
                    />
                  ) : (
                    new Date(session.timestamp).toLocaleDateString()
                  )}
                </td>
                <td className="px-4 py-2">
                  {editable ? (
                    <input
                      type="number"
                      value={displaySession.weight === undefined || displaySession.weight === null ? '' : displaySession.weight}
                      onChange={(e) => {
                        const val = e.target.value;
                        onUpdateSession(index, { weight: val === '' ? undefined : Number(val) });
                      }}
                      className="w-20 p-1 border rounded"
                      min="0"
                    />
                  ) : (
                    displaySession.weight
                  )}
                </td>
                <td className="px-4 py-2">
                  {editable ? (
                    <input
                      type="number"
                      value={displaySession.timeUnderLoad === undefined || displaySession.timeUnderLoad === null ? '' : displaySession.timeUnderLoad}
                      onChange={(e) => {
                        const val = e.target.value;
                        onUpdateSession(index, { timeUnderLoad: val === '' ? undefined : Number(val) });
                      }}
                      className="w-20 p-1 border rounded"
                      min="0"
                    />
                  ) : (
                    displaySession.timeUnderLoad
                  )}
                </td>
                <td className="px-4 py-2">
                  {deletable ? (
                    <button
                      onClick={() => onDeleteSession(index)}
                      className="text-red-500 hover:text-red-700"
                      title="Delete session"
                    >
                      <Trash2 size={16} />
                    </button>
                  ) : null}
                </td>
              </tr>
            );
          })}
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