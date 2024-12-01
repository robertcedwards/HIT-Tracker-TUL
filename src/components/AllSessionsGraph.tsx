import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Session } from '../types/Exercise';
import { format } from 'timeago.js';

interface AllSessionsGraphProps {
  sessions: (Session & { exerciseName: string })[];
}

export function AllSessionsGraph({ sessions }: AllSessionsGraphProps) {
  const data = sessions
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    .map(session => ({
      timestamp: new Date(session.timestamp),
      displayTime: format(new Date(session.timestamp)),
      fullTime: new Date(session.timestamp).toLocaleString(),
      [`${session.exerciseName}_weight`]: session.weight,
      [`${session.exerciseName}_time`]: session.timeUnderLoad,
      exerciseName: session.exerciseName
    }));

  const exerciseNames = [...new Set(sessions.map(s => s.exerciseName))];

  const colors = [
    '#8884d8',
    '#82ca9d',
    '#ffc658',
    '#ff7300',
    '#0088fe',
    '#00C49F',
  ];

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-4 rounded shadow-lg border">
          <p className="font-medium">{payload[0]?.payload.fullTime}</p>
          <p className="text-gray-500 text-sm">{payload[0]?.payload.displayTime}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} style={{ color: entry.color }}>
              {entry.name}: {entry.value}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="w-full h-96">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 5, right: 30, bottom: 5, left: 20 }}>
          <XAxis 
            dataKey="displayTime"
            tick={{ fontSize: 12 }}
          />
          <YAxis 
            yAxisId="weight" 
            orientation="left" 
            label={{ value: 'Weight (lbs)', angle: -90, position: 'insideLeft' }} 
          />
          <YAxis 
            yAxisId="time" 
            orientation="right" 
            label={{ value: 'Time (s)', angle: 90, position: 'insideRight' }} 
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend />
          
          {exerciseNames.map((name, index) => (
            <Line
              key={`${name}_weight`}
              yAxisId="weight"
              type="monotone"
              dataKey={`${name}_weight`}
              name={`${name} (Weight)`}
              stroke={colors[index % colors.length]}
              dot={true}
              connectNulls
            />
          ))}

          {exerciseNames.map((name, index) => (
            <Line
              key={`${name}_time`}
              yAxisId="time"
              type="monotone"
              dataKey={`${name}_time`}
              name={`${name} (Time)`}
              stroke={colors[index % colors.length]}
              strokeDasharray="5 5"
              dot={true}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}