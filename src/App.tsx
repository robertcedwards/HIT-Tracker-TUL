import './index.css'
import { ExerciseTable } from './components/ExerciseTable'
import { Exercise } from './types/Exercise'
import { Dumbbell, Info as InfoIcon, LogOut } from 'lucide-react'
import { useEffect, useState } from 'react'
import { InfoModal } from './components/InfoModal'
import { AuthComponent } from './components/Auth'
import { supabase } from './lib/supabase'
import { Session } from '@supabase/supabase-js'
import { initializeDefaultExercises, getExercises, saveSession } from './lib/database'
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom'
import { PrivacyPolicy } from './components/PrivacyPolicy'
import { Terms } from './components/Terms'

function App() {
  const [showModal, setShowModal] = useState(false)
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [session, setSession] = useState<Session | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) {
        loadExercises(session.user.id)
      }
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session) {
        loadExercises(session.user.id)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const loadExercises = async (userId: string) => {
    try {
      await initializeDefaultExercises(userId)
      const data = await getExercises(userId)
      setExercises(data)
    } catch (error) {
      console.error('Error loading exercises:', error)
    }
  }

  const saveExerciseData = async (exercise: Exercise) => {
    if (!session?.user.id || !exercise.id) return
    
    try {
      const lastSession = exercise.sessions[exercise.sessions.length - 1]
      await saveSession(exercise.id, lastSession)
      await loadExercises(session.user.id)
    } catch (error) {
      console.error('Error saving exercise data:', error)
    }
  }

  if (!session) {
    return <AuthComponent />
  }

  return (
    <Router>
      <Routes>
        <Route path="/privacy" element={<PrivacyPolicy />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/" element={
          <div className="min-h-screen bg-slate-50 p-4 flex flex-col">
            <div className="max-w-6xl mx-auto bg-white rounded-xl shadow-md p-6 flex-grow">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <Dumbbell className="w-8 h-8 text-blue-500" />
                  <h1 className="text-2xl font-bold">Hit Flow</h1>
                </div>
                <button
                  onClick={() => supabase.auth.signOut()}
                  className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  <LogOut size={20} />
                  Sign Out
                </button>
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
              <div className="mt-4 text-sm text-gray-500">
                <Link to="/privacy" className="hover:text-gray-700 mr-4">Privacy Policy</Link>
                <Link to="/terms" className="hover:text-gray-700">Terms of Service</Link>
              </div>
            </footer>
          </div>
        } />
      </Routes>
    </Router>
  )
}

export default App