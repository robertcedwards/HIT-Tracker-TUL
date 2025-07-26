import './index.css'
import { ExerciseTable } from './components/ExerciseTable'
import { Exercise } from './types/Exercise'
import { Dumbbell, Info as InfoIcon, LogOut, User } from 'lucide-react'
import { useEffect, useState } from 'react'
import { InfoModal } from './components/InfoModal'
import { AuthComponent } from './components/Auth'
import { supabase } from './lib/supabase'
import { Session } from '@supabase/supabase-js'
import { getExercises, saveSession } from './lib/database'
import { BrowserRouter as Router, Routes, Route, Link} from 'react-router-dom'
import { PrivacyPolicy } from './components/PrivacyPolicy'
import { Terms } from './components/Terms'
import { ProfilePage } from './components/ProfilePage'
import { WeightUnitProvider } from './contexts/WeightUnitContext'
import { SupplementTracker } from './components/SupplementTracker';

function App() {
  const [showModal, setShowModal] = useState(false)
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [session, setSession] = useState<Session | null>(null)
  const [initialized, setInitialized] = useState(false)
  const [view, setView] = useState<'exercises' | 'supplements'>('exercises');

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session && !initialized) {
        loadExercises(session.user.id, true)
        setInitialized(true)
      }
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session) {
        loadExercises(session.user.id, false)
      }
    })

    return () => subscription.unsubscribe()
  }, [initialized])

  const loadExercises = async (userId: string, shouldInitialize: boolean) => {
    try {
      const data = await getExercises(userId, shouldInitialize)
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
      await loadExercises(session.user.id, false)
    } catch (error) {
      console.error('Error saving exercise data:', error)
    }
  }

  return (
    <WeightUnitProvider>
      <Router>
        <Routes>
          <Route path="/privacy" element={
            session ? <PrivacyPolicy /> : <AuthWrapper><PrivacyPolicy /></AuthWrapper>
          } />
          <Route path="/terms" element={
            session ? <Terms /> : <AuthWrapper><Terms /></AuthWrapper>
          } />
          <Route path="/profile" element={
            session ? <ProfilePage /> : <AuthComponent />
          } />
          <Route path="/supplements" element={
            session ? <SupplementTracker /> : <AuthComponent />
          } />
          <Route path="/" element={
            session ? (
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
                      <div className="flex items-center gap-3">
                        <Link
                          to="/supplements"
                          className="flex items-center gap-2 px-6 py-3 text-gray-600 hover:bg-gray-50 rounded-2xl transition-colors"
                        >
                          Supplements
                        </Link>
                        <Link
                          to="/profile"
                          className="flex items-center gap-2 px-6 py-3 text-gray-600 hover:bg-gray-50 rounded-2xl transition-colors"
                        >
                          <User size={20} />
                          Profile
                        </Link>
                        <button
                          onClick={() => supabase.auth.signOut()}
                          className="flex items-center gap-2 px-6 py-3 text-gray-600 hover:bg-gray-50 rounded-2xl transition-colors"
                        >
                          <LogOut size={20} />
                          Sign Out
                        </button>
                      </div>
                    </div>
                  </div>
                  {/* Main Content */}
                  {view === 'exercises' && (
                    <div className="bg-white rounded-3xl shadow-lg shadow-blue-100 p-6 mb-6">
                      <ExerciseTable 
                        exercises={exercises}
                        onSaveExercise={saveExerciseData}
                      />
                    </div>
                  )}

                  {showModal && <InfoModal onClose={() => setShowModal(false)} />}

                  {/* Footer */}
                  <footer className="bg-white rounded-3xl shadow-lg shadow-blue-100 p-6">
                    <div className="flex flex-col items-center gap-4">
                      <button 
                        onClick={() => setShowModal(true)} 
                        className="flex items-center gap-2 px-6 py-3 bg-blue-700 text-white rounded-2xl hover:bg-blue-800 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-colors"
                      >
                        <InfoIcon size={20} />
                        More Info
                      </button>
                      <div className="flex gap-6 text-sm">
                        <Link to="/privacy" className="text-gray-700 hover:text-gray-900 hover:underline focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-md px-2 py-1 transition-colors">
                          Privacy Policy
                        </Link>
                        <Link to="/terms" className="text-gray-700 hover:text-gray-900 hover:underline focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-md px-2 py-1 transition-colors">
                          Terms of Service
                        </Link>
                      </div>
                    </div>
                  </footer>
                </div>
              </div>
            ) : (
              <AuthComponent />
            )
          } />
        </Routes>
      </Router>
    </WeightUnitProvider>
  );
}

// Wrapper component to maintain auth layout for policy pages
function AuthWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white p-6">
      <div className="max-w-3xl mx-auto">
        <div className="mb-8 text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Dumbbell className="w-10 h-10 text-blue-500" />
            <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-500 to-purple-500">
              Hit Flow
            </h1>
          </div>
        </div>
        {children}
        <div className="mt-8 text-center">
          <Link 
            to="/"
            className="text-blue-500 hover:text-blue-600"
          >
            ← Back to Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}

export default App