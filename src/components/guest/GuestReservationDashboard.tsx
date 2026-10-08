import React, { useState, useEffect } from 'react';
import { api } from '../../services/api.ts';
import {
  ShieldCheck,
  CheckCircle2,
  Clock,
  MapPin,
  Send,
  MessageSquare,
  Gift,
  AlertCircle,
  ArrowLeft,
  Calendar,
  Users,
} from 'lucide-react';
import { ReservationItem, GuestMessage } from '../../types/index.ts';

interface GuestReservationDashboardProps {
  token: string;
  onBackToExplore: () => void;
}

export const GuestReservationDashboard: React.FC<GuestReservationDashboardProps> = ({
  token,
  onBackToExplore,
}) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState<string>('');
  const [isSending, setIsSending] = useState<boolean>(false);

  const loadDashboard = async () => {
    try {
      const res = await api.getGuestReservationDashboard(token);
      setData(res);
    } catch (err: any) {
      setError(err.message || 'Failed to load reservation dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, [token]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    setIsSending(true);
    try {
      await api.sendGuestReservationMessage(token, newMessage.trim());
      setNewMessage('');
      await loadDashboard();
    } catch (err: any) {
      alert('Could not send message: ' + err.message);
    } finally {
      setIsSending(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAF8F5] flex items-center justify-center p-6">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-amber-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <h2 className="text-lg font-bold text-stone-900 font-display">
            Opening Secure Guest Dashboard...
          </h2>
          <p className="text-xs text-stone-500 mt-1">Connecting to Victoria Falls Reservations Desk</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[#FAF8F5] flex items-center justify-center p-6">
        <div className="bg-white p-8 rounded-3xl border border-stone-200 shadow-xl max-w-md w-full text-center">
          <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-3" />
          <h2 className="text-lg font-bold text-stone-900 font-display">Dashboard Link Unavailable</h2>
          <p className="text-xs text-stone-600 mt-2">{error || 'Invalid or expired reservation link.'}</p>
          <button
            onClick={onBackToExplore}
            className="mt-6 px-4 py-2 rounded-xl bg-stone-900 text-white text-xs font-semibold"
          >
            Return to Explorer
          </button>
        </div>
      </div>
    );
  }

  const { reservation, guest, items, messages } = data;
  const isConfirmed = reservation.status === 'CONFIRMED';

  return (
    <div className="min-h-screen bg-[#FAF8F5] py-10">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        {/* Navigation & Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <button
            onClick={onBackToExplore}
            className="inline-flex items-center text-xs font-semibold text-stone-600 hover:text-stone-900 transition"
          >
            <ArrowLeft className="w-4 h-4 mr-1.5" />
            Back to Syntuc Explorer
          </button>

          <div className="flex items-center space-x-2">
            <span className="text-xs text-stone-400">Reference:</span>
            <span className="font-mono font-bold text-xs bg-stone-100 text-stone-800 px-2.5 py-1 rounded-md border border-stone-200">
              {reservation.referenceNumber}
            </span>
          </div>
        </div>

        {/* Status Card */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-stone-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center space-x-3 mb-2">
              <span
                className={`text-xs font-extrabold uppercase px-3 py-1 rounded-full flex items-center ${
                  isConfirmed
                    ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                    : 'bg-amber-100 text-amber-900 border border-amber-300'
                }`}
              >
                {isConfirmed ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-700" />
                    CONFIRMED BY PARTNERS
                  </>
                ) : (
                  <>
                    <Clock className="w-3.5 h-3.5 mr-1 text-amber-700" />
                    STATUS: {reservation.status} (PENDING REVIEW)
                  </>
                )}
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-stone-900 font-display">
              {guest?.fullName || 'Traveler'}'s Victoria Falls Request
            </h1>

            <p className="text-xs text-stone-500 mt-1 max-w-xl leading-relaxed">
              {isConfirmed
                ? 'Your requested itinerary has been confirmed with our local partners. Our coordinator has confirmed room holdings and departure times.'
                : 'Your booking request is under review with our Victoria Falls Reservations Desk. No payment is required until our team confirms partner availability.'}
            </p>
          </div>

          <div className="bg-amber-50/60 p-4 rounded-2xl border border-amber-200/80 text-right shrink-0">
            <div className="text-xs text-amber-900 font-semibold uppercase">Authoritative Total</div>
            <div className="text-2xl font-extrabold text-amber-800 font-display mt-0.5">
              US${reservation.authoritativeTotal}
            </div>
            <div className="text-[11px] text-stone-500">
              {reservation.adultsCount} Adults, {reservation.childrenCount} Children
            </div>
          </div>
        </div>

        {/* Incentive Alert if Applied */}
        {reservation.isBridgeIncentiveApplied && (
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-950 flex items-center space-x-3">
            <Gift className="w-5 h-5 text-emerald-700 shrink-0" />
            <div className="text-xs">
              <span className="font-bold">Bridge Tour Incentive Applied!</span> The Victoria Falls Historic 1905 Bridge Tour is included complimentary ($0) because your request includes 2+ nights accommodation and 2 qualifying priority experiences.
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Reservation Items Breakdown */}
          <div className="lg:col-span-2 space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-stone-400">
              Requested Experiences & Accommodations
            </h3>

            <div className="bg-white rounded-3xl border border-stone-200 overflow-hidden divide-y divide-stone-100">
              {items && items.length > 0 ? (
                items.map((item: ReservationItem) => (
                  <div key={item.id} className="p-5 flex items-start justify-between gap-4">
                    <div>
                      <div className="text-[10px] uppercase font-bold text-amber-800 tracking-wider">
                        {item.snapshotProductType} • {item.snapshotOperatorName}
                      </div>
                      <h4 className="text-base font-bold text-stone-900 mt-0.5">
                        {item.snapshotProductName}
                      </h4>
                      {item.notes && (
                        <p className="text-xs text-emerald-700 mt-1 font-medium">{item.notes}</p>
                      )}
                      <div className="mt-2 text-xs text-stone-500 flex items-center space-x-4">
                        <span>{item.guestCount} {item.guestCount === 1 ? 'Guest' : 'Guests'}</span>
                        {item.nightsCount > 1 && <span>{item.nightsCount} Nights</span>}
                        <span>Tariff: US${item.snapshotUnitPrice} ({item.snapshotPriceBasis})</span>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-base font-extrabold text-stone-900 font-display">
                        US${item.calculatedSubtotal}
                      </div>
                      <div className="text-[10px] text-stone-400">subtotal</div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-8 text-center text-xs text-stone-400">No items recorded.</div>
              )}
            </div>
          </div>

          {/* Direct Communication Thread with Desk */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-stone-400 flex items-center">
              <MessageSquare className="w-4 h-4 mr-1.5 text-amber-700" /> Desk Communication
            </h3>

            <div className="bg-white rounded-3xl border border-stone-200 p-5 shadow-xs flex flex-col h-[480px]">
              {/* Messages list */}
              <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                {messages && messages.length > 0 ? (
                  messages.map((msg: GuestMessage) => (
                    <div
                      key={msg.id}
                      className={`p-3.5 rounded-2xl text-xs ${
                        msg.senderType === 'guest'
                          ? 'bg-amber-600 text-white ml-6 rounded-tr-xs'
                          : 'bg-stone-100 text-stone-800 mr-6 rounded-tl-xs border border-stone-200/60'
                      }`}
                    >
                      <div
                        className={`font-semibold text-[10px] mb-1 ${
                          msg.senderType === 'guest' ? 'text-amber-200' : 'text-amber-800'
                        }`}
                      >
                        {msg.senderName}
                      </div>
                      <p className="leading-relaxed whitespace-pre-wrap">{msg.messageText}</p>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-12 text-xs text-stone-400">
                    No messages yet. Send a note to the coordinator below.
                  </div>
                )}
              </div>

              {/* Message Input */}
              <form onSubmit={handleSendMessage} className="mt-4 pt-3 border-t border-stone-100">
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={e => setNewMessage(e.target.value)}
                    placeholder="Message the Reservations Desk..."
                    className="flex-1 px-3.5 py-2 text-xs rounded-xl bg-stone-50 border border-stone-200 focus:outline-hidden focus:ring-2 focus:ring-amber-500/20"
                  />
                  <button
                    type="submit"
                    disabled={isSending || !newMessage.trim()}
                    className="p-2 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:bg-stone-300 text-white transition cursor-pointer"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
