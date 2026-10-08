import React, { useMemo } from 'react';
import { useSession } from '../../context/SessionContext.tsx';
import {
  X,
  ShoppingBag,
  Trash2,
  Calendar,
  Users,
  Bed,
  Compass,
  ArrowRight,
  Gift,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
} from 'lucide-react';

const QUALIFYING_PATTERNS = ['quad', 'helicopter', 'flight of angels', 'elephant', 'sunset cruise'];

export const MyTripDrawer: React.FC = () => {
  const { isMyTripOpen, closeMyTrip, tripPlan, removeFromTrip, openReservationModal } = useSession();

  // Calculate nights and qualifying activities in My Trip
  const { totalNights, qualifyingActivities, qualifiesForBridgeTour, estimatedSubtotal } = useMemo(() => {
    let nights = 0;
    let qualifyingCount = 0;
    let subtotal = 0;

    if (!tripPlan?.items) {
      return { totalNights: 0, qualifyingActivities: 0, qualifiesForBridgeTour: false, estimatedSubtotal: 0 };
    }

    for (const item of tripPlan.items) {
      const prod = item.product;
      const count = item.guestCount || 2;
      const unit = Number(item.room?.pricePerNight || prod?.basePrice || 0);

      if (prod?.productType === 'accommodation') {
        const itemNights = 2; // Default planned stay duration
        nights += itemNights;
        subtotal += unit * itemNights;
      } else {
        const name = ((prod?.name || '') + ' ' + (prod?.slug || '')).toLowerCase();
        if (
          !name.includes('bridge') &&
          !(name.includes('boat cruise') && !name.includes('sunset')) &&
          QUALIFYING_PATTERNS.some(p => name.includes(p))
        ) {
          qualifyingCount += 1;
        }
        subtotal += unit * count;
      }
    }

    const qualifies = nights >= 2 && qualifyingCount >= 2;

    return {
      totalNights: nights,
      qualifyingActivities: qualifyingCount,
      qualifiesForBridgeTour: qualifies,
      estimatedSubtotal: Math.round(subtotal * 100) / 100,
    };
  }, [tripPlan]);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeMyTrip();
      }
    };
    if (isMyTripOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMyTripOpen, closeMyTrip]);

  if (!isMyTripOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="mytrip-drawer-title"
      className="fixed inset-0 z-50 overflow-hidden bg-stone-900/60 backdrop-blur-xs flex justify-end animate-fadeIn"
    >
      <div className="bg-white w-full max-w-md h-full shadow-2xl flex flex-col justify-between border-l border-stone-200">
        {/* Drawer Header */}
        <div className="px-6 py-4 border-b border-stone-100 flex items-center justify-between bg-stone-50/50">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-amber-100 text-amber-800">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div>
              <h3 id="mytrip-drawer-title" className="font-bold text-stone-900 font-display text-lg">My Trip Plan</h3>
              <p className="text-[11px] text-stone-500">Persistent itinerary workspace</p>
            </div>
          </div>
          <button
            onClick={closeMyTrip}
            aria-label="Close My Trip drawer"
            className="p-2 rounded-full text-stone-400 hover:text-stone-700 hover:bg-stone-200/60 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Drawer Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Bridge Tour Incentive Status Box */}
          <div
            className={`p-4 rounded-2xl border transition-all ${
              qualifiesForBridgeTour
                ? 'bg-emerald-50/70 border-emerald-300 text-emerald-950'
                : 'bg-amber-50/60 border-amber-200 text-stone-800'
            }`}
          >
            <div className="flex items-start space-x-3">
              <div
                className={`p-2 rounded-xl shrink-0 ${
                  qualifiesForBridgeTour ? 'bg-emerald-600 text-white' : 'bg-amber-600 text-white'
                }`}
              >
                <Gift className="w-4 h-4" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider">
                    Historic 1905 Bridge Tour Incentive
                  </h4>
                  {qualifiesForBridgeTour ? (
                    <span className="text-[10px] font-extrabold bg-emerald-600 text-white px-2 py-0.5 rounded-full">
                      $0 REWARD UNLOCKED
                    </span>
                  ) : (
                    <span className="text-[10px] font-semibold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full">
                      IN PROGRESS
                    </span>
                  )}
                </div>

                <p className="text-xs text-stone-600 mt-1">
                  Complimentary Historic 1905 Bridge Tour when you include at least 2 nights accommodation + 2 qualifying priority activities.
                </p>

                {/* Progress Indicators */}
                <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
                  <div className="flex items-center space-x-1.5">
                    {totalNights >= 2 ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <AlertCircle className="w-3.5 h-3.5 text-stone-400" />
                    )}
                    <span className={totalNights >= 2 ? 'font-semibold text-emerald-800' : 'text-stone-500'}>
                      Accommodation: {totalNights}/2N
                    </span>
                  </div>

                  <div className="flex items-center space-x-1.5">
                    {qualifyingActivities >= 2 ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <AlertCircle className="w-3.5 h-3.5 text-stone-400" />
                    )}
                    <span
                      className={
                        qualifyingActivities >= 2 ? 'font-semibold text-emerald-800' : 'text-stone-500'
                      }
                    >
                      Priority Activities: {qualifyingActivities}/2
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Items List */}
          {!tripPlan?.items || tripPlan.items.length === 0 ? (
            <div className="text-center py-16 text-stone-400">
              <Compass className="w-12 h-12 mx-auto mb-3 text-stone-300 animate-pulse" />
              <p className="text-sm font-semibold text-stone-600">Your trip is currently empty</p>
              <p className="text-xs text-stone-400 mt-1 max-w-xs mx-auto">
                Explore verified lodges, helicopter tours, and sunset cruises to add them to your journey.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <h4 className="text-xs uppercase font-bold tracking-wider text-stone-400">
                Selected Itinerary Items ({tripPlan.items.length})
              </h4>
              {tripPlan.items.map(item => (
                <div
                  key={item.id}
                  className="bg-stone-50 p-4 rounded-2xl border border-stone-200/80 flex items-start justify-between gap-3 group hover:border-amber-400/60 transition"
                >
                  <div className="flex-1">
                    <div className="flex items-center space-x-1.5 text-[10px] text-amber-800 font-semibold uppercase">
                      {item.product?.productType === 'accommodation' ? (
                        <>
                          <Bed className="w-3 h-3 text-amber-700" />
                          <span>Lodge / Hotel</span>
                        </>
                      ) : (
                        <>
                          <Compass className="w-3 h-3 text-amber-700" />
                          <span>Experience</span>
                        </>
                      )}
                    </div>

                    <h5 className="text-sm font-bold text-stone-900 mt-0.5">
                      {item.product?.name || 'Selected Experience'}
                    </h5>

                    {item.room && (
                      <div className="text-xs text-stone-600 mt-0.5">
                        Room: <span className="font-medium text-stone-800">{item.room.name}</span>
                      </div>
                    )}

                    <div className="mt-2 flex items-center justify-between text-xs">
                      <span className="text-stone-500">
                        {item.guestCount || 2} {item.guestCount === 1 ? 'Guest' : 'Guests'}
                      </span>
                      <span className="font-bold text-amber-900 font-display">
                        US${item.room ? item.room.pricePerNight : item.product?.basePrice}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => removeFromTrip(item.id)}
                    className="p-1.5 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                    title="Remove item"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Drawer Footer */}
        <div className="p-6 border-t border-stone-100 bg-stone-50/50 space-y-3">
          <div className="flex items-center justify-between text-xs text-stone-500">
            <span>Estimated Catalog Tariff:</span>
            <span className="text-lg font-extrabold text-stone-900 font-display">
              US${estimatedSubtotal}
            </span>
          </div>

          <div className="text-[11px] text-stone-500 flex items-center">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 mr-1.5 shrink-0" />
            <span>Authoritative price validated server-side upon request.</span>
          </div>

          <button
            disabled={!tripPlan?.items || tripPlan.items.length === 0}
            onClick={() => {
              closeMyTrip();
              openReservationModal();
            }}
            className="w-full py-3.5 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:bg-stone-300 text-white font-semibold text-xs shadow-md shadow-amber-600/20 transition flex items-center justify-center cursor-pointer"
          >
            <span>Proceed to Reservation Request</span>
            <ArrowRight className="w-4 h-4 ml-1.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
