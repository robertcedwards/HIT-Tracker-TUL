import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Session } from '../types/Exercise';

interface SessionsGraphProps {
  sessions: Session[];
}

export function SessionsGraph({ sessions }: SessionsGraphProps) {
  const data = sessions.map(session => ({
    timestamp: new Date(session.timestamp).toLocaleDateString(),
    weight: session.weight,
    timeUnderLoad: session.timeUnderLoad
  }));

  return (
    <div className="w-full h-64">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
          <XAxis dataKey="timestamp" />
          <YAxis yAxisId="weight" orientation="left" name="Weight (lbs)" />
          <YAxis yAxisId="time" orientation="right" name="Time (s)" />
          <Tooltip />
          <Line 
            yAxisId="weight"
            type="monotone" 
            dataKey="weight" 
            stroke="#8884d8" 
            name="Weight (lbs)"
          />
          <Line 
            yAxisId="time"
            type="monotone" 
            dataKey="timeUnderLoad" 
            stroke="#82ca9d" 
            name="Time (s)"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}