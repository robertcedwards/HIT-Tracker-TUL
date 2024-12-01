interface ExerciseSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: readonly string[];
}

export function ExerciseSelect({ value, onChange, options }: ExerciseSelectProps) {
  return (
    <select
      className="w-full p-2 border rounded-lg bg-white shadow-sm"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">Select an exercise</option>
      {options.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  );
}