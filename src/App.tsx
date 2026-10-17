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
    <div className="min-h-screen flex flex-col bg-[#FBFAF7] text-[#29342D] selection:bg-[#DCE7D8] selection:text-[#20372B] font-sans">
      {/* Toast Notification */}
      {toastMessage && (
        <div role="status" aria-live="polite" className="fixed left-4 right-4 top-24 z-50 mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-[#D8E3D5] bg-white px-4 py-3 text-sm font-medium text-[#263B30] shadow-[0_12px_36px_rgba(38,59,48,0.14)] sm:left-auto sm:right-6">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-[#54775A]" />
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
