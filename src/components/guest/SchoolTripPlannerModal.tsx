import React, { useState, useEffect } from 'react';
import { useSession } from '../../context/SessionContext.tsx';
import { api } from '../../services/api.ts';
import {
  X,
  GraduationCap,
  Gift,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  ArrowRight,
  ShieldCheck,
  Calculator,
} from 'lucide-react';

export const SchoolTripPlannerModal: React.FC = () => {
  const { isSchoolPlannerOpen, closeSchoolPlanner, showToast } = useSession();

  const [schoolName, setSchoolName] = useState<string>('Heritage High School');
  const [educationLevel, setEducationLevel] = useState<'primary' | 'secondary'>('secondary');
  const [studentCount, setStudentCount] = useState<number>(40);
  const [teacherCount, setTeacherCount] = useState<number>(2);
  const [nightsCount, setNightsCount] = useState<number>(2);
  const [accommodationTier, setAccommodationTier] = useState<'budget' | 'rainbow_hotel' | 'none'>('budget');

  // Activities checkboxes
  const [selectedActivities, setSelectedActivities] = useState({
    boatCruise: true,
    crocodileFarm: false,
    rainforestTour: true,
    helicopterFlight: true,
    quadBiking: true,
    airportTour: false,
    elephantInteraction: false,
    gameDrive: false,
    includeBridgeTour: true,
  });

  const [quoteResult, setQuoteResult] = useState<any>(null);
  const [loadingQuote, setLoadingQuote] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submittedReference, setSubmittedReference] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Contact details
  const [contactPerson, setContactPerson] = useState<string>('Mr. D. Moyo (Head of Travel)');
  const [contactEmail, setContactEmail] = useState<string>('trips@heritagehigh.ac.zw');
  const [contactPhone, setContactPhone] = useState<string>('+263 77 210 9840');
  const [arrivalDate, setArrivalDate] = useState<string>('');
  const [departureDate, setDepartureDate] = useState<string>('');
  const [specialRequests, setSpecialRequests] = useState<string>('');

  // Recalculate quote whenever parameters change
  useEffect(() => {
    if (!isSchoolPlannerOpen) return;
    let isCancelled = false;

    async function fetchQuote() {
      setLoadingQuote(true);
      try {
        const res = await api.calculateSchoolTrip({
          schoolName,
          educationLevel,
          studentCount,
          teacherCount,
          nightsCount,
          accommodationTier,
          selectedActivities,
        });
        if (!isCancelled) {
          setQuoteResult(res);
        }
      } catch (err) {
        console.error('Error calculating school quote:', err);
      } finally {
        if (!isCancelled) setLoadingQuote(false);
      }
    }

    fetchQuote();
    return () => {
      isCancelled = true;
    };
  }, [
    isSchoolPlannerOpen,
    schoolName,
    educationLevel,
    studentCount,
    teacherCount,
    nightsCount,
    accommodationTier,
    selectedActivities,
  ]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeSchoolPlanner();
      }
    };
    if (isSchoolPlannerOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSchoolPlannerOpen, closeSchoolPlanner]);

  if (!isSchoolPlannerOpen) return null;

  const toggleActivity = (key: keyof typeof selectedActivities) => {
    setSelectedActivities(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleInquirySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await api.submitSchoolTrip({
        schoolName,
        educationLevel,
        studentCount,
        teacherCount,
        nightsCount,
        accommodationTier,
        selectedActivities,
        contactPerson,
        contactEmail,
        contactPhone,
        arrivalDate,
        departureDate,
        specialRequests,
      });

      setSubmittedReference(res.referenceNumber);
      showToast(`School delegation request #${res.referenceNumber} created!`);
    } catch (err: any) {
      console.error('School trip submission error:', err);
      setErrorMessage(err.message || 'Failed to submit school delegation request');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="school-planner-title"
      className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 animate-fadeIn"
    >
      <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[92vh] overflow-y-auto shadow-2xl border border-stone-200 flex flex-col">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-md px-6 py-4 border-b border-stone-100 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-emerald-600 text-white shadow-xs">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 id="school-planner-title" className="font-bold text-stone-900 font-display text-lg">
                  School Trip Commercial Planner
                </h3>
                <span className="text-[10px] uppercase font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded">
                  Educational Tariffs
                </span>
              </div>
              <p className="text-[11px] text-stone-500">
                Official Victoria Falls educational commercial pricing and Bridge Tour incentive rules
              </p>
            </div>
          </div>
          <button
            onClick={closeSchoolPlanner}
            aria-label="Close school trip commercial planner"
            className="p-2 rounded-full text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Incentive Alert Banner */}
        <div
          className={`px-6 py-3 border-b flex items-start space-x-3 text-xs ${
            quoteResult?.bridgeIncentiveQualified
              ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
              : 'bg-amber-50 border-amber-200 text-amber-950'
          }`}
        >
          <Gift className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-bold">
              {quoteResult?.bridgeIncentiveQualified
                ? 'Bridge Tour Incentive: QUALIFIED! ($0 Complimentary)'
                : 'Bridge Tour Incentive Rule: Requires 2+ Nights Accommodation + 2 Qualifying Priority Activities'}
            </span>
            <div className="text-[11px] mt-0.5 text-stone-600 flex flex-wrap gap-x-4">
              <span>
                • Accommodation Nights: <b>{nightsCount}/2</b>
              </span>
              <span>
                • Priority Activities: <b>{quoteResult?.qualifyingActivitiesCount || 0}/2</b>{' '}
                <span className="text-stone-400">
                  (Quad Biking, Helicopter, Elephant Interaction, Sunset Cruise)
                </span>
              </span>
              <span className="text-rose-700 font-medium">
                • Standard Boat Cruise does NOT qualify
              </span>
            </div>
          </div>
        </div>

        {/* Content grid */}
        <div className="p-6 sm:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Controls column */}
          <div className="lg:col-span-7 space-y-6">
            {/* School & Delegations Info */}
            <div className="space-y-4">
              <h4 className="text-xs uppercase font-bold tracking-wider text-stone-400">
                1. Delegation Information
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    School / Institution Name
                  </label>
                  <input
                    type="text"
                    value={schoolName}
                    onChange={e => setSchoolName(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs rounded-xl border border-stone-200"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Education Level
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setEducationLevel('primary')}
                      className={`py-2 text-xs font-semibold rounded-xl border transition ${
                        educationLevel === 'primary'
                          ? 'bg-emerald-50 border-emerald-500 text-emerald-900'
                          : 'bg-stone-50 border-stone-200 text-stone-600'
                      }`}
                    >
                      Primary School
                    </button>
                    <button
                      type="button"
                      onClick={() => setEducationLevel('secondary')}
                      className={`py-2 text-xs font-semibold rounded-xl border transition ${
                        educationLevel === 'secondary'
                          ? 'bg-emerald-50 border-emerald-500 text-emerald-900'
                          : 'bg-stone-50 border-stone-200 text-stone-600'
                      }`}
                    >
                      Secondary School
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Number of Students
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={studentCount}
                    onChange={e => setStudentCount(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full px-3.5 py-2 text-xs rounded-xl border border-stone-200"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Teachers / Chaperones
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={teacherCount}
                    onChange={e => setTeacherCount(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-full px-3.5 py-2 text-xs rounded-xl border border-stone-200"
                  />
                  <span className="text-[10px] text-stone-400">
                    1 teacher per 20 students gets 50% discount ($4) on Rainforest Walk!
                  </span>
                </div>
              </div>
            </div>

            {/* Accommodation Tier */}
            <div className="space-y-4 pt-4 border-t border-stone-100">
              <div className="flex items-center justify-between">
                <h4 className="text-xs uppercase font-bold tracking-wider text-stone-400">
                  2. Educational Accommodation Tier
                </h4>
                <div className="flex items-center space-x-2">
                  <span className="text-xs text-stone-600 font-medium">Nights:</span>
                  <input
                    type="number"
                    min="0"
                    value={nightsCount}
                    onChange={e => setNightsCount(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-16 px-2 py-1 text-xs rounded-lg border border-stone-200"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Budget */}
                <div
                  onClick={() => setAccommodationTier('budget')}
                  className={`p-4 rounded-2xl border-2 transition cursor-pointer ${
                    accommodationTier === 'budget'
                      ? 'border-emerald-600 bg-emerald-50/40 shadow-xs'
                      : 'border-stone-200 bg-white'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <span className="text-xs font-bold text-stone-900">
                      Budget School Lodges
                    </span>
                    <span className="text-xs font-bold text-emerald-800 font-display">
                      From US$15
                    </span>
                  </div>
                  <p className="text-[11px] text-stone-500 mt-1">
                    Khulula Lodge, Teak Lodge, Reynard Cottages, Letsatsi. Shared dormitory or multiple beds.
                  </p>
                  <div className="mt-2 text-[10px] text-emerald-700 font-semibold">
                    US$15 per child / night
                  </div>
                </div>

                {/* Rainbow Hotel */}
                <div
                  onClick={() => setAccommodationTier('rainbow_hotel')}
                  className={`p-4 rounded-2xl border-2 transition cursor-pointer ${
                    accommodationTier === 'rainbow_hotel'
                      ? 'border-emerald-600 bg-emerald-50/40 shadow-xs'
                      : 'border-stone-200 bg-white'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <span className="text-xs font-bold text-stone-900">
                      Victoria Falls Rainbow Hotel
                    </span>
                    <span className="text-xs font-bold text-emerald-800 font-display">
                      US$130 / room
                    </span>
                  </div>
                  <p className="text-[11px] text-stone-500 mt-1">
                    Premium hotel standard. USD 130 per room shared by two children (USD 65 / child).
                  </p>
                  <div className="mt-2 text-[10px] text-emerald-700 font-semibold">
                    {Math.ceil(studentCount / 2)} rooms allocated
                  </div>
                </div>
              </div>
            </div>

            {/* Activities Checkboxes */}
            <div className="space-y-4 pt-4 border-t border-stone-100">
              <h4 className="text-xs uppercase font-bold tracking-wider text-stone-400">
                3. Educational Activities (Special Tariffs)
              </h4>

              <div className="space-y-2 text-xs">
                {/* Rainforest Tour */}
                <label className="flex items-start space-x-3 p-3 rounded-xl border border-stone-200 hover:bg-stone-50 transition cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedActivities.rainforestTour}
                    onChange={() => toggleActivity('rainforestTour')}
                    className="mt-0.5 rounded text-emerald-600"
                  />
                  <div className="flex-1">
                    <div className="flex justify-between">
                      <span className="font-bold text-stone-800">
                        Rainforest Guided Walking Tour
                      </span>
                      <span className="font-semibold text-emerald-800 font-display">
                        Primary $1 / Secondary $4
                      </span>
                    </div>
                    <p className="text-[11px] text-stone-500">
                      Naturalist guide and park access. Teachers: 1 per 20 students gets half-price ($4).
                    </p>
                  </div>
                </label>

                {/* Helicopter */}
                <label className="flex items-start space-x-3 p-3 rounded-xl border border-emerald-200 bg-emerald-50/30 hover:bg-emerald-50/60 transition cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedActivities.helicopterFlight}
                    onChange={() => toggleActivity('helicopterFlight')}
                    className="mt-0.5 rounded text-emerald-600"
                  />
                  <div className="flex-1">
                    <div className="flex justify-between">
                      <span className="font-bold text-stone-800">
                        School Educational Helicopter Flight
                      </span>
                      <span className="font-semibold text-emerald-800 font-display">
                        US$70 / student
                      </span>
                    </div>
                    <p className="text-[11px] text-stone-500">
                      ★ PRIORITY ACTIVITY for Bridge Tour incentive. Special school group flight.
                    </p>
                  </div>
                </label>

                {/* Quad Biking */}
                <label className="flex items-start space-x-3 p-3 rounded-xl border border-emerald-200 bg-emerald-50/30 hover:bg-emerald-50/60 transition cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedActivities.quadBiking}
                    onChange={() => toggleActivity('quadBiking')}
                    className="mt-0.5 rounded text-emerald-600"
                  />
                  <div className="flex-1">
                    <div className="flex justify-between">
                      <span className="font-bold text-stone-800">
                        Supervised Quad Biking
                      </span>
                      <span className="font-semibold text-emerald-800 font-display">
                        US$10 / student
                      </span>
                    </div>
                    <p className="text-[11px] text-stone-500">
                      ★ PRIORITY ACTIVITY for Bridge Tour incentive. Guided terrain safety track.
                    </p>
                  </div>
                </label>

                {/* Elephant Sanctuary */}
                <label className="flex items-start space-x-3 p-3 rounded-xl border border-emerald-200 bg-emerald-50/30 hover:bg-emerald-50/60 transition cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedActivities.elephantInteraction}
                    onChange={() => toggleActivity('elephantInteraction')}
                    className="mt-0.5 rounded text-emerald-600"
                  />
                  <div className="flex-1">
                    <div className="flex justify-between">
                      <span className="font-bold text-stone-800">
                        Elephant Sanctuary Educational Interaction
                      </span>
                      <span className="font-semibold text-emerald-800 font-display">
                        Primary $10 / Secondary $20
                      </span>
                    </div>
                    <p className="text-[11px] text-stone-500">
                      ★ PRIORITY ACTIVITY for Bridge Tour incentive. Wildlife conservation talk.
                    </p>
                  </div>
                </label>

                {/* Standalone Safari Game Drive */}
                <label className="flex items-start space-x-3 p-3 rounded-xl border border-emerald-200 bg-emerald-50/30 hover:bg-emerald-50/60 transition cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedActivities.gameDrive}
                    onChange={() => toggleActivity('gameDrive')}
                    className="mt-0.5 rounded text-emerald-600"
                  />
                  <div className="flex-1">
                    <div className="flex justify-between">
                      <span className="font-bold text-stone-800">
                        Zambezi National Park Safari Game Drive
                      </span>
                      <span className="font-semibold text-emerald-800 font-display">
                        US$15 / student
                      </span>
                    </div>
                    <p className="text-[11px] text-stone-500">
                      ★ PRIORITY ACTIVITY for Bridge Tour incentive. Open 4x4 guided wildlife safari.
                    </p>
                  </div>
                </label>

                {/* Standard Boat Cruise */}
                <label className="flex items-start space-x-3 p-3 rounded-xl border border-stone-200 hover:bg-stone-50 transition cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedActivities.boatCruise}
                    onChange={() => toggleActivity('boatCruise')}
                    className="mt-0.5 rounded text-emerald-600"
                  />
                  <div className="flex-1">
                    <div className="flex justify-between">
                      <span className="font-bold text-stone-800">
                        Standard Zambezi River Boat Cruise
                      </span>
                      <span className="font-semibold text-stone-800 font-display">
                        US$10 / student + Park Fee
                      </span>
                    </div>
                    <p className="text-[11px] text-stone-500">
                      Educational river cruise. (Note: Does NOT count toward Bridge Tour incentive).
                    </p>
                  </div>
                </label>

                {/* Crocodile Farm */}
                <label className="flex items-start space-x-3 p-3 rounded-xl border border-stone-200 hover:bg-stone-50 transition cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedActivities.crocodileFarm}
                    onChange={() => toggleActivity('crocodileFarm')}
                    className="mt-0.5 rounded text-emerald-600"
                  />
                  <div className="flex-1">
                    <div className="flex justify-between">
                      <span className="font-bold text-stone-800">Crocodile Farm Educational Tour</span>
                      <span className="font-semibold text-stone-800 font-display">
                        Primary $3 / Secondary $4
                      </span>
                    </div>
                  </div>
                </label>

                {/* Airport Tour */}
                <label className="flex items-start space-x-3 p-3 rounded-xl border border-stone-200 hover:bg-stone-50 transition cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedActivities.airportTour}
                    onChange={() => toggleActivity('airportTour')}
                    className="mt-0.5 rounded text-emerald-600"
                  />
                  <div className="flex-1">
                    <div className="flex justify-between">
                      <span className="font-bold text-stone-800">Airport Aviation Tour</span>
                      <span className="font-semibold text-stone-800 font-display">
                        US$3 / student
                      </span>
                    </div>
                  </div>
                </label>

                {/* Historic Bridge Tour */}
                <label className="flex items-start space-x-3 p-3 rounded-xl border-2 border-amber-300 bg-amber-50/50 hover:bg-amber-50 transition cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedActivities.includeBridgeTour}
                    onChange={() => toggleActivity('includeBridgeTour')}
                    className="mt-0.5 rounded text-amber-600"
                  />
                  <div className="flex-1">
                    <div className="flex justify-between">
                      <span className="font-bold text-stone-900">
                        Victoria Falls Historic 1905 Bridge Tour
                      </span>
                      <span className="font-bold text-emerald-800 font-display">
                        {quoteResult?.bridgeIncentiveQualified ? 'COMPLIMENTARY ($0)' : 'Standard $20'}
                      </span>
                    </div>
                    <p className="text-[11px] text-stone-600">
                      {quoteResult?.bridgeIncentiveQualified
                        ? '✓ Complimentary $0 benefit unlocked via qualification criteria!'
                        : 'Requires 2 nights accommodation + 2 qualifying priority activities for $0 waiver.'}
                    </p>
                  </div>
                </label>
              </div>

              {/* School Coordinator & Travel Dates */}
              <div className="pt-4 border-t border-stone-200 space-y-3">
                <h4 className="text-xs uppercase font-bold tracking-wider text-stone-700">
                  School Coordinator & Travel Dates
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-stone-600 mb-1">
                      Coordinator / Teacher Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={contactPerson}
                      onChange={e => setContactPerson(e.target.value)}
                      placeholder="e.g. Mrs. S. Dube"
                      className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-stone-600 mb-1">
                      Official School Email *
                    </label>
                    <input
                      type="email"
                      required
                      value={contactEmail}
                      onChange={e => setContactEmail(e.target.value)}
                      placeholder="e.g. travel@school.ac.zw"
                      className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-stone-600 mb-1">
                      Contact Phone / WhatsApp
                    </label>
                    <input
                      type="tel"
                      value={contactPhone}
                      onChange={e => setContactPhone(e.target.value)}
                      placeholder="+263 77..."
                      className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-stone-600 mb-1">
                      Estimated Arrival Date
                    </label>
                    <input
                      type="date"
                      value={arrivalDate}
                      onChange={e => setArrivalDate(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 focus:outline-hidden"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-stone-600 mb-1">
                    Special Delegation Notes
                  </label>
                  <textarea
                    rows={2}
                    value={specialRequests}
                    onChange={e => setSpecialRequests(e.target.value)}
                    placeholder="e.g. Dietary preferences, coach parking, educational talk focus..."
                    className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 focus:outline-hidden"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Quotation Summary column */}
          <div className="lg:col-span-5 flex flex-col justify-between space-y-6 bg-stone-50 p-6 rounded-3xl border border-stone-200/80">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-stone-200">
                <h4 className="text-xs uppercase font-bold tracking-wider text-stone-700 flex items-center">
                  <Calculator className="w-4 h-4 mr-1.5 text-emerald-700" /> Commercial Quote
                </h4>
                <span className="text-[11px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded">
                  {quoteResult?.studentCount} Students
                </span>
              </div>

              {/* Items Breakdown list */}
              <div className="mt-4 space-y-2.5 max-h-72 overflow-y-auto pr-1 text-xs">
                {quoteResult?.lineItems?.map((li: any) => (
                  <div key={li.id} className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-semibold text-stone-800">{li.name}</div>
                      <div className="text-[10px] text-stone-500">{li.rateBasis}</div>
                      {li.isComplimentaryIncentive && (
                        <div className="text-[10px] font-bold text-emerald-700">
                          Bridge Tour Incentive Reward ($0)
                        </div>
                      )}
                    </div>
                    <div className="font-bold text-stone-900 font-display shrink-0">
                      {li.subtotal === 0 ? 'FREE' : `US$${li.subtotal}`}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Total Section & Submission */}
            <div className="pt-4 border-t border-stone-200 space-y-3">
              <div className="flex items-baseline justify-between">
                <span className="text-xs text-stone-600 font-semibold">Total Estimated Tariff:</span>
                <span className="text-3xl font-extrabold text-stone-900 font-display">
                  US${quoteResult?.totalEstimate || 0}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs text-stone-500">
                <span>Per Student Estimate:</span>
                <span className="font-bold text-emerald-800">
                  US${quoteResult?.perStudentEstimate || 0} / student
                </span>
              </div>

              {errorMessage && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-medium">
                  {errorMessage}
                </div>
              )}

              {submittedReference ? (
                <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-2xl space-y-2 text-emerald-950">
                  <div className="flex items-center space-x-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    <h5 className="font-bold text-sm">Request Submitted to Desk!</h5>
                  </div>
                  <p className="text-xs text-stone-600">
                    Your school delegation request has been logged under reference{' '}
                    <span className="font-mono font-bold text-stone-900">{submittedReference}</span>.
                    The Victoria Falls Reservations Desk is reviewing accommodation holds and educational tariffs.
                  </p>
                  <button
                    onClick={closeSchoolPlanner}
                    className="w-full mt-2 py-2.5 bg-emerald-700 text-white rounded-xl font-bold text-xs hover:bg-emerald-800 transition"
                  >
                    Close Planner
                  </button>
                </div>
              ) : (
                <>
                  <div className="text-[11px] text-stone-500">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 inline mr-1" />
                    Special educational concession schedule. Subject to partner allocation.
                  </div>

                  <form onSubmit={handleInquirySubmit}>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full py-3.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:bg-stone-300 text-white font-semibold text-xs shadow-md shadow-emerald-700/20 transition flex items-center justify-center cursor-pointer"
                    >
                      {isSubmitting ? (
                        <span>Submitting to Educational Desk...</span>
                      ) : (
                        <>
                          <span>Submit School Delegation Request</span>
                          <ArrowRight className="w-4 h-4 ml-1.5" />
                        </>
                      )}
                    </button>
                  </form>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
