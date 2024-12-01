import './index.css'
import { ExerciseTable } from './components/ExerciseTable'
import { Exercise, EXERCISE_OPTIONS } from './types/Exercise'
import { Dumbbell } from 'lucide-react'
import { useEffect, useState } from 'react'
import { InfoModal } from './components/InfoModal'

function App() {
  const [showModal, setShowModal] = useState(false)

  useEffect(() => {
    const hasSeenModal = localStorage.getItem('hasSeenModal')
    if (!hasSeenModal) {
      setShowModal(true)
      localStorage.setItem('hasSeenModal', 'true')
    }
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
    <div className="min-h-screen bg-slate-50 p-4 flex flex-col">
      <div className="max-w-6xl mx-auto bg-white rounded-xl shadow-md p-6 flex-grow">
        <div className="flex items-center gap-2 mb-6">
          <Dumbbell className="w-8 h-8 text-blue-500" />
          <h1 className="text-2xl font-bold">Fitness Tracker</h1>
        </div>

        <ExerciseTable 
          exercises={exerciseData}
          onSaveExercise={saveExerciseData}
        />
      </div>

      {showModal && <InfoModal onClose={() => setShowModal(false)} />}

      <footer className="bg-gray-50 p-4 text-center sticky bottom-0">
        <a 
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setShowModal(true);
          }}
          className="text-blue-500 underline"
        >
          Open Info Modal
        </a>
        <div className="mt-2">
          <a href="https://github.com/robertcedwards/HIT-Tracker-TUL" target="_blank" className="inline-block mx-2">
            <img src="https://img.shields.io/github/stars/robertcedwards/HIT-Tracker-TUL?style=social" alt="GitHub Star" />
          </a>
          <a href="https://app.netlify.com/sites/hit-tracker/deploys" target="_blank" className="inline-block mx-2">
            <img src="https://api.netlify.com/api/v1/badges/5168e501-6a4f-4538-97ee-2108388d9e51/deploy-status" alt="Netlify Status" />
          </a>
        </div>
      </footer>
    </div>
  )
}

export default App