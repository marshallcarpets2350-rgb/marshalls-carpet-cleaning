import { useEffect, lazy, Suspense } from 'react'
import type { ReactNode } from 'react'
import { Routes, Route, Navigate, useSearchParams, useLocation } from 'react-router'
import Home from './pages/Home'
import Quote from './pages/Quote'
import Flood from './pages/Flood'
import Rugs from './pages/Rugs'
import Lounge from './pages/Lounge'
// Admin is ~170 KB of dashboard code no customer ever needs — lazy chunk,
// downloaded only when someone actually opens /admin.
const Admin = lazy(() => import('./pages/Admin'))
import Thanks from './pages/Thanks'
import Unsubscribe from './pages/Unsubscribe'
import Terms from './pages/Terms'
import { SectionPage, ContactPage } from './pages/sections'
import { TownPage } from './pages/seo/TownPage'
import { EndOfLeasePage, PetUrinePage, CostGuidePage } from './pages/seo/IntentPages'
import { CommercialPage } from './pages/seo/CommercialPage'
import Services from './sections/Services'
import Areas from './sections/Areas'
import Faq from './sections/Faq'
import Gallery from './sections/Gallery'
import Reviews from './sections/Reviews'
import { usePageMeta } from './lib/usePageMeta'

// Per-route title/description/canonical — without this every page shows the
// homepage title to Google and in the browser tab.
function PageMeta({ title, description, path, children }: { title: string; description: string; path: string; children: ReactNode }) {
  usePageMeta(title, description, path)
  return <>{children}</>
}

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
      <Route path="/quote" element={<PageMeta title="Carpet Cleaning Quote Armidale — Live Price in 60 Seconds | Marshall's" description="Build your carpet cleaning quote online — the final price moves on screen as you answer, before you book. Armidale, Uralla, Guyra, Walcha and the New England." path="/quote"><Quote /></PageMeta>} />
      <Route path="/flood" element={<PageMeta title="24/7 Flood & Water Damage Help Armidale | Marshall's Carpet Cleaning" description="Burst pipe, storm water or a flooded room? Water extraction, structural drying and insurer-ready reports across Armidale & the New England — the 24/7 number in four quick answers." path="/flood"><Flood /></PageMeta>} />
      <Route path="/rugs" element={<PageMeta title="Rug Pick-Up & Clean Armidale — Collected Friday, Back Monday | Marshall's" description="Rugs collected from your door Friday 3–5pm, washed and dried at our premises, back on your floor Monday. Free pickup in Armidale, 10% off three or more rugs." path="/rugs"><Rugs /></PageMeta>} />
      <Route path="/lounge" element={<PageMeta title="Lounge, Mattress & Upholstery Cleaning Armidale | Marshall's" description="Lounges priced per seat with three soiling levels, mattresses in every size — build the quote online and see the price before we knock." path="/lounge"><Lounge /></PageMeta>} />
      <Route path="/furnishings" element={<FurnishingsRedirect />} />
      <Route path="/services" element={<PageMeta title="Our Services — Carpet, Rugs, Lounges, Mattresses & Flood | Marshall's Armidale" description="Everything Marshall's Carpet Cleaning does across Armidale & the New England: hot water extraction carpet cleaning, rug pick-up, lounge and mattress cleaning, and 24/7 flood response." path="/services"><SectionPage><Services /></SectionPage></PageMeta>} />
      <Route path="/work" element={<PageMeta title="Before & After — Recent Carpet Cleaning Work in Armidale | Marshall's" description="Real jobs from around Armidale & the New England — drag the slider on our before/after photos and see the difference a hot water extraction clean makes." path="/work"><SectionPage><Gallery /></SectionPage></PageMeta>} />
      <Route path="/reviews" element={<PageMeta title="Customer Reviews — Marshall's Carpet Cleaning Armidale" description="What Armidale says about Marshall's Carpet Cleaning — live Google reviews, updated weekly, straight from the source." path="/reviews"><SectionPage><Reviews /></SectionPage></PageMeta>} />
      <Route path="/areas" element={<PageMeta title="Service Areas & Travel Fees — Armidale, Uralla, Guyra, Walcha | Marshall's" description="Based in Armidale, on the road across the New England. Travel priced by road distance — free in Armidale, then $1 per km each way, shown in your quote before you book." path="/areas"><SectionPage><Areas /></SectionPage></PageMeta>} />
      <Route path="/carpet-cleaning-uralla" element={<TownPage slug="carpet-cleaning-uralla" />} />
      <Route path="/carpet-cleaning-guyra" element={<TownPage slug="carpet-cleaning-guyra" />} />
      <Route path="/carpet-cleaning-walcha" element={<TownPage slug="carpet-cleaning-walcha" />} />
      <Route path="/end-of-lease-carpet-cleaning-armidale" element={<EndOfLeasePage />} />
      <Route path="/pet-urine-carpet-cleaning-armidale" element={<PetUrinePage />} />
      <Route path="/carpet-cleaning-cost-armidale" element={<CostGuidePage />} />
      <Route path="/commercial-carpet-cleaning-armidale" element={<CommercialPage />} />
      <Route path="/faq" element={<PageMeta title="Carpet Cleaning FAQ — Drying Times, Stains, Travel Fees | Marshall's Armidale" description="The questions Armidale asks every week: how long carpets take to dry, whether steam cleaning voids warranties, pet stains, travel fees and commercial work." path="/faq"><SectionPage><Faq /></SectionPage></PageMeta>} />
      <Route path="/contact" element={<PageMeta title="Contact Marshall's Carpet Cleaning — Armidale NSW | 0423 581 223" description="Call, text or email Marshall's Carpet Cleaning in Armidale — you'll talk to the person who'll be doing the clean, seven days a week." path="/contact"><ContactPage /></PageMeta>} />
      <Route path="/admin" element={<Suspense fallback={<div className="flex min-h-dvh items-center justify-center font-display text-xl font-black text-charcoal">Loading the dashboard…</div>}><Admin /></Suspense>} />
      <Route path="/thanks" element={<PageMeta title="Booked In — Thank You | Marshall's Carpet Cleaning" description="Thanks for booking with Marshall's Carpet Cleaning — your clean is in the schedule and the confirmation email is on its way." path="/thanks"><Thanks /></PageMeta>} />
      <Route path="/unsubscribe" element={<Unsubscribe />} />
      <Route path="/terms" element={<PageMeta title="Terms & Conditions | Marshall's Carpet Cleaning Armidale" description="The terms every Marshall's Carpet Cleaning booking works by — pricing, access, drying, stains and liability, in plain English." path="/terms"><Terms /></PageMeta>} />
      <Route path="*" element={<Home />} />
    </Routes>
    </>
  )
}
