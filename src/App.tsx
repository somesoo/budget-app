import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Navigate, Route, Routes } from 'react-router-dom'
import { BottomNav } from './components/BottomNav'
import { SideNav } from './components/SideNav'
import { Login } from './components/Login'
import { Welcome } from './components/Welcome'
import { HouseholdSetup } from './components/HouseholdSetup'
import { PersonOnboarding } from './components/PersonOnboarding'
import { SetupNotice } from './components/SetupNotice'
import { Tour } from './components/tour/Tour'
import { tourSeen, tourStore } from './lib/tour'
import { useDeviceUser } from './hooks/useDeviceUser'
import { usePeople } from './hooks/usePeople'
import { useRealtimeSync } from './hooks/useRealtimeSync'
import { useSession } from './hooks/useSession'
import { fetchSetupStatus, type SetupStatus } from './lib/account'
import { isSupabaseConfigured } from './lib/supabaseClient'
import { Home } from './pages/Home'
import { Budget } from './pages/Budget'
import { CategoryPage } from './pages/CategoryPage'
import { History } from './pages/History'
import { Settings } from './pages/Settings'
import { Savings } from './pages/Savings'
import { Ask } from './pages/Ask'
import { ProjectPage } from './pages/ProjectPage'
import { SavingsAccountPage, SavingsGoalPage } from './pages/SavingsDetail'
import { Insights } from './pages/Insights'
import { DebtPage } from './pages/DebtPage'
import { Guide } from './pages/Guide'
import { ChapterPage } from './pages/ChapterPage'
import { IncomePage } from './pages/IncomePage'
import { GuideHighlight } from './components/GuideHighlight'

export default function App() {
  const { isChosen, setPerson } = useDeviceUser()
  const { session, loading } = useSession()
  // signed out: a new install with no account yet opens on the welcome screen
  const qc = useQueryClient()
  const setupStatus = useQuery({
    queryKey: ['setup-status'],
    queryFn: fetchSetupStatus,
    enabled: isSupabaseConfigured && !loading && !session,
    staleTime: Infinity,
  })
  // who's in the budget: loaded once signed in, before anything is shown
  const people = usePeople(!!session)
  useRealtimeSync()
  const signedIn = !!session && isChosen && !people.needsSetup
  // a new device gets the tour once, right after saying whose it is
  useEffect(() => {
    if (signedIn && !tourSeen() && tourStore.get().step === null) tourStore.start('/')
  }, [signedIn])

  if (!isSupabaseConfigured) return <SetupNotice />
  // first paint restores the stored session — don't flash the login screen
  if (loading) return <div className="min-h-[100dvh] bg-ink" />
  if (!session) {
    if (setupStatus.isPending) return <div className="min-h-[100dvh] bg-ink" />
    if (setupStatus.data?.needsAccount)
      return (
        <Welcome
          onAccountExists={() =>
            qc.setQueryData<SetupStatus>(['setup-status'], { canCreate: true, needsAccount: false })
          }
        />
      )
    return <Login />
  }
  if (people.isLoading) return <div className="min-h-[100dvh] bg-ink" />
  if (people.needsSetup) return <HouseholdSetup onDone={setPerson} />
  if (!isChosen) return <PersonOnboarding onPick={setPerson} />

  return (
    <>
      <SideNav />
      <main className="lg:pl-60">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/history" element={<History />} />
          <Route path="/budget" element={<Budget />} />
          <Route path="/category/:id" element={<CategoryPage />} />
          <Route path="/savings" element={<Savings />} />
          <Route path="/ask" element={<Ask />} />
          <Route path="/project/:id" element={<ProjectPage />} />
          <Route path="/savings/account/:id" element={<SavingsAccountPage />} />
          <Route path="/savings/goal/:id" element={<SavingsGoalPage />} />
          <Route path="/debt/:id" element={<DebtPage />} />
          <Route path="/guide" element={<Guide />} />
          <Route path="/chapter/:id" element={<ChapterPage />} />
          <Route path="/income" element={<IncomePage />} />
          {/* old tabs, kept so a bookmarked or installed link still lands somewhere */}
          <Route path="/calendar" element={<Navigate to="/history" replace />} />
          <Route path="/summary" element={<Navigate to="/budget" replace />} />
          <Route path="/insights" element={<Insights />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <BottomNav />
      <Tour />
      <GuideHighlight />
    </>
  )
}
