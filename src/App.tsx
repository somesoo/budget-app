import { Navigate, Route, Routes } from 'react-router-dom'
import { BottomNav } from './components/BottomNav'
import { PersonOnboarding } from './components/PersonOnboarding'
import { SetupNotice } from './components/SetupNotice'
import { useDeviceUser } from './hooks/useDeviceUser'
import { useRealtimeSync } from './hooks/useRealtimeSync'
import { isSupabaseConfigured } from './lib/supabaseClient'
import { Home } from './pages/Home'
import { Calendar } from './pages/Calendar'
import { Summary } from './pages/Summary'
import { History } from './pages/History'
import { Settings } from './pages/Settings'

export default function App() {
  const { isChosen, setPerson } = useDeviceUser()
  useRealtimeSync()

  if (!isSupabaseConfigured) return <SetupNotice />
  if (!isChosen) return <PersonOnboarding onPick={setPerson} />

  return (
    <>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/calendar" element={<Calendar />} />
        <Route path="/summary" element={<Summary />} />
        <Route path="/history" element={<History />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <BottomNav />
    </>
  )
}
