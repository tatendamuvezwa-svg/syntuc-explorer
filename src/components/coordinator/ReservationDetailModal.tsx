import React, { useState } from 'react';
import { ReservationRequest } from '../../types/index.ts';
import { api } from '../../services/api.ts';
import {
  X,
  Calendar,
  Users,
  MapPin,
  Clock,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  GraduationCap,
  Bed,
  Compass,
  FileText,
  DollarSign,
  ShieldCheck,
  Send,
  MessageSquare,
  Gift,
  Building2,
  ChevronRight,
} from 'lucide-react';

interface Props {
  reservation: ReservationRequest | null;
  isOpen: boolean;
  onClose: () => void;
  onStatusUpdated: (updatedRes: ReservationRequest) => void;
  onOpenGuestDashboard?: (guestToken: string) => void;
}

export const ReservationDetailModal: React.FC<Props> = ({
  reservation,
  isOpen,
  onClose,
  onStatusUpdated,
  onOpenGuestDashboard,
}) => {
  const [currentStatus, setCurrentStatus] = useState<string>(reservation?.status || 'NEW');
  const [internalNote, setInternalNote] = useState<string>('');
  const [isUpdating, setIsUpdating] = useState<boolean>(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Sync state when reservation changes
  React.useEffect(() => {
    if (reservation) {
      setCurrentStatus(reservation.status);
      setInternalNote('');
      setFeedbackMsg(null);
    }
  }, [reservation]);

  if (!isOpen || !reservation) return null;

  const isSchool = reservation.requestType === 'SCHOOL_DELEGATION' || Boolean(reservation.schoolMetadata);
  const schoolMeta = reservation.schoolMetadata;

  const handleSaveStatus = async () => {
    setIsUpdating(true);
    setFeedbackMsg(null);
    try {
      const res = await api.updateReservationStatus(reservation.id, currentStatus, internalNote.trim() || undefined);
      setFeedbackMsg({ text: `Status successfully updated to ${currentStatus}`, type: 'success' });
      setInternalNote('');

      // Refresh parent with updated data
      const updated: ReservationRequest = {
        ...reservation,
        status: currentStatus as any,
      };
      onStatusUpdated(updated);
    } catch (err: any) {
      setFeedbackMsg({ text: err.message || 'Failed to update reservation status', type: 'error' });
    } finally {
      setIsUpdating(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'NEW':
        return 'bg-amber-100 text-amber-900 border-amber-300';
      case 'CONTACTED':
      case 'PARTNER_CONTACTED':
        return 'bg-blue-100 text-blue-900 border-blue-300';
      case 'QUOTED':
        return 'bg-purple-100 text-purple-900 border-purple-300';
      case 'REVIEWED':
        return 'bg-cyan-100 text-cyan-900 border-cyan-300';
      case 'CONFIRMED':
        return 'bg-emerald-100 text-emerald-900 border-emerald-300';
      case 'CANCELLED':
      case 'DECLINED':
        return 'bg-stone-100 text-stone-700 border-stone-300';
      default:
        return 'bg-stone-100 text-stone-800 border-stone-200';
    }
  };

  // Split line items into accommodation and activities
  const accommodationItems = (reservation.items || []).filter(
    i => (i.snapshotProductType || '').toLowerCase() === 'accommodation'
  );
  const activityItems = (reservation.items || []).filter(
    i => (i.snapshotProductType || '').toLowerCase() !== 'accommodation'
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="reservation-detail-title"
      className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/65 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-fadeIn"
    >
      <div className="bg-white rounded-3xl max-w-5xl w-full max-h-[92vh] overflow-y-auto shadow-2xl border border-stone-200 flex flex-col">
        {/* Header */}
        <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-md px-6 py-4 border-b border-stone-200 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className={`p-2.5 rounded-2xl ${isSchool ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
              {isSchool ? <GraduationCap className="w-6 h-6" /> : <Building2 className="w-6 h-6" />}
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 id="reservation-detail-title" className="text-xl font-extrabold text-stone-900 font-display">
                  Reservation #{reservation.referenceNumber}
                </h2>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${getStatusBadge(reservation.status)}`}>
                  {reservation.status}
                </span>
                {isSchool && (
                  <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                    School Delegation
                  </span>
                )}
              </div>
              <p className="text-xs text-stone-500 mt-0.5">
                Logged on {new Date(reservation.createdAt).toLocaleString()} • Victoria Falls Central Desk
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {reservation.guestToken && onOpenGuestDashboard && (
              <button
                type="button"
                onClick={() => onOpenGuestDashboard(reservation.guestToken!)}
                className="px-3 py-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 font-semibold text-xs transition flex items-center cursor-pointer"
                title="Open guest-facing tracking view"
              >
                <ExternalLink className="w-3.5 h-3.5 mr-1.5 text-stone-500" />
                <span>Guest View / Guest Link</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close reservation detail view"
              className="p-2 rounded-full text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Feedback message banner */}
        {feedbackMsg && (
          <div
            className={`px-6 py-2.5 text-xs font-semibold flex items-center justify-between ${
              feedbackMsg.type === 'success' ? 'bg-emerald-50 text-emerald-900 border-b border-emerald-200' : 'bg-rose-50 text-rose-900 border-b border-rose-200'
            }`}
          >
            <span>{feedbackMsg.text}</span>
            <button onClick={() => setFeedbackMsg(null)} className="text-stone-400 hover:text-stone-700">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Body Grid */}
        <div className="p-6 sm:p-8 space-y-8">
          {/* Section 1: Guest Contact & Trip Parameters */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Guest / Delegation Contact */}
            <div className="bg-stone-50/80 rounded-2xl p-5 border border-stone-200/80">
              <h3 className="text-xs uppercase font-bold tracking-wider text-stone-500 mb-3 flex items-center">
                <Users className="w-3.5 h-3.5 mr-1.5 text-amber-700" />
                <span>{isSchool ? 'Delegation & Contact Information' : 'Traveler & Contact Information'}</span>
              </h3>

              <div className="space-y-2 text-xs">
                {isSchool && schoolMeta?.schoolName && (
                  <div className="pb-2 border-b border-stone-200">
                    <span className="text-stone-500 block text-[11px]">School / Institution:</span>
                    <span className="font-bold text-stone-900 text-sm">{schoolMeta.schoolName}</span>
                    {schoolMeta.educationLevel && (
                      <span className="ml-2 uppercase text-[10px] font-bold bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded">
                        {schoolMeta.educationLevel} Level
                      </span>
                    )}
                  </div>
                )}

                <div className="flex justify-between">
                  <span className="text-stone-500">Contact Person / Name:</span>
                  <span className="font-semibold text-stone-900">{reservation.guest?.fullName || schoolMeta?.contactPerson || 'N/A'}</span>
                </div>

                <div className="flex justify-between">
                  <span className="text-stone-500">Email Address:</span>
                  <span className="font-mono text-stone-900 font-medium">{reservation.guest?.email || schoolMeta?.contactEmail || 'N/A'}</span>
                </div>

                <div className="flex justify-between">
                  <span className="text-stone-500">Telephone / WhatsApp:</span>
                  <span className="font-mono text-stone-900">{reservation.guest?.phone || schoolMeta?.contactPhone || 'Not provided'}</span>
                </div>

                <div className="flex justify-between">
                  <span className="text-stone-500">Origin / Country:</span>
                  <span className="text-stone-900 font-medium">{reservation.guest?.country || 'Zimbabwe / SADC'}</span>
                </div>
              </div>
            </div>

            {/* Travel Schedule & Party Size */}
            <div className="bg-stone-50/80 rounded-2xl p-5 border border-stone-200/80">
              <h3 className="text-xs uppercase font-bold tracking-wider text-stone-500 mb-3 flex items-center">
                <Calendar className="w-3.5 h-3.5 mr-1.5 text-amber-700" />
                <span>Travel Schedule & Party Dimensions</span>
              </h3>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-stone-500">Arrival / Check-in Date:</span>
                  <span className="font-bold text-stone-900">{reservation.startDate || 'TBD / Flexible'}</span>
                </div>

                <div className="flex justify-between">
                  <span className="text-stone-500">Departure / Check-out Date:</span>
                  <span className="font-bold text-stone-900">{reservation.endDate || 'TBD / Flexible'}</span>
                </div>

                {isSchool ? (
                  <>
                    <div className="flex justify-between">
                      <span className="text-stone-500">Student Delegations:</span>
                      <span className="font-bold text-emerald-800">{schoolMeta?.studentCount || reservation.childrenCount} Students</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-stone-500">Teachers / Chaperones:</span>
                      <span className="font-bold text-stone-900">{schoolMeta?.teacherCount || reservation.adultsCount} Teachers</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-stone-500">Planned Duration:</span>
                      <span className="font-bold text-stone-900">{schoolMeta?.nightsCount || 2} Nights Stay</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex justify-between">
                      <span className="text-stone-500">Adult Travelers:</span>
                      <span className="font-bold text-stone-900">{reservation.adultsCount} Adults</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-stone-500">Children Travelers:</span>
                      <span className="font-bold text-stone-900">{reservation.childrenCount} Children</span>
                    </div>
                  </>
                )}

                {reservation.isBridgeIncentiveApplied && (
                  <div className="pt-2 border-t border-stone-200 flex items-center text-emerald-700 font-bold">
                    <Gift className="w-4 h-4 mr-1.5 shrink-0" />
                    <span>Bridge Tour $0 Incentive Waiver QUALIFIED & APPLIED</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Section 2: Accommodation Breakdown */}
          <div>
            <div className="flex items-center space-x-2 mb-3">
              <Bed className="w-4 h-4 text-amber-700" />
              <h3 className="text-sm font-bold uppercase tracking-wider text-stone-900">
                Accommodation Allocation
              </h3>
            </div>

            {isSchool ? (
              <div className="bg-white rounded-2xl p-4 border border-stone-200 shadow-xs space-y-2 text-xs">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-bold text-stone-900 text-sm">
                      {schoolMeta?.accommodationTier === 'rainbow_hotel'
                        ? 'Victoria Falls Rainbow Hotel (Educational Shared Tier)'
                        : 'Budget Educational Lodge (Khulula Lodge / Teak Lodge / Reynard Cottages)'}
                    </div>
                    <p className="text-stone-500 text-[11px] mt-0.5">
                      {schoolMeta?.accommodationTier === 'rainbow_hotel'
                        ? 'Official educational shared rate: US$130 per room for 2 students per night.'
                        : 'Official commercial educational tariff: Approximately US$15 per child per night.'}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-amber-800 font-display text-sm">
                      {schoolMeta?.accommodationTier === 'rainbow_hotel'
                        ? `US$130 / room / night`
                        : `US$15 / student / night`}
                    </span>
                    <div className="text-[10px] text-stone-400">
                      {schoolMeta?.studentCount || reservation.childrenCount} Students • {schoolMeta?.nightsCount || 2} Nights
                    </div>
                  </div>
                </div>
              </div>
            ) : accommodationItems.length > 0 ? (
              <div className="space-y-3">
                {accommodationItems.map(item => (
                  <div key={item.id} className="bg-white rounded-2xl p-4 border border-stone-200 shadow-xs flex justify-between items-center text-xs">
                    <div>
                      <div className="font-bold text-stone-900 text-sm">{item.snapshotProductName}</div>
                      <div className="text-stone-500 text-[11px]">{item.snapshotOperatorName} • Rate basis: {item.snapshotPriceBasis}</div>
                      {item.notes && <div className="text-stone-600 mt-1 italic">Note: {item.notes}</div>}
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-amber-800 font-display text-sm">US${item.calculatedSubtotal}</div>
                      <div className="text-[10px] text-stone-400">
                        US${item.snapshotUnitPrice} × {item.nightsCount || 1} nights × {item.guestCount || 1} guests
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 bg-stone-50 rounded-2xl border border-dashed border-stone-200 text-xs text-stone-500">
                No accommodation included in this request (day excursions or independent guest accommodation).
              </div>
            )}
          </div>

          {/* Section 3: Activities Breakdown (Every item rendered individually) */}
          <div>
            <div className="flex items-center space-x-2 mb-3">
              <Compass className="w-4 h-4 text-amber-700" />
              <h3 className="text-sm font-bold uppercase tracking-wider text-stone-900">
                Individual Activities Breakdown
              </h3>
            </div>

            {isSchool && schoolMeta?.lineItems ? (
              <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-xs">
                <table className="w-full text-left text-xs">
                  <thead className="bg-stone-50 border-b border-stone-200 text-stone-500 text-[10px] uppercase tracking-wider">
                    <tr>
                      <th className="p-3">Activity / Component</th>
                      <th className="p-3">Category</th>
                      <th className="p-3">Unit Tariff</th>
                      <th className="p-3">Quantity</th>
                      <th className="p-3 text-right">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {schoolMeta.lineItems
                      .filter((li: any) => li.category !== 'accommodation')
                      .map((li: any, idx: number) => (
                        <tr key={idx} className="hover:bg-stone-50/60 transition">
                          <td className="p-3">
                            <div className="font-semibold text-stone-900">{li.name}</div>
                            {li.isComplimentaryIncentive && (
                              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                                Bridge Tour $0 Incentive Qualified
                              </span>
                            )}
                            {li.notes && <div className="text-[11px] text-stone-500 mt-0.5">{li.notes}</div>}
                          </td>
                          <td className="p-3 capitalize text-stone-600">{li.category}</td>
                          <td className="p-3 text-stone-700 font-mono">
                            {li.subtotal === 0 ? 'COMPLIMENTARY' : `US$${li.unitRate}`}
                          </td>
                          <td className="p-3 text-stone-700">{li.quantity}</td>
                          <td className="p-3 text-right font-bold text-stone-900 font-display">
                            {li.subtotal === 0 ? 'FREE' : `US$${li.subtotal}`}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            ) : activityItems.length > 0 ? (
              <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-xs">
                <table className="w-full text-left text-xs">
                  <thead className="bg-stone-50 border-b border-stone-200 text-stone-500 text-[10px] uppercase tracking-wider">
                    <tr>
                      <th className="p-3">Activity</th>
                      <th className="p-3">Operator</th>
                      <th className="p-3">Tariff Basis</th>
                      <th className="p-3">Guests</th>
                      <th className="p-3 text-right">Calculated Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {activityItems.map((item, idx) => (
                      <tr key={idx} className="hover:bg-stone-50/60 transition">
                        <td className="p-3 font-semibold text-stone-900">
                          <div>{item.snapshotProductName}</div>
                          {item.notes && <div className="text-[10px] text-stone-500 font-normal">{item.notes}</div>}
                        </td>
                        <td className="p-3 text-stone-600">{item.snapshotOperatorName}</td>
                        <td className="p-3 text-stone-700 font-mono">US${item.snapshotUnitPrice} ({item.snapshotPriceBasis})</td>
                        <td className="p-3 text-stone-700">{item.guestCount || 1}</td>
                        <td className="p-3 text-right font-bold text-stone-900 font-display">US${item.calculatedSubtotal}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-4 bg-stone-50 rounded-2xl border border-dashed border-stone-200 text-xs text-stone-500">
                No individual activities selected in this request.
              </div>
            )}
          </div>

          {/* Section 4: Commercial Summary */}
          <div className="bg-amber-50/60 rounded-3xl p-6 border border-amber-200/80">
            <div className="flex items-center space-x-2 mb-4">
              <DollarSign className="w-4 h-4 text-amber-800" />
              <h3 className="text-sm font-bold uppercase tracking-wider text-amber-950 font-display">
                Commercial Summary & Partner Grounding
              </h3>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-stone-600">Calculated Tariff / Request Total:</span>
                <span className="text-2xl font-extrabold text-amber-900 font-display">
                  US${reservation.authoritativeTotal}
                </span>
              </div>

              {reservation.isBridgeIncentiveApplied && (
                <div className="flex justify-between text-emerald-700 font-medium">
                  <span>1905 Historic Bridge Tour Incentive:</span>
                  <span>US$0.00 (Waived via 2N + 2 priority activities)</span>
                </div>
              )}

              <div className="pt-3 border-t border-amber-200/80 text-[11px] text-stone-600 space-y-1">
                <div className="font-semibold text-amber-900">Commercial Boundary:</div>
                <p>
                  The calculated amount above represents the official partner tariff schedule. Syntuc Explorer operates with local contracted partners; final formal booking vouchers are held and issued upon local desk confirmation with zero upfront payment required from guests during initial request.
                </p>
              </div>
            </div>
          </div>

          {/* Section 5: Notes Comparison (Guest Notes vs Internal Coordinator Notes) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Guest Notes */}
            <div className="bg-white rounded-2xl p-5 border border-stone-200">
              <h4 className="text-xs uppercase font-bold tracking-wider text-stone-500 mb-2 flex items-center">
                <FileText className="w-3.5 h-3.5 mr-1.5 text-stone-400" />
                <span>Guest / Delegation Requirements</span>
              </h4>
              <p className="text-xs text-stone-700 leading-relaxed bg-stone-50 p-3 rounded-xl min-h-24">
                {reservation.specialRequests || reservation.guest?.specialRequests || 'No special dietary, mobility, or learning requirements submitted.'}
              </p>
            </div>

            {/* Internal Coordinator Notes */}
            <div className="bg-white rounded-2xl p-5 border border-stone-200">
              <h4 className="text-xs uppercase font-bold tracking-wider text-stone-500 mb-2 flex items-center">
                <MessageSquare className="w-3.5 h-3.5 mr-1.5 text-amber-600" />
                <span>Internal Desk Coordinator Notes (Private)</span>
              </h4>

              {reservation.coordinatorNotes && reservation.coordinatorNotes.length > 0 ? (
                <div className="space-y-2 mb-3 max-h-32 overflow-y-auto">
                  {reservation.coordinatorNotes.map(n => (
                    <div key={n.id} className="p-2.5 bg-amber-50/70 border border-amber-200/60 rounded-xl text-xs">
                      <div className="flex justify-between text-[10px] text-stone-400 font-semibold mb-1">
                        <span>{n.authorName}</span>
                        <span>{new Date(n.createdAt).toLocaleDateString()}</span>
                      </div>
                      <div className="text-stone-800">{n.content}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-stone-400 italic mb-3">No internal coordinator notes recorded yet.</p>
              )}

              <div>
                <label className="block text-[11px] font-semibold text-stone-700 mb-1">Add Coordinator Note:</label>
                <textarea
                  rows={2}
                  value={internalNote}
                  onChange={e => setInternalNote(e.target.value)}
                  placeholder="Record supplier confirmation, guide assignment, or room holding note..."
                  className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>
          </div>

          {/* Section 6: Operational Status Lifecycle Controls */}
          <div className="bg-stone-50 rounded-2xl p-6 border border-stone-200">
            <h4 className="text-xs uppercase font-bold tracking-wider text-stone-700 mb-3 flex items-center">
              <ShieldCheck className="w-4 h-4 mr-1.5 text-emerald-700" />
              <span>Operational Lifecycle Management</span>
            </h4>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex-1">
                <label className="block text-xs font-semibold text-stone-700 mb-1">Update Status:</label>
                <select
                  value={currentStatus}
                  onChange={e => setCurrentStatus(e.target.value)}
                  className="w-full sm:w-80 px-3 py-2 text-xs rounded-xl border border-stone-300 bg-white font-medium shadow-xs"
                >
                  <option value="NEW">NEW (Awaiting Initial Desk Review)</option>
                  <option value="CONTACTED">CONTACTED (Guest / Partner Outreach)</option>
                  <option value="QUOTED">QUOTED (Authoritative Tariff Issued)</option>
                  <option value="REVIEWED">REVIEWED (Internal Coordinator Audited)</option>
                  <option value="PARTNER_CONTACTED">PARTNER_CONTACTED (Holding Partner Allocations)</option>
                  <option value="CONFIRMED">CONFIRMED (Supplier Confirmed & Vouchers Active)</option>
                  <option value="DECLINED">DECLINED</option>
                  <option value="CANCELLED">CANCELLED</option>
                </select>
                <p className="text-[11px] text-stone-500 mt-1">
                  Status changes immediately synchronize with the guest's reservation tracking link.
                </p>
              </div>

              <div className="flex items-center space-x-2 shrink-0">
                <button
                  type="button"
                  onClick={handleSaveStatus}
                  disabled={isUpdating}
                  className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:bg-stone-300 text-white font-semibold text-xs shadow-md shadow-amber-600/30 transition flex items-center cursor-pointer"
                >
                  {isUpdating ? 'Saving...' : 'Save Status & Notes'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 z-20 bg-stone-50 px-6 py-3.5 border-t border-stone-200 flex items-center justify-between text-xs">
          <div className="text-stone-500">
            Syntuc Explorer • Central Victoria Falls Destination Desk
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-white border border-stone-200 hover:bg-stone-100 text-stone-700 font-semibold transition cursor-pointer"
          >
            Close Detail View
          </button>
        </div>
      </div>
    </div>
  );
};
