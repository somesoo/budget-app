import { Navigate, Route, Routes } from 'react-router-dom'
import { BottomNav } from './components/BottomNav'
import { Login } from './components/Login'
import { PersonOnboarding } from './components/PersonOnboarding'
import { SetupNotice } from './components/SetupNotice'
import { useDeviceUser } from './hooks/useDeviceUser'
import { useRealtimeSync } from './hooks/useRealtimeSync'
import { useSession } from './hooks/useSession'
import { isSupabaseConfigured } from './lib/supabaseClient'
import { Home } from './pages/Home'
import { Budget } from './pages/Budget'
import { History } from './pages/History'
import { Settings } from './pages/Settings'
import { Insights } from './pages/Insights'

export default function App() {
  const { isChosen, setPerson } = useDeviceUser()
  const { session, loading } = useSession()
  useRealtimeSync()

  if (!isSupabaseConfigured) return <SetupNotice />
  // first paint restores the stored session — don't flash the login screen
  if (loading) return <div className="min-h-[100dvh] bg-ink" />
  if (!session) return <Login />
  if (!isChosen) return <PersonOnboarding onPick={setPerson} />

  return (
    <>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/history" element={<History />} />
        <Route path="/budget" element={<Budget />} />
        {/* old tabs, kept so a bookmarked or installed link still lands somewhere */}
        <Route path="/calendar" element={<Navigate to="/history" replace />} />
        <Route path="/summary" element={<Navigate to="/budget" replace />} />
        <Route path="/insights" element={<Insights />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <BottomNav />
    </>
  )
}
