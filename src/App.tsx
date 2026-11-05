import { useEffect } from 'react'
import { Routes, Route, Navigate, useSearchParams, useLocation } from 'react-router'
import Home from './pages/Home'
import Quote from './pages/Quote'
import Flood from './pages/Flood'
import Rugs from './pages/Rugs'
import Lounge from './pages/Lounge'
import Admin from './pages/Admin'
import Unsubscribe from './pages/Unsubscribe'
import Terms from './pages/Terms'
import { SectionPage, ContactPage } from './pages/sections'
import { TownPage } from './pages/seo/TownPage'
import { EndOfLeasePage, PetUrinePage } from './pages/seo/IntentPages'
import Services from './sections/Services'
import Areas from './sections/Areas'
import Faq from './sections/Faq'
import Gallery from './sections/Gallery'

// Old /furnishings links keep working: rug entries go to /rugs, the rest to /lounge.
function FurnishingsRedirect() {
  const [params] = useSearchParams()
  if (params.get('rugs') || params.get('service') === 'rugs') {
    return <Navigate to="/rugs" replace />
  }
  const svc = params.get('service')
  return <Navigate to={svc ? `/lounge?service=${svc}` : '/lounge'} replace />
}

// Every page change starts at the top — no landing halfway down the quote.
function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  return null
}

export default function App() {
  return (
    <>
    <ScrollToTop />
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/quote" element={<Quote />} />
      <Route path="/flood" element={<Flood />} />
      <Route path="/rugs" element={<Rugs />} />
      <Route path="/lounge" element={<Lounge />} />
      <Route path="/furnishings" element={<FurnishingsRedirect />} />
      <Route path="/services" element={<SectionPage><Services /></SectionPage>} />
      <Route path="/work" element={<SectionPage><Gallery /></SectionPage>} />
      <Route path="/areas" element={<SectionPage><Areas /></SectionPage>} />
      <Route path="/carpet-cleaning-uralla" element={<TownPage slug="carpet-cleaning-uralla" />} />
      <Route path="/carpet-cleaning-guyra" element={<TownPage slug="carpet-cleaning-guyra" />} />
      <Route path="/carpet-cleaning-walcha" element={<TownPage slug="carpet-cleaning-walcha" />} />
      <Route path="/end-of-lease-carpet-cleaning-armidale" element={<EndOfLeasePage />} />
      <Route path="/pet-urine-carpet-cleaning-armidale" element={<PetUrinePage />} />
      <Route path="/faq" element={<SectionPage><Faq /></SectionPage>} />
      <Route path="/contact" element={<ContactPage />} />
      <Route path="/admin" element={<Admin />} />
      <Route path="/unsubscribe" element={<Unsubscribe />} />
      <Route path="/terms" element={<Terms />} />
      <Route path="*" element={<Home />} />
    </Routes>
    </>
  )
}
