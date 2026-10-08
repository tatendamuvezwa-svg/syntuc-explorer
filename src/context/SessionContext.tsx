import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { TripPlan, Product } from '../types/index.ts';
import { api } from '../services/api.ts';
import { trackEvent } from '../services/analytics.ts';

interface SessionContextType {
  sessionId: string | null;
  tripPlan: TripPlan | null;
  loadingTrip: boolean;
  cartCount: number;
  refreshTrip: () => Promise<void>;
  addToTrip: (item: {
    productId: string;
    roomId?: string;
    variantId?: string;
    guestCount?: number;
    notes?: string;
  }) => Promise<void>;
  removeFromTrip: (itemId: string) => Promise<void>;
  // Active Modals & Navigation
  activeTab: 'explore' | 'packages' | 'school-trips';
  setActiveTab: (tab: 'explore' | 'packages' | 'school-trips') => void;
  selectedProductId: string | null;
  openProductDetail: (productId: string) => void;
  closeProductDetail: () => void;
  isMyTripOpen: boolean;
  openMyTrip: () => void;
  closeMyTrip: () => void;
  isReservationModalOpen: boolean;
  openReservationModal: () => void;
  closeReservationModal: () => void;
  isSchoolPlannerOpen: boolean;
  openSchoolPlanner: () => void;
  closeSchoolPlanner: () => void;
  toastMessage: string | null;
  showToast: (msg: string) => void;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export const SessionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [sessionId, setSessionId] = useState<string | null>(() => localStorage.getItem('syntuc_guest_session_id'));
  const [tripPlan, setTripPlan] = useState<TripPlan | null>(null);
  const [loadingTrip, setLoadingTrip] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'explore' | 'packages' | 'school-trips'>('explore');
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [isMyTripOpen, setIsMyTripOpen] = useState<boolean>(false);
  const [isReservationModalOpen, setIsReservationModalOpen] = useState<boolean>(false);
  const [isSchoolPlannerOpen, setIsSchoolPlannerOpen] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  }, []);

  const refreshTrip = useCallback(async () => {
    try {
      const plan = await api.getTripPlan();
      setTripPlan(plan);
    } catch (err) {
      console.error('Failed to load trip plan:', err);
    } finally {
      setLoadingTrip(false);
    }
  }, []);

  useEffect(() => {
    async function init() {
      try {
        const sessionData = await api.initSession();
        setSessionId(sessionData.sessionId);
        await refreshTrip();
      } catch (err) {
        console.error('Session init error:', err);
        setLoadingTrip(false);
      }
    }
    init();
  }, [refreshTrip]);

  const addToTrip = async (item: {
    productId: string;
    roomId?: string;
    variantId?: string;
    guestCount?: number;
    notes?: string;
  }) => {
    try {
      const res = await api.addTripItem(item);
      showToast(res.message || 'Added to My Trip');
      trackEvent({ eventType: 'TRIP_ITEM_ADDED', productId: item.productId });
      await refreshTrip();
    } catch (err: any) {
      showToast(err.message || 'Could not add to trip');
    }
  };

  const removeFromTrip = async (itemId: string) => {
    try {
      await api.removeTripItem(itemId);
      showToast('Item removed from trip');
      trackEvent({ eventType: 'TRIP_ITEM_REMOVED' });
      await refreshTrip();
    } catch (err: any) {
      showToast('Failed to remove item');
    }
  };

  const cartCount = tripPlan?.items?.length || 0;

  return (
    <SessionContext.Provider
      value={{
        sessionId,
        tripPlan,
        loadingTrip,
        cartCount,
        refreshTrip,
        addToTrip,
        removeFromTrip,
        activeTab,
        setActiveTab: (tab) => {
          setActiveTab(tab);
          if (tab === 'packages') {
            trackEvent({ eventType: 'PACKAGE_VIEWED' });
          }
        },
        selectedProductId,
        openProductDetail: (id: string) => {
          setSelectedProductId(id);
          trackEvent({ eventType: 'PRODUCT_VIEWED', productId: id });
        },
        closeProductDetail: () => setSelectedProductId(null),
        isMyTripOpen,
        openMyTrip: () => {
          setIsMyTripOpen(true);
          trackEvent({ eventType: 'ITINERARY_VIEWED' });
        },
        closeMyTrip: () => setIsMyTripOpen(false),
        isReservationModalOpen,
        openReservationModal: () => {
          setIsReservationModalOpen(true);
          trackEvent({ eventType: 'BOOKING_STARTED' });
        },
        closeReservationModal: () => setIsReservationModalOpen(false),
        isSchoolPlannerOpen,
        openSchoolPlanner: () => setIsSchoolPlannerOpen(true),
        closeSchoolPlanner: () => setIsSchoolPlannerOpen(false),
        toastMessage,
        showToast,
      }}
    >
      {children}
    </SessionContext.Provider>
  );
};

export const useSession = () => {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error('useSession must be used within SessionProvider');
  }
  return context;
};
