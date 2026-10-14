import React, { useState, useEffect } from 'react';
import { useSession } from '../../context/SessionContext.tsx';
import { Product } from '../../types/index.ts';
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
  Play,
  Image as ImageIcon,
  Check,
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

  const [catalogProducts, setCatalogProducts] = useState<Product[]>([]);
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

  // Reuse verified catalogue media for school-specific product cards.
  useEffect(() => {
    if (!isSchoolPlannerOpen) return;
    let cancelled = false;
    api.getProducts()
      .then((products: Product[]) => {
        if (!cancelled) setCatalogProducts(products.filter(product => product.isPublished));
      })
      .catch(error => console.error('Unable to load school planner product media:', error));
    return () => { cancelled = true; };
  }, [isSchoolPlannerOpen]);

  const mediaFor = (terms: string[]) => {
    const normalizedTerms = terms.map(term => term.toLowerCase());
    return catalogProducts.find(product =>
      product.productType === 'activity' &&
      normalizedTerms.some(term => product.name.toLowerCase().includes(term))
    );
  };

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
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h4 className="text-xs uppercase font-bold tracking-wider text-stone-500">2. Educational Accommodation</h4>
                  <p className="text-xs text-stone-500 mt-1">Choose the stay that fits your school's budget.</p>
                </div>
                <label className="flex items-center gap-2 text-xs text-stone-600 font-medium shrink-0">
                  Nights
                  <input aria-label="Accommodation nights" type="number" min="0" value={nightsCount} onChange={e => setNightsCount(Math.max(0, parseInt(e.target.value) || 0))} className="w-16 px-2.5 py-2 text-xs rounded-xl border border-stone-200" />
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button type="button" aria-pressed={accommodationTier === 'budget'} onClick={() => setAccommodationTier('budget')} className={`group text-left overflow-hidden rounded-2xl border transition-all ${accommodationTier === 'budget' ? 'border-[#54775A] ring-2 ring-[#54775A]/15 shadow-md' : 'border-stone-200 hover:border-stone-300'}`}>
                  <div className="relative h-36 bg-stone-100 overflow-hidden">
                    <img src={catalogProducts.find(p => p.productType === 'accommodation' && /khulula|teak|reynard|letsatsi/i.test(p.name))?.primaryImageUrl || 'https://images.unsplash.com/photo-1510798831971-661eb04b3739?auto=format&fit=crop&w=900&q=80'} alt="Budget school lodge accommodation" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" loading="lazy" />
                    <span className="absolute left-3 top-3 rounded-full bg-white/95 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-stone-700">School budget</span>
                    {accommodationTier === 'budget' && <span className="absolute right-3 top-3 rounded-full bg-[#263B30] p-1.5 text-white"><Check className="w-3.5 h-3.5" /></span>}
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#17251D]/90 to-transparent px-4 pb-3 pt-8"><span className="text-xl font-bold text-white">US$15 <span className="text-xs font-medium text-white/80">/ student / night</span></span></div>
                  </div>
                  <div className="p-4">
                    <h5 className="font-semibold text-[#263B30]">Budget School Lodges</h5>
                    <p className="mt-1 text-xs leading-relaxed text-stone-600">Khulula Lodge, Teak Lodge, Reynard Cottages and Letsatsi. Shared dormitory or multi-bed rooms.</p>
                    <p className="mt-3 text-xs font-semibold text-[#54775A]">Estimated accommodation: US${15 * studentCount * nightsCount}</p>
                  </div>
                </button>

                <button type="button" aria-pressed={accommodationTier === 'rainbow_hotel'} onClick={() => setAccommodationTier('rainbow_hotel')} className={`group text-left overflow-hidden rounded-2xl border transition-all ${accommodationTier === 'rainbow_hotel' ? 'border-[#54775A] ring-2 ring-[#54775A]/15 shadow-md' : 'border-stone-200 hover:border-stone-300'}`}>
                  <div className="relative h-36 bg-stone-100 overflow-hidden">
                    <img src={catalogProducts.find(p => p.productType === 'accommodation' && /rainbow hotel/i.test(p.name))?.primaryImageUrl || 'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=900&q=80'} alt="Victoria Falls Rainbow Hotel" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" loading="lazy" />
                    <span className="absolute left-3 top-3 rounded-full bg-white/95 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-stone-700">Hotel standard</span>
                    {accommodationTier === 'rainbow_hotel' && <span className="absolute right-3 top-3 rounded-full bg-[#263B30] p-1.5 text-white"><Check className="w-3.5 h-3.5" /></span>}
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#17251D]/90 to-transparent px-4 pb-3 pt-8"><span className="text-xl font-bold text-white">US$130 <span className="text-xs font-medium text-white/80">/ room / night</span></span></div>
                  </div>
                  <div className="p-4">
                    <h5 className="font-semibold text-[#263B30]">Victoria Falls Rainbow Hotel</h5>
                    <p className="mt-1 text-xs leading-relaxed text-stone-600">Premium hotel stay with two students sharing each room, subject to room allocation.</p>
                    <p className="mt-3 text-xs font-semibold text-[#54775A]">{Math.ceil(studentCount / 2)} rooms · estimated US${130 * Math.ceil(studentCount / 2) * nightsCount} / night total</p>
                  </div>
                </button>
              </div>
            </div>

            {/* Activities: standard Syntuc product-card presentation */}
            <div className="space-y-4 pt-5 border-t border-stone-100">
              <div>
                <h4 className="text-xs uppercase font-bold tracking-wider text-stone-500">3. Educational Activities</h4>
                <p className="mt-1 text-xs text-stone-500">Select experiences for your delegation. Each card shows its school tariff and available media.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {([
                  { key: 'rainforestTour', title: 'Rainforest Guided Walking Tour', price: educationLevel === 'primary' ? 'US$1' : 'US$4', basis: 'per student', description: 'Explore the rainforest viewpoints with a naturalist guide and park access.', terms: ['rainforest guided', 'rainforest walking', 'guided walking tour'], priority: false, fallback: 'https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&w=900&q=80' },
                  { key: 'helicopterFlight', title: 'School Educational Helicopter Flight', price: 'US$70', basis: 'per student', description: 'A special school-group scenic flight over Victoria Falls and the surrounding gorge.', terms: ['flight of angels', 'helicopter', 'scenic flight'], priority: true, fallback: 'https://images.unsplash.com/photo-1436491865332-7a61a109cc05?auto=format&fit=crop&w=900&q=80' },
                  { key: 'quadBiking', title: 'Supervised Quad Biking', price: 'US$10', basis: 'per student', description: 'A supervised terrain ride with safety guidance for the student group.', terms: ['quad biking', 'quad bike'], priority: true, fallback: 'https://images.unsplash.com/photo-1558981806-ec527fa84c39?auto=format&fit=crop&w=900&q=80' },
                  { key: 'elephantInteraction', title: 'Elephant Sanctuary Educational Interaction', price: educationLevel === 'primary' ? 'US$10' : 'US$20', basis: 'per student', description: 'An educational wildlife encounter focused on elephant conservation.', terms: ['elephant interaction', 'elephant camp', 'elephant sanctuary'], priority: true, fallback: 'https://images.unsplash.com/photo-1557050543-4d5f4e07ef46?auto=format&fit=crop&w=900&q=80' },
                  { key: 'gameDrive', title: 'Zambezi National Park Safari Game Drive', price: 'US$15', basis: 'per student', description: 'A guided open-vehicle safari exploring the wildlife of Zambezi National Park.', terms: ['safari game drive', 'game drive'], priority: true, fallback: 'https://images.unsplash.com/photo-1516426122078-c23e76319801?auto=format&fit=crop&w=900&q=80' },
                  { key: 'boatCruise', title: 'Standard Zambezi River Boat Cruise', price: 'US$10', basis: 'per student + park fee', description: 'An educational river cruise introducing students to the Zambezi ecosystem.', terms: ['sunset cruise', 'river cruise', 'boat cruise'], priority: false, fallback: 'https://images.unsplash.com/photo-1500375592092-40eb2168fd21?auto=format&fit=crop&w=900&q=80' },
                  { key: 'crocodileFarm', title: 'Crocodile Farm Educational Tour', price: educationLevel === 'primary' ? 'US$3' : 'US$4', basis: 'per student', description: 'A guided educational visit focused on crocodiles and local wildlife.', terms: ['crocodile farm'], priority: false, fallback: 'https://images.unsplash.com/photo-1511497584788-876760111969?auto=format&fit=crop&w=900&q=80' },
                  { key: 'airportTour', title: 'Airport Aviation Tour', price: 'US$3', basis: 'per student', description: 'An aviation-focused educational visit introducing students to airport operations.', terms: ['airport aviation', 'airport tour'], priority: false, fallback: 'https://images.unsplash.com/photo-1436491865332-7a61a109cc05?auto=format&fit=crop&w=900&q=80' },
                  { key: 'includeBridgeTour', title: 'Victoria Falls Historic 1905 Bridge Tour', price: quoteResult?.bridgeIncentiveQualified ? 'COMPLIMENTARY' : 'US$20', basis: quoteResult?.bridgeIncentiveQualified ? 'incentive reward' : 'per student', description: 'Discover the history and engineering of the iconic Victoria Falls Bridge.', terms: ['historic bridge', 'bridge adventures'], priority: false, fallback: 'https://images.unsplash.com/photo-1519501025264-65ba15a82390?auto=format&fit=crop&w=900&q=80' },
                ] as const).map(activity => {
                  const selected = Boolean(selectedActivities[activity.key]);
                  const mediaProduct = mediaFor(activity.terms);
                  const imageUrl = mediaProduct?.primaryImageUrl || activity.fallback;
                  return (
                    <label key={activity.key} className={`group block overflow-hidden rounded-2xl border bg-white cursor-pointer transition-all duration-200 ${selected ? 'border-[#54775A] ring-2 ring-[#54775A]/15 shadow-md' : 'border-stone-200 hover:border-stone-300 hover:shadow-sm'}`}>
                      <input type="checkbox" checked={selected} onChange={() => toggleActivity(activity.key)} className="sr-only" />
                      <div className="relative h-40 overflow-hidden bg-stone-100">
                        <img src={imageUrl} alt={mediaProduct?.primaryImageAlt || activity.title} loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                        <div className="absolute inset-0 bg-gradient-to-t from-[#17251D]/75 via-transparent to-transparent" />
                        <span className="absolute left-3 top-3 rounded-full bg-white/95 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-stone-700">{activity.priority ? 'Bridge incentive eligible' : 'School tariff'}</span>
                        {selected && <span className="absolute right-3 top-3 rounded-full bg-[#263B30] p-1.5 text-white"><Check className="w-3.5 h-3.5" /></span>}
                        <div className="absolute inset-x-0 bottom-0 p-3">
                          <div className="text-xl font-bold text-white">{activity.price} <span className="text-xs font-medium text-white/80">{activity.basis}</span></div>
                        </div>
                      </div>
                      <div className="p-4">
                        <div className="flex items-start justify-between gap-2">
                          <h5 className="text-sm font-semibold leading-snug text-[#263B30]">{activity.title}</h5>
                          {activity.priority && <Gift className="h-4 w-4 shrink-0 text-[#A87938]" aria-label="May qualify for Bridge Tour incentive" />}
                        </div>
                        <p className="mt-2 text-xs leading-relaxed text-stone-600">{activity.description}</p>
                        {mediaProduct?.operatorName && <p className="mt-3 text-[11px] font-semibold text-[#54775A]">{mediaProduct.operatorName}</p>}
                        {mediaProduct?.videoUrl && <a href={mediaProduct.videoUrl} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-stone-100 px-3 py-1.5 text-[11px] font-semibold text-stone-700 hover:bg-stone-200"><Play className="h-3 w-3" /> Watch experience video</a>}
                        {activity.key === 'boatCruise' && <p className="mt-2 text-[10px] text-amber-800">Standard boat cruise does not qualify for the Bridge Tour incentive.</p>}
                        {activity.key === 'includeBridgeTour' && <p className="mt-2 text-[10px] text-stone-500">{quoteResult?.bridgeIncentiveQualified ? 'Your current selection qualifies for the complimentary bridge tour.' : 'Requires 2+ nights and 2 qualifying priority activities.'}</p>}
                      </div>
                    </label>
                  );
                })}
              </div>
              <p className="text-[11px] text-stone-500">Product photos and video links appear when verified media exists in the Syntuc catalogue. School-specific tariffs remain authoritative for this planner.</p>

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
