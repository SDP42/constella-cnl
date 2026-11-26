import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { homeFor, useAuth } from '@/lib/auth'
import { AppShell } from './AppShell'
import { Loading } from './kit'

const Inbox = lazy(() => import('./pages/Inbox'))
const Command = lazy(() => import('./pages/Command'))
const Accounts = lazy(() => import('./pages/Accounts'))
const AccountTwin = lazy(() => import('./pages/AccountTwin'))
const Solutions = lazy(() => import('./pages/Solutions'))
const Insights = lazy(() => import('./pages/Insights'))
const Brands = lazy(() => import('./pages/Brands'))
const Graph = lazy(() => import('./pages/Graph'))
const ModelLab = lazy(() => import('./pages/ModelLab'))
const Pilot = lazy(() => import('./pages/Pilot'))
const Automation = lazy(() => import('./pages/Automation'))
const DataUnifier = lazy(() => import('./pages/DataUnifier'))
const Security = lazy(() => import('./pages/Security'))
const Partner = lazy(() => import('./pages/Partner'))
const CreditCash = lazy(() => import('./pages/CreditCash'))
const DealDesk = lazy(() => import('./pages/DealDesk'))
const Annuity = lazy(() => import('./pages/Annuity'))
const GrowthLab = lazy(() => import('./pages/GrowthLab'))
const OpsHub = lazy(() => import('./pages/OpsHub'))
const TeamHub = lazy(() => import('./pages/TeamHub'))
const DataTrust = lazy(() => import('./pages/DataTrust'))
const Territory = lazy(() => import('./pages/Territory'))
const SiteTwin = lazy(() => import('./pages/SiteTwin'))
const Learning = lazy(() => import('./pages/Learning'))
const Scorecard = lazy(() => import('./pages/Scorecard'))
const BeatPlan = lazy(() => import('./pages/BeatPlan'))
const Collections = lazy(() => import('./pages/Collections'))

export default function AppRoutes() {
  const user = useAuth((s) => s.user)
  if (!user) return <Navigate to="/#seats" replace />
  const fallback = <div className="p-8"><Loading rows={6} /></div>
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Navigate to={homeFor(user.role)} replace />} />
        {[
          ['inbox', <Inbox />], ['command', <Command />], ['accounts', <Accounts />], ['accounts/:id', <AccountTwin />],
          ['solutions', <Solutions />], ['insights', <Insights />], ['brands', <Brands />], ['graph', <Graph />],
          ['model', <ModelLab />], ['pilot', <Pilot />], ['automation', <Automation />], ['data', <DataUnifier />],
          ['security', <Security />], ['partner', <Partner />], ['credit', <CreditCash />], ['dealdesk', <DealDesk />], ['annuity', <Annuity />], ['growth', <GrowthLab />], ['ops', <OpsHub />], ['team', <TeamHub />], ['trust', <DataTrust />], ['territory', <Territory />], ['site/:id', <SiteTwin />], ['learning', <Learning />], ['scorecard', <Scorecard />], ['beat', <BeatPlan />], ['collections', <Collections />],
        ].map(([path, el]) => (
          <Route key={path as string} path={path as string} element={<Suspense fallback={fallback}>{el}</Suspense>} />
        ))}
        <Route path="*" element={<Navigate to={homeFor(user.role)} replace />} />
      </Route>
    </Routes>
  )
}
