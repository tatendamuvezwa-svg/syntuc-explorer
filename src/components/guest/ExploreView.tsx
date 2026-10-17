import React, { useState, useEffect, useMemo } from 'react';
import { Product, Category } from '../../types/index.ts';
import { api } from '../../services/api.ts';
import { useSession } from '../../context/SessionContext.tsx';
import {
  Compass,
  MapPin,
  Clock,
  Sparkles,
  Bed,
  CheckCircle2,
  Calendar,
  ChevronRight,
  Filter,
  Plus,
  ArrowRight,
  ShieldCheck,
  Ship,
} from 'lucide-react';

interface ExploreViewProps {
  onOpenFeedback?: (productId?: string) => void;
}

export const ExploreView: React.FC<ExploreViewProps> = ({ onOpenFeedback }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeFilter, setActiveFilter] = useState<'all' | 'accommodation' | 'activity'>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedOperator, setSelectedOperator] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const { openProductDetail, addToTrip, openReservationModal, openSchoolPlanner } = useSession();

  useEffect(() => {
    async function loadData() {
      try {
        const [prodList, catList] = await Promise.all([
          api.getProducts().catch((err) => {
            console.warn('Notice loading products:', err);
            return [];
          }),
          api.getCategories().catch((err) => {
            console.warn('Notice loading categories:', err);
            return [];
          }),
        ]);
        if (prodList && prodList.length > 0) setProducts(prodList);
        if (catList && catList.length > 0) setCategories(catList);
      } catch (err) {
        console.warn('Notice in catalog data load:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const activityOperators = useMemo(() => {
    return Array.from(new Set(
      products
        .filter(product => product.productType === 'activity')
        .map(product => (product.operatorName || '').trim())
        .filter(Boolean)
    )).sort((a, b) => a.localeCompare(b));
  }, [products]);

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      // Type filter
      if (activeFilter !== 'all' && p.productType !== activeFilter) return false;
      // Category filter
      if (selectedCategory !== 'all' && p.categorySlug !== selectedCategory) return false;
      // Operator filter applies to activities only.
      if (activeFilter === 'activity' && selectedOperator !== 'all' && p.operatorName !== selectedOperator) return false;
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = p.name.toLowerCase().includes(q);
        const matchesDesc = p.description.toLowerCase().includes(q);
        const matchesOp = (p.operatorName || '').toLowerCase().includes(q);
        if (!matchesName && !matchesDesc && !matchesOp) return false;
      }
      return true;
    });
  }, [products, activeFilter, selectedCategory, selectedOperator, searchQuery]);

  const handleReviewCruise = (productId: string) => {
    if (onOpenFeedback) {
      onOpenFeedback(productId);
    } else {
      window.history.pushState({}, '', `/feedback?product=${encodeURIComponent(productId)}`);
      window.dispatchEvent(new PopStateEvent('popstate'));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF8F5]">
      {/* Hero Section — modern editorial destination experience */}
      <section className="syntuc-hero relative isolate min-h-[620px] overflow-hidden bg-[#15241D] text-white sm:min-h-[680px] lg:min-h-[720px]">
        <div className="absolute inset-0 -z-20">
          <img
            src="/hero.jpg"
            alt="Panoramic Victoria Falls, Zimbabwe, known as the Smoke That Thunders"
            fetchPriority="high"
            decoding="async"
            className="h-full w-full object-cover object-center"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.style.display = 'none';
            }}
          />
        </div>
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-[#101D17]/95 via-[#14231B]/72 to-[#14231B]/20" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-[#101D17]/85 via-transparent to-[#101D17]/15" />
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_76%_40%,rgba(197,151,94,0.15),transparent_38%)]" />

        <div className="mx-auto flex min-h-[620px] max-w-[1440px] flex-col justify-center px-5 pb-14 pt-16 sm:min-h-[680px] sm:px-8 sm:pb-16 lg:min-h-[720px] lg:px-14 xl:px-20">
          <div className="max-w-4xl">
            <div className="syntuc-hero-reveal mb-7 inline-flex items-center gap-2.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#E3C49A] sm:text-xs">
              <span className="h-px w-8 bg-[#C4975E]" />
              Victoria Falls · Zimbabwe
            </div>

            <h1 className="syntuc-hero-reveal syntuc-hero-delay-1 max-w-4xl font-display text-[clamp(3.25rem,8.1vw,7.25rem)] font-medium leading-[0.96] tracking-[-0.055em] text-white">
              Find your way<br className="hidden sm:block" /> to the extraordinary.
            </h1>

            <p className="syntuc-hero-reveal syntuc-hero-delay-2 mt-7 max-w-2xl text-base leading-7 text-white/85 sm:mt-8 sm:text-lg sm:leading-8">
              Discover remarkable places to stay, unforgettable experiences and local insight — with an intelligent guide to help you plan your Victoria Falls journey.
            </p>

            <div className="syntuc-hero-reveal syntuc-hero-delay-3 mt-9 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <button
                onClick={() => {
                  const el = document.getElementById('catalog-section');
                  if (el) el.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
                }}
                className="group inline-flex min-h-12 items-center justify-center gap-3 rounded-full bg-[#D2A66D] px-7 py-3.5 text-sm font-semibold text-[#17251D] shadow-[0_8px_28px_rgba(0,0,0,0.16)] transition duration-200 hover:bg-[#E1BB87] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#17251D]"
              >
                Explore experiences
                <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
              </button>

              <button
                onClick={() => {
                  const el = document.getElementById('syntuc-assistant-trigger');
                  if (el) el.click();
                }}
                className="inline-flex min-h-12 items-center justify-center gap-2.5 rounded-full border border-white/45 bg-white/[0.07] px-6 py-3.5 text-sm font-semibold text-white backdrop-blur-sm transition duration-200 hover:border-white/70 hover:bg-white/[0.14] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                <Sparkles className="h-4 w-4 text-[#E3C49A]" />
                Talk to Syntuc
              </button>

              <button
                onClick={openSchoolPlanner}
                className="inline-flex min-h-11 items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-white/80 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                Planning a school trip?
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          <div className="syntuc-hero-reveal syntuc-hero-delay-3 mt-14 flex flex-wrap gap-x-7 gap-y-3 border-t border-white/20 pt-5 text-xs font-medium tracking-wide text-white/75 sm:mt-16 sm:gap-x-10 sm:pt-6 sm:text-sm">
            <span className="inline-flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-[#D2A66D]" /> Curated local experiences</span>
            <span className="inline-flex items-center gap-2"><Calendar className="h-4 w-4 text-[#D2A66D]" /> Request-first reservations</span>
            <span className="inline-flex items-center gap-2"><MapPin className="h-4 w-4 text-[#D2A66D]" /> Human coordinator review</span>
          </div>
        </div>
      </section>

      {/* Main Catalog Section */}
      <section id="catalog-section" className="mx-auto max-w-[1440px] px-4 py-16 sm:px-6 lg:px-12 lg:py-20">
        {/* Filter Navigation Bar */}
        <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-[0_10px_40px_rgba(38,59,48,0.045)] border border-[#E8E5DE] mb-10">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            {/* Primary Category Switcher (All / Places to Stay / Activities) */}
            <div className="flex items-center space-x-1.5 p-1 bg-[#F0F1EC] rounded-xl">
              <button
                onClick={() => {
                  setActiveFilter('all');
                  setSelectedCategory('all');
                  setSelectedOperator('all');
                }}
                className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition ${
                  activeFilter === 'all'
                    ? 'bg-white text-[#263B30] shadow-sm'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                All Experiences
              </button>
              <button
                onClick={() => {
                  setActiveFilter('accommodation');
                  setSelectedCategory('all');
                  setSelectedOperator('all');
                }}
                className={`flex items-center space-x-1.5 px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition ${
                  activeFilter === 'accommodation'
                    ? 'bg-white text-[#263B30] shadow-xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                <Bed className="w-3.5 h-3.5 text-amber-700" />
                <span>Places to Stay</span>
              </button>
              <button
                onClick={() => {
                  setActiveFilter('activity');
                  setSelectedCategory('all');
                  setSelectedOperator('all');
                }}
                className={`flex items-center space-x-1.5 px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition ${
                  activeFilter === 'activity'
                    ? 'bg-white text-[#263B30] shadow-xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                <Compass className="w-3.5 h-3.5 text-amber-700" />
                <span>Activities & Safaris</span>
              </button>
            </div>

            {/* Search Input */}
            <div className="w-full md:w-72">
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search lodges, flights, cruises..."
                className="w-full px-4 py-2 rounded-xl bg-stone-50 border border-stone-200 text-sm text-stone-800 placeholder-stone-400 focus:outline-hidden focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition"
              />
            </div>
          </div>

          {/* Subcategory Pills */}
          <div className="mt-4 pt-4 border-t border-stone-100 flex items-center gap-2 overflow-x-auto pb-1 text-xs">
            <span className="text-stone-400 font-medium whitespace-nowrap flex items-center mr-1">
              <Filter className="w-3 h-3 mr-1" /> Category:
            </span>
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-3 py-1 rounded-full whitespace-nowrap transition cursor-pointer font-medium ${
                selectedCategory === 'all'
                  ? 'bg-stone-800 text-white'
                  : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
              }`}
            >
              All Categories
            </button>
            {categories
              .filter(c => (activeFilter === 'all' ? true : c.type === activeFilter))
              .map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.slug)}
                  className={`px-3 py-1 rounded-full whitespace-nowrap transition cursor-pointer font-medium ${
                    selectedCategory === cat.slug
                      ? 'bg-amber-700 text-white'
                      : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                  }`}
                >
                  {cat.name}
                </button>
              ))}
          </div>

          {/* Operator filter: activity suppliers often offer several experiences. */}
          {activeFilter === 'activity' && activityOperators.length > 0 && (
            <div className="mt-4 flex flex-col gap-2 border-t border-stone-100 pt-4 sm:flex-row sm:items-start">
              <span className="flex shrink-0 items-center gap-1.5 pt-1 text-xs font-medium text-stone-500">
                <Filter className="h-3 w-3" /> Operator:
              </span>
              <div className="flex min-w-0 flex-wrap gap-2" role="group" aria-label="Filter activities by operator">
                <button
                  type="button"
                  aria-pressed={selectedOperator === 'all'}
                  onClick={() => setSelectedOperator('all')}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${selectedOperator === 'all' ? 'bg-[#263B30] text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}
                >
                  All Operators
                </button>
                {activityOperators.map(operator => (
                  <button
                    key={operator}
                    type="button"
                    aria-pressed={selectedOperator === operator}
                    onClick={() => setSelectedOperator(operator)}
                    className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${selectedOperator === operator ? 'bg-[#54775A] text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}
                  >
                    {operator}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Product Cards Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div
                key={i}
                className="bg-white rounded-2xl h-96 border border-stone-200 animate-pulse p-4 flex flex-col justify-between"
              >
                <div className="w-full h-48 bg-stone-200 rounded-xl" />
                <div className="space-y-2 mt-4">
                  <div className="w-2/3 h-4 bg-stone-200 rounded" />
                  <div className="w-full h-3 bg-stone-100 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-stone-200 p-8">
            <Compass className="w-12 h-12 text-stone-300 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-stone-800 font-display">
              No experiences match your filter
            </h3>
            <p className="text-sm text-stone-500 mt-1 max-w-sm mx-auto">
              Try adjusting your category selection or clear your search query to see all verified offerings.
            </p>
            <button
              onClick={() => {
                setActiveFilter('all');
                setSelectedCategory('all');
                setSelectedOperator('all');
                setSearchQuery('');
              }}
              className="mt-4 px-4 py-2 rounded-xl bg-amber-600 text-white text-xs font-semibold"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredProducts.map((product) => {
              const isHeritageCruise = product.id === 'heritage-standard-sunset-cruise';
              const breakdown = (product as any).pricingBreakdown;

              return (
                <div
                  key={product.id}
                  className="group bg-white rounded-2xl border border-[#E8E5DE] hover:border-[#C9D6C7] overflow-hidden shadow-[0_4px_24px_rgba(38,59,48,0.035)] hover:shadow-[0_16px_44px_rgba(38,59,48,0.09)] transition-all duration-300 flex flex-col justify-between"
                >
                  {/* Image & Badges */}
                  <div
                    className="relative h-56 w-full overflow-hidden bg-stone-100 cursor-pointer"
                    onClick={() => openProductDetail(product.id)}
                  >
                    <img
                      src={product.primaryImageUrl || 'https://images.unsplash.com/photo-1549880338-65ddcdfd017b?auto=format&fit=crop&w=800&q=80'}
                      alt={product.primaryImageAlt || product.name}
                      className="w-full h-full object-cover group-hover:scale-[1.025] transition-transform duration-500"
                      loading="lazy"
                    />

                    {/* Product Type Tag */}
                    <div className="absolute top-3 left-3 flex items-center space-x-1.5">
                      <span
                        className={`text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg backdrop-blur-md shadow-xs ${
                          product.productType === 'accommodation'
                            ? 'bg-[#20372B]/90 text-[#E2BE8C] border border-white/15'
                            : 'bg-[#20372B]/90 text-[#D6E2D1] border border-white/15'
                        }`}
                      >
                        {product.productType === 'accommodation' ? 'Lodge & Hotel' : 'Activity & Tour'}
                      </span>
                    </div>

                    {/* Verified Partner Badge */}
                    <div className="absolute top-3 right-3 bg-white/95 backdrop-blur-xs text-stone-800 text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center shadow-xs">
                      <ShieldCheck className="w-3 h-3 text-[#54775A] mr-1" /> Verified
                    </div>

                    {/* Price Banner */}
                    <div className="absolute bottom-3 left-3 right-3 bg-[#17251D]/88 backdrop-blur-md text-white px-3 py-1.5 rounded-xl flex justify-between items-center text-xs">
                      <div className="flex items-baseline space-x-1">
                        <span className="text-[10px] text-stone-300 font-medium">
                          {isHeritageCruise ? 'Cruise Price' : 'Starting from'}
                        </span>
                        <span className="text-base font-bold text-[#E2BE8C]">
                          US${product.basePrice}
                        </span>
                      </div>
                      <span className="text-[11px] text-stone-300">
                        {product.priceBasis === 'per_room_night' ? 'per room / night' : 'per person'}
                      </span>
                    </div>
                  </div>

                  {/* Card Content */}
                  <div className="p-5 flex-1 flex flex-col justify-between">
                    <div>
                      {/* Operator & Location */}
                      <div className="flex items-center justify-between text-xs text-stone-500 mb-1.5">
                        <span className="font-semibold text-[#365D43] truncate">
                          {product.operatorName || 'Verified Partner'}
                        </span>
                        {product.duration && (
                          <span className="flex items-center text-stone-400 ml-2 whitespace-nowrap">
                            <Clock className="w-3 h-3 mr-1" />
                            {product.duration}
                          </span>
                        )}
                      </div>

                      {/* Title */}
                      <h3
                        onClick={() => openProductDetail(product.id)}
                        className="text-xl font-medium tracking-[-0.02em] text-[#263B30] group-hover:text-[#54775A] transition font-display line-clamp-1 cursor-pointer"
                      >
                        {product.name}
                      </h3>

                      {/* Short Description */}
                      <p className="mt-2 text-xs text-stone-600 line-clamp-2 leading-relaxed">
                        {product.shortDescription}
                      </p>

                      {/* Dedicated Cruise Price & Park Fees breakdown for Heritage Standard Sunset Cruise */}
                      {(isHeritageCruise || breakdown) && (
                        <div className="mt-3.5 p-3 rounded-xl bg-[#FAF8F5] border border-[#E8E4DA] text-xs space-y-2">
                          <div className="flex items-center justify-between text-stone-700">
                            <span className="font-semibold">Cruise Price:</span>
                            <span className="font-bold text-[#20372B]">
                              US${breakdown?.cruisePrice ?? product.basePrice} per person
                            </span>
                          </div>

                          <div className="space-y-1 pt-1.5 border-t border-[#E8E4DA]/80 text-[11px]">
                            <div className="flex items-center justify-between text-stone-600">
                              <span>Park fee — international guests:</span>
                              <span className="font-semibold text-stone-800">
                                US${breakdown?.parkFeeInternational ?? 12} per person
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-stone-600">
                              <span>Park fee — local guests:</span>
                              <span className="font-semibold text-stone-800">
                                US${breakdown?.parkFeeLocal ?? 6} per person
                              </span>
                            </div>
                          </div>

                          <div className="pt-2 border-t border-[#E8E4DA] space-y-1">
                            <span className="text-[10px] uppercase tracking-wider font-bold text-[#8B6A3E] block">
                              Indicative Totals (Includes Cruise + Applicable Park Fee):
                            </span>
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-stone-700 font-medium">International guests:</span>
                              <span className="font-bold text-[#20372B] font-display">
                                US${breakdown?.totalInternational ?? 64} per person
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-stone-700 font-medium">Local guests:</span>
                              <span className="font-bold text-[#20372B] font-display">
                                US${breakdown?.totalLocal ?? 58} per person
                              </span>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Key inclusions chips */}
                      {!isHeritageCruise && !breakdown && product.inclusions && product.inclusions.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-1">
                          {product.inclusions.slice(0, 2).map((inc, i) => (
                            <span
                              key={i}
                              className="inline-flex items-center text-[10px] text-stone-600 bg-stone-100 px-2 py-0.5 rounded-md"
                            >
                              <CheckCircle2 className="w-2.5 h-2.5 text-[#54775A] mr-1 shrink-0" />
                              <span className="truncate max-w-[140px]">{inc}</span>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="mt-5 pt-4 border-t border-stone-100 flex flex-wrap items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => openProductDetail(product.id)}
                        className="px-3 py-1.5 text-xs font-semibold text-stone-700 hover:text-stone-900 transition flex items-center cursor-pointer"
                        title="View Experience Details"
                      >
                        <span>View Experience</span>
                        <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
                      </button>

                      <div className="flex items-center space-x-1.5 flex-wrap">
                        {/* Visible "Review This Cruise" Action */}
                        {(isHeritageCruise || product.categorySlug === 'river-cruises') && (
                          <button
                            type="button"
                            onClick={() => handleReviewCruise(product.id)}
                            className="px-2.5 py-1.5 text-xs font-semibold bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 rounded-lg transition flex items-center cursor-pointer shadow-2xs"
                            title="Submit a guest review for this cruise"
                          >
                            <Ship className="w-3 h-3 mr-1 text-amber-700" />
                            <span>Review This Cruise</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => addToTrip({ productId: product.id })}
                          className="px-2.5 py-1.5 text-xs font-semibold bg-[#F0F1EC] hover:bg-[#E5E9E1] text-[#263B30] rounded-lg transition flex items-center cursor-pointer"
                          title="Add to My Trip"
                        >
                          <Plus className="w-3 h-3 mr-0.5 text-amber-700" />
                          <span>Add</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            addToTrip({ productId: product.id });
                            openReservationModal();
                          }}
                          className="px-3 py-1.5 text-xs font-semibold bg-[#263B30] hover:bg-[#34513F] text-white rounded-lg shadow-xs transition cursor-pointer"
                        >
                          Reserve
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};
