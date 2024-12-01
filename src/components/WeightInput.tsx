interface WeightInputProps {
  value: number;
  onChange: (value: number) => void;
}

export function WeightInput({ value, onChange }: WeightInputProps) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-24 p-2 border rounded-lg shadow-sm"
        min="0"
      />
      <span className="text-gray-600">lbs</span>
    </div>
  );
}