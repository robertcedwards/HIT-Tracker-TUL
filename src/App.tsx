import './index.css'
import { ExerciseTable } from './components/ExerciseTable'
import { Exercise, EXERCISE_OPTIONS } from './types/Exercise'
import { Dumbbell } from 'lucide-react'

function App() {
  const getExerciseData = (name: string): Exercise | null => {
    try {
      const data = localStorage.getItem(`exercise_${name}`)
      return data ? JSON.parse(data) : null
    } catch (error) {
      console.error('Error reading exercise data:', error)
      return null
    }
  }

  const saveExerciseData = (exercise: Exercise) => {
    try {
      localStorage.setItem(`exercise_${exercise.name}`, JSON.stringify(exercise))
    } catch (error) {
      console.error('Error saving exercise data:', error)
    }
  }

  const exerciseData = EXERCISE_OPTIONS.map(name => getExerciseData(name) || {
    name,
    sessions: [],
    lastUpdated: new Date().toISOString()
  })

  return (
    <div className="min-h-screen bg-slate-50 p-4">
      <div className="max-w-6xl mx-auto bg-white rounded-xl shadow-md p-6">
        <div className="flex items-center gap-2 mb-6">
          <Dumbbell className="w-8 h-8 text-blue-500" />
          <h1 className="text-2xl font-bold">Fitness Tracker</h1>
        </div>

        <ExerciseTable 
          exercises={exerciseData}
          onSaveExercise={saveExerciseData}
        />
      </div>
    </div>
  )
}

export default App