import React, { useState, useEffect } from 'react';
import { SessionProvider, useSession } from './context/SessionContext.tsx';
import { CoordinatorAuthProvider } from './context/CoordinatorAuthContext.tsx';
import { Navbar } from './components/shared/Navbar.tsx';
import { Footer } from './components/shared/Footer.tsx';
import { ExploreView } from './components/guest/ExploreView.tsx';
import { PackagesView } from './components/guest/PackagesView.tsx';
import { ProductDetailModal } from './components/guest/ProductDetailModal.tsx';
import { MyTripDrawer } from './components/guest/MyTripDrawer.tsx';
import { ReservationRequestModal } from './components/guest/ReservationRequestModal.tsx';
import { GuestReservationDashboard } from './components/guest/GuestReservationDashboard.tsx';
import { SchoolTripPlannerModal } from './components/guest/SchoolTripPlannerModal.tsx';
import { SyntucAssistantWidget } from './components/guest/SyntucAssistantWidget.tsx';
import { CoordinatorPortal } from './components/coordinator/CoordinatorPortal.tsx';
import { CheckCircle2 } from 'lucide-react';
import { initAnalyticsSession, trackEvent } from './services/analytics.ts';

function MainAppContent() {
  const { activeTab, toastMessage } = useSession();

  // Initialize analytics session and track first page load
  useEffect(() => {
    initAnalyticsSession();
    trackEvent({ eventType: 'PAGE_VIEWED', route: window.location.pathname });
  }, []);

  // Route state
  const [currentRoute, setCurrentRoute] = useState<{
    path: string;
    guestToken?: string;
  }>(() => {
    const path = window.location.pathname;
    if (path.startsWith('/guest/reservation/')) {
      const token = path.replace('/guest/reservation/', '');
      return { path: '/guest/reservation', guestToken: token };
    }
    if (path === '/coordinator') {
      return { path: '/coordinator' };
    }
    return { path: '/' };
  });

  // Handle browser back/forward buttons
  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname;
      if (path.startsWith('/guest/reservation/')) {
        const token = path.replace('/guest/reservation/', '');
        setCurrentRoute({ path: '/guest/reservation', guestToken: token });
      } else if (path === '/coordinator') {
        setCurrentRoute({ path: '/coordinator' });
      } else {
        setCurrentRoute({ path: '/' });
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigateTo = (path: string, guestToken?: string) => {
    if (path.startsWith('/guest/reservation') && guestToken) {
      window.history.pushState({}, '', `/guest/reservation/${guestToken}`);
      setCurrentRoute({ path: '/guest/reservation', guestToken });
    } else if (path === '/coordinator') {
      window.history.pushState({}, '', '/coordinator');
      setCurrentRoute({ path: '/coordinator' });
    } else {
      window.history.pushState({}, '', '/');
      setCurrentRoute({ path: '/' });
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF8F5] text-stone-900 selection:bg-amber-100 selection:text-amber-900 font-sans">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 bg-stone-900 text-white px-4 py-3 rounded-2xl shadow-xl border border-stone-800 flex items-center space-x-2 text-xs font-medium animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Main Header / Navigation */}
      <Navbar
        onOpenCoordinator={() => navigateTo('/coordinator')}
        isCoordinatorView={currentRoute.path === '/coordinator'}
        onExitCoordinator={() => navigateTo('/')}
      />

      {/* View Routing */}
      <main className="flex-1">
        {currentRoute.path === '/coordinator' ? (
          <CoordinatorPortal
            onBackToExplorer={() => navigateTo('/')}
            onOpenGuestDashboard={(token: string) => navigateTo('/guest/reservation', token)}
          />
        ) : currentRoute.path === '/guest/reservation' && currentRoute.guestToken ? (
          <GuestReservationDashboard
            token={currentRoute.guestToken}
            onBackToExplore={() => navigateTo('/')}
          />
        ) : (
          <>
            {activeTab === 'packages' ? <PackagesView /> : <ExploreView />}
            {/* Digital Guide Chat Widget */}
            <SyntucAssistantWidget />
          </>
        )}
      </main>

      {/* Footer */}
      {currentRoute.path !== '/coordinator' && <Footer />}

      {/* Global Modals & Drawers */}
      <ProductDetailModal />
      <MyTripDrawer />
      <ReservationRequestModal
        onReservationSubmitted={(guestToken: string) => {
          navigateTo('/guest/reservation', guestToken);
        }}
      />
      <SchoolTripPlannerModal />
    </div>
  );
}

export default function App() {
  return (
    <CoordinatorAuthProvider>
      <SessionProvider>
        <MainAppContent />
      </SessionProvider>
    </CoordinatorAuthProvider>
  );
}
