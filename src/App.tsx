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
          <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
            <div className="max-w-6xl mx-auto p-6">
              {/* Header */}
              <div className="bg-white rounded-3xl shadow-lg shadow-blue-100 p-6 mb-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 rounded-xl">
                      <Dumbbell className="w-8 h-8 text-blue-500" />
                    </div>
                    <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-500 to-purple-500">
                      Hit Flow
                    </h1>
                  </div>
                  <button
                    onClick={() => supabase.auth.signOut()}
                    className="flex items-center gap-2 px-6 py-3 text-gray-600 hover:bg-gray-50 rounded-2xl transition-colors"
                  >
                    <LogOut size={20} />
                    Sign Out
                  </button>
                </div>
              </div>

              {/* Main Content */}
              <div className="bg-white rounded-3xl shadow-lg shadow-blue-100 p-6 mb-6">
                <ExerciseTable 
                  exercises={exercises}
                  onSaveExercise={saveExerciseData}
                />
              </div>

              {showModal && <InfoModal onClose={() => setShowModal(false)} />}

              {/* Footer */}
              <footer className="bg-white rounded-3xl shadow-lg shadow-blue-100 p-6">
                <div className="flex flex-col items-center gap-4">
                  <button 
                    onClick={() => setShowModal(true)} 
                    className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-2xl hover:opacity-90 transition-opacity"
                  >
                    <InfoIcon size={20} />
                    More Info
                  </button>
                  <div className="flex gap-6 text-sm">
                    <Link to="/privacy" className="text-gray-600 hover:text-gray-800 transition-colors">
                      Privacy Policy
                    </Link>
                    <Link to="/terms" className="text-gray-600 hover:text-gray-800 transition-colors">
                      Terms of Service
                    </Link>
                  </div>
                </div>
              </footer>
            </div>
          </div>
        } />
      </Routes>
    </Router>
  )
}

export default App