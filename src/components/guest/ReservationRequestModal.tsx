import React, { useState, useEffect } from 'react';
import { useSession } from '../../context/SessionContext.tsx';
import { api } from '../../services/api.ts';
import {
  X,
  ShieldCheck,
  Calendar,
  Users,
  CheckCircle2,
  Lock,
  ArrowRight,
  Info,
} from 'lucide-react';

interface ReservationRequestModalProps {
  onReservationSubmitted: (token: string) => void;
}

export const ReservationRequestModal: React.FC<ReservationRequestModalProps> = ({
  onReservationSubmitted,
}) => {
  const { isReservationModalOpen, closeReservationModal, tripPlan, refreshTrip } = useSession();

  const [fullName, setFullName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [country, setCountry] = useState<string>('Zimbabwe');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [adultsCount, setAdultsCount] = useState<number>(2);
  const [childrenCount, setChildrenCount] = useState<number>(0);
  const [specialRequests, setSpecialRequests] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Calculate nights from stay dates safely with calendar arithmetic
  const calculatedNights = React.useMemo(() => {
    if (!startDate || !endDate) return null;
    const partsStart = startDate.split('-').map(Number);
    const partsEnd = endDate.split('-').map(Number);
    if (partsStart.length !== 3 || partsEnd.length !== 3) return null;
    const utcIn = Date.UTC(partsStart[0], partsStart[1] - 1, partsStart[2]);
    const utcOut = Date.UTC(partsEnd[0], partsEnd[1] - 1, partsEnd[2]);
    const diffMs = utcOut - utcIn;
    if (diffMs <= 0) return null;
    return Math.round(diffMs / (1000 * 60 * 60 * 24));
  }, [startDate, endDate]);

  // Compute itemized review entries and estimated total
  const { reviewItems, estimatedTotal, bridgeIncentiveEligible } = React.useMemo(() => {
    if (!tripPlan?.items) return { reviewItems: [], estimatedTotal: 0, bridgeIncentiveEligible: false };

    let total = 0;
    let accomNights = 0;
    let qualifyingActs = 0;
    const participants = Math.max(1, adultsCount + childrenCount);

    const items = tripPlan.items.map(it => {
      const isAccom = it.product?.productType === 'accommodation';
      const variant = it.variant;
      const unitPrice = Number(variant?.price !== undefined ? variant.price : (it.room ? it.room.pricePerNight : it.product?.basePrice || 0));
      const basis = variant?.priceBasis || (it.room ? 'per_room_night' : (it.product?.priceBasis || (isAccom ? 'per_room_night' : 'per_person')));

      let subtotal = 0;
      let displayBasis = '';

      if (isAccom) {
        const nights = calculatedNights || 1;
        accomNights += nights;

        if (basis === 'per_single_room_night' || basis === 'per_room_night') {
          subtotal = unitPrice * nights;
          displayBasis = calculatedNights
            ? `${nights} nights × US$${unitPrice} (room rate)`
            : `US$${unitPrice} / room / night`;
        } else {
          // per person sharing
          subtotal = unitPrice * participants * nights;
          displayBasis = calculatedNights
            ? `${nights} nights × ${participants} guests × US$${unitPrice}`
            : `US$${unitPrice} pppn`;
        }

        // Compulsory fees (e.g. conservation levies)
        if (variant?.compulsoryFees && variant.compulsoryFees.length > 0) {
          for (const fee of variant.compulsoryFees) {
            const mult = basis === 'per_single_room_night' ? 1 : participants;
            const fTotal = Number(fee.amount || 0) * mult * nights;
            subtotal += fTotal;
          }
        }
      } else {
        if (basis === 'per_group') {
          subtotal = unitPrice;
          displayBasis = `US$${unitPrice} (per group/tour)`;
        } else {
          subtotal = unitPrice * participants;
          displayBasis = `${participants} guests × US$${unitPrice}`;
        }

        // Compulsory fees (e.g. $12 National Parks conservation fee)
        if (variant?.compulsoryFees && variant.compulsoryFees.length > 0) {
          for (const fee of variant.compulsoryFees) {
            subtotal += Number(fee.amount || 0) * participants;
          }
        }

        // Check qualifying activities for 1905 Bridge Tour incentive
        const slug = (it.product?.name + ' ' + (it.product?.slug || '')).toLowerCase();
        if (
          !slug.includes('bridge') &&
          !(slug.includes('boat cruise') && !slug.includes('sunset')) &&
          (slug.includes('flight') ||
            slug.includes('helicopter') ||
            slug.includes('quad') ||
            slug.includes('sunset') ||
            slug.includes('elephant'))
        ) {
          qualifyingActs++;
        }
      }

      total += subtotal;

      return {
        id: it.id,
        name: it.product?.name || 'Selected Experience',
        variantName: variant?.name || null,
        productType: it.product?.productType,
        roomName: it.room?.name,
        unitPrice,
        displayBasis,
        subtotal: Math.round(subtotal * 100) / 100,
      };
    });

    const bridgeIncentiveEligible = accomNights >= 2 && qualifyingActs >= 2;

    return {
      reviewItems: items,
      estimatedTotal: Math.round(total * 100) / 100,
      bridgeIncentiveEligible,
    };
  }, [tripPlan, calculatedNights, adultsCount, childrenCount]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeReservationModal();
      }
    };
    if (isReservationModalOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isReservationModalOpen, closeReservationModal]);

  if (!isReservationModalOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !email.trim()) {
      setErrorMessage('Please provide your full name and email address.');
      return;
    }

    if (!startDate || !endDate) {
      setErrorMessage('Arrival date and departure date are required for reservation requests.');
      return;
    }

    if (endDate <= startDate) {
      setErrorMessage('Departure date must be strictly after the arrival date.');
      return;
    }

    if (!tripPlan?.items || tripPlan.items.length === 0) {
      setErrorMessage('Please add at least one accommodation or experience to your trip first.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const submissionItems = tripPlan.items.map(it => ({
        productId: it.productId,
        roomId: it.roomId || undefined,
        variantId: it.variantId || undefined,
        guestCount: it.guestCount || adultsCount + childrenCount,
        scheduledDate: it.scheduledDate || startDate,
        checkOutDate: it.checkOutDate || (it.product?.productType === 'accommodation' ? endDate : undefined),
        notes: it.notes || undefined,
      }));

      const result = await api.submitReservationRequest({
        tripPlanId: tripPlan.id,
        items: submissionItems,
        fullName,
        email,
        phone,
        country,
        startDate,
        endDate,
        adultsCount,
        childrenCount,
        specialRequests,
      });

      closeReservationModal();
      await refreshTrip();
      onReservationSubmitted(result.guestToken);
    } catch (err: any) {
      console.error('Reservation error:', err);
      setErrorMessage(err.message || 'Failed to submit reservation request. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="reservation-modal-title"
      className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 animate-fadeIn"
    >
      <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-stone-200 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-stone-50 px-6 py-4 border-b border-stone-100 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-amber-600 text-white">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 id="reservation-modal-title" className="font-bold text-stone-900 font-display text-lg">
                Submit Reservation Request
              </h3>
              <p className="text-[11px] text-stone-500">
                Victoria Falls Partner Confirmation Workflow
              </p>
            </div>
          </div>
          <button
            onClick={closeReservationModal}
            aria-label="Close reservation request modal"
            className="p-2 rounded-full text-stone-400 hover:text-stone-700 hover:bg-stone-200/60 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Commercial Trust Banner */}
        <div className="bg-amber-50/70 border-b border-amber-200/60 px-6 py-3 text-xs text-amber-950 flex items-start space-x-2.5">
          <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold">No payment is required to submit this request.</span>{' '}
            Requests are verified directly by our Victoria Falls Reservations Desk with local partner operators before confirmation.
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-6">
          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-medium">
              {errorMessage}
            </div>
          )}

          {/* Contact Details */}
          <div className="space-y-4">
            <h4 className="text-xs uppercase font-bold tracking-wider text-stone-400">
              Lead Traveler Details
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  placeholder="e.g. Tendai Moyo"
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-stone-200 focus:outline-hidden focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Email Address *
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="e.g. tendai@example.com"
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-stone-200 focus:outline-hidden focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Phone / WhatsApp
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="+263 77..."
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-stone-200 focus:outline-hidden focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Country of Residence
                </label>
                <input
                  type="text"
                  value={country}
                  onChange={e => setCountry(e.target.value)}
                  placeholder="Zimbabwe / South Africa / UK"
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-stone-200 focus:outline-hidden focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                />
              </div>
            </div>
          </div>

          {/* Travel Dates & Party */}
          <div className="space-y-4 pt-4 border-t border-stone-100">
            <h4 className="text-xs uppercase font-bold tracking-wider text-stone-400">
              Trip Dates & Party
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Arrival (Check-in) *
                </label>
                <input
                  type="date"
                  required
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 focus:outline-hidden focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Departure (Check-out) *
                </label>
                <input
                  type="date"
                  required
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 focus:outline-hidden focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">Adults</label>
                <input
                  type="number"
                  min="1"
                  value={adultsCount}
                  onChange={e => setAdultsCount(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">Children</label>
                <input
                  type="number"
                  min="0"
                  value={childrenCount}
                  onChange={e => setChildrenCount(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 focus:outline-hidden"
                />
              </div>
            </div>
          </div>

          {/* Special Requests */}
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Dietary, Room, or Special Requests
            </label>
            <textarea
              rows={2}
              value={specialRequests}
              onChange={e => setSpecialRequests(e.target.value)}
              placeholder="e.g. Vegetarian dining, river view request, celebration occasion..."
              className="w-full px-3.5 py-2 text-xs rounded-xl border border-stone-200 focus:outline-hidden focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
            />
          </div>

          {/* Itemized Request Review Breakdown */}
          <div className="bg-stone-50 p-4 sm:p-5 rounded-2xl border border-stone-200/80 space-y-3">
            <div className="flex items-center justify-between border-b border-stone-200 pb-2 text-xs">
              <span className="font-bold uppercase tracking-wider text-stone-700">
                Itemized Itinerary Review ({reviewItems.length} {reviewItems.length === 1 ? 'item' : 'items'})
              </span>
              <span className="text-[11px] font-semibold text-stone-500">
                {calculatedNights ? `${calculatedNights} nights stay` : 'Stay dates: Required'}
              </span>
            </div>

            {/* List of items */}
            <div className="space-y-2 max-h-56 overflow-y-auto pr-1 text-xs divide-y divide-stone-100">
              {reviewItems.map(item => (
                <div key={item.id} className="pt-2 first:pt-0 flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="font-bold text-stone-900">{item.name}</div>
                    {item.variantName && (
                      <div className="text-[11px] text-amber-800 font-medium">Option: {item.variantName}</div>
                    )}
                    {item.roomName && (
                      <div className="text-[11px] text-stone-600">Room: {item.roomName}</div>
                    )}
                    <div className="text-[10px] text-stone-500">{item.displayBasis}</div>
                  </div>
                  <div className="font-bold text-amber-900 font-display shrink-0">
                    US${item.subtotal}
                  </div>
                </div>
              ))}
            </div>

            {/* 1905 Historic Bridge Tour Incentive Status */}
            {bridgeIncentiveEligible && (
              <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-xs text-emerald-950 font-medium">
                <span className="flex items-center">
                  <ShieldCheck className="w-4 h-4 mr-1.5 text-emerald-600 shrink-0" />
                  <span>Priority Stay Qualified (2+ Nights & 2+ Priority Activities)</span>
                </span>
                <span className="font-bold text-emerald-800 font-display">Priority Desk Review</span>
              </div>
            )}

            {/* Total Tariff */}
            <div className="pt-3 border-t border-stone-200 flex items-baseline justify-between text-xs">
              <div>
                <span className="font-semibold text-stone-700">Estimated Catalog Tariff:</span>
                <p className="text-[10px] text-stone-400">Validated server-side; final confirmation issued by Desk.</p>
              </div>
              <span className="text-xl font-extrabold text-stone-900 font-display">
                US${estimatedTotal}
              </span>
            </div>
          </div>

          {/* Submit CTA */}
          <div className="pt-2 flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={closeReservationModal}
              className="px-4 py-2 text-xs font-semibold text-stone-600 hover:text-stone-900 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-3 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:bg-stone-300 text-white font-semibold text-xs shadow-md shadow-amber-600/30 transition flex items-center cursor-pointer"
            >
              {isSubmitting ? (
                <span>Submitting to Desk...</span>
              ) : (
                <>
                  <span>Send Request to Reservations Desk</span>
                  <ArrowRight className="w-4 h-4 ml-1.5" />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
