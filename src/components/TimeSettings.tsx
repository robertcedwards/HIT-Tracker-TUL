interface TimeSettingsProps {
  settings: {
    soundEnabled: boolean;
    countdownTime: number;
  };
  onClose: () => void;
  onChange: (settings: { soundEnabled: boolean; countdownTime: number }) => void;
}

export function TimeSettings({ settings, onClose, onChange }: TimeSettingsProps) {
  return (
    <div className="mt-4 p-4 bg-gray-50 rounded-lg w-full max-w-sm">
      <h3 className="font-semibold mb-4">Timer Settings</h3>
      
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={settings.soundEnabled}
              onChange={(e) => onChange({
                ...settings,
                soundEnabled: e.target.checked
              })}
              className="rounded"
            />
            Enable countdown sound
          </label>
        </div>

        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2">
            Countdown time (seconds):
            <input
              type="number"
              value={settings.countdownTime}
              onChange={(e) => onChange({
                ...settings,
                countdownTime: Math.max(1, parseInt(e.target.value) || 1)
              })}
              min="1"
              className="w-20 p-1 border rounded"
            />
          </label>
        </div>
      </div>

      <div className="mt-4 flex justify-end">
        <button
          onClick={onClose}
          className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300"
        >
          Close
        </button>
      </div>
    </div>
  );
}