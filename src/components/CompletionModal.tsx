import { DEFAULT_EXERCISES } from '../types/Exercise';
import { ExerciseSelect } from './ExerciseSelect';

interface CompletionModalProps {
  currentExercise: string;
  onClose: () => void;
  onSelectNext: (exercise: string) => void;
}

export function CompletionModal({ 
  currentExercise, 
  onClose, 
  onSelectNext 
}: CompletionModalProps) {
  const remainingExercises = DEFAULT_EXERCISES.filter((ex: string) => ex !== currentExercise);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
      <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4">
        <h2 className="text-xl font-bold mb-4">Session Complete!</h2>
        <p className="text-gray-600 mb-4">
          Great job completing {currentExercise}! Would you like to start another exercise?
        </p>
        <ExerciseSelect
          value=""
          onChange={onSelectNext}
          options={remainingExercises}
        />
        <div className="flex justify-end gap-2 mt-4">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            Done for today
          </button>
        </div>
      </div>
    </div>
  );
}