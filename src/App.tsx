import './index.css'
import { ExerciseTable } from './components/ExerciseTable'
import { Exercise, EXERCISE_OPTIONS } from './types/Exercise'
import { Dumbbell, Info as InfoIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { InfoModal } from './components/InfoModal'

function App() {
  const [showModal, setShowModal] = useState(false)
  const [exercises, setExercises] = useState<Exercise[]>([])

  useEffect(() => {
    const hasSeenModal = localStorage.getItem('hasSeenModal')
    if (!hasSeenModal) {
      setShowModal(true)
      localStorage.setItem('hasSeenModal', 'true')
    }
  }, [])

  useEffect(() => {
    const exerciseData = EXERCISE_OPTIONS.map(name => {
      const existingData = getExerciseData(name)
      if (existingData) {
        return existingData
      }
      return {
        name,
        sessions: [],
        lastUpdated: new Date().toISOString()
      }
    })
    setExercises(exerciseData)
  }, [])

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
      setExercises(prev => 
        prev.map(ex => ex.name === exercise.name ? exercise : ex)
      )
    } catch (error) {
      console.error('Error saving exercise data:', error)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 flex flex-col">
      <div className="max-w-6xl mx-auto bg-white rounded-xl shadow-md p-6 flex-grow">
        <div className="flex items-center gap-2 mb-6">
          <Dumbbell className="w-8 h-8 text-blue-500" />
          <h1 className="text-2xl font-bold">Fitness Tracker</h1>
        </div>

        <ExerciseTable 
          exercises={exercises}
          onSaveExercise={saveExerciseData}
        />
      </div>

      {showModal && <InfoModal onClose={() => setShowModal(false)} />}

      <footer className="bg-gray-50 p-4 text-center sticky bottom-0">
        <div className="flex justify-center space-x-4">
          <button 
            onClick={() => setShowModal(true)} 
            className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
          >
            <InfoIcon size={20} />
            More Info
          </button>
        </div>
      </footer>
    </div>
  )
}

export default App