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
} from 'lucide-react';

export const ExploreView: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeFilter, setActiveFilter] = useState<'all' | 'accommodation' | 'activity'>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const { openProductDetail, addToTrip, openReservationModal, openSchoolPlanner } = useSession();

  useEffect(() => {
    async function loadData() {
      try {
        const [prodList, catList] = await Promise.all([
          api.getProducts(),
          api.getCategories(),
        ]);
        setProducts(prodList);
        setCategories(catList);
      } catch (err) {
        console.error('Failed to load catalog data:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      // Type filter
      if (activeFilter !== 'all' && p.productType !== activeFilter) return false;
      // Category filter
      if (selectedCategory !== 'all' && p.categorySlug !== selectedCategory) return false;
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
  }, [products, activeFilter, selectedCategory, searchQuery]);

  return (
    <div className="min-h-screen bg-[#FAF8F5]">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-stone-950 py-16 sm:py-24 text-white">
        {/* Authoritative Victoria Falls Hero Image */}
        <div className="absolute inset-0 z-0 overflow-hidden">
          <img
            src="/hero.jpg"
            alt="Victoria Falls, Zimbabwe - The Smoke That Thunders"
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover object-center opacity-70 filter brightness-95 contrast-105"
            onError={(e) => {
              // Fallback to secondary asset if /hero.jpg fails
              const target = e.target as HTMLImageElement;
              if (!target.src.includes('unsplash')) {
                target.src = 'https://images.unsplash.com/photo-1549880338-65ddcdfd017b?auto=format&fit=crop&w=2000&q=80';
              }
            }}
          />
          {/* Gradients ensuring high text readability while vividly showcasing the Victoria Falls photograph */}
          <div className="absolute inset-0 bg-stone-950/40" />
          <div className="absolute inset-0 bg-gradient-to-r from-stone-950/90 via-stone-950/60 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-stone-950 via-transparent to-stone-950/40" />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center sm:text-left">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-semibold uppercase tracking-wider mb-4">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Syntuc Explorer • Victoria Falls, Zimbabwe</span>
          </div>

          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white font-display max-w-3xl leading-tight">
            Explore. Plan. Experience.
          </h1>

          <p className="mt-4 text-lg sm:text-xl text-stone-200 max-w-2xl font-normal leading-relaxed drop-shadow-xs">
            Discover verified luxury river lodges, scenic helicopter flights over the Falls, peaceful Zambezi sunset cruises, and authentic African safaris coordinated with local operators.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <button
              onClick={() => {
                const el = document.getElementById('catalog-section');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
              }}
              className="px-6 py-3 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-semibold text-sm transition shadow-lg shadow-amber-600/30 cursor-pointer flex items-center"
            >
              <span>Explore Verified Experiences</span>
              <ChevronRight className="w-4 h-4 ml-1.5" />
            </button>

            <button
              onClick={() => {
                const el = document.getElementById('syntuc-assistant-trigger');
                if (el) el.click();
              }}
              className="px-5 py-3 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40 font-semibold text-sm transition backdrop-blur-xs cursor-pointer flex items-center"
            >
              <Sparkles className="w-4 h-4 mr-2 text-amber-300" />
              <span>Talk to Syntuc</span>
            </button>

            <button
              onClick={openSchoolPlanner}
              className="px-5 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/20 font-semibold text-sm transition backdrop-blur-xs cursor-pointer flex items-center"
            >
              <span>School Trip Commercial Planner</span>
              <span className="ml-2 text-[10px] bg-emerald-500 text-white px-1.5 py-0.5 rounded font-bold">
                From $15
              </span>
            </button>
          </div>

          {/* Quick trust metrics */}
          <div className="mt-12 pt-8 border-t border-white/10 grid grid-cols-2 sm:grid-cols-4 gap-6 text-stone-300 text-xs">
            <div>
              <div className="text-xl font-bold text-amber-400 font-display">100% Verified</div>
              <div className="text-stone-400 mt-0.5">Contracted local operators</div>
            </div>
            <div>
              <div className="text-xl font-bold text-amber-400 font-display">No Payment</div>
              <div className="text-stone-400 mt-0.5">Required to submit requests</div>
            </div>
            <div>
              <div className="text-xl font-bold text-amber-400 font-display">Historic Bridge</div>
              <div className="text-stone-400 mt-0.5">$0 incentive on 2N + 2 activities</div>
            </div>
            <div>
              <div className="text-xl font-bold text-amber-400 font-display">Desk Review</div>
              <div className="text-stone-400 mt-0.5">Personal coordinator support</div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Catalog Section */}
      <section id="catalog-section" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Filter Navigation Bar */}
        <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-sm border border-stone-200/80 mb-10">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            {/* Primary Category Switcher (All / Places to Stay / Activities) */}
            <div className="flex items-center space-x-1.5 p-1 bg-stone-100 rounded-xl">
              <button
                onClick={() => {
                  setActiveFilter('all');
                  setSelectedCategory('all');
                }}
                className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition ${
                  activeFilter === 'all'
                    ? 'bg-white text-stone-900 shadow-xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                All Experiences
              </button>
              <button
                onClick={() => {
                  setActiveFilter('accommodation');
                  setSelectedCategory('all');
                }}
                className={`flex items-center space-x-1.5 px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition ${
                  activeFilter === 'accommodation'
                    ? 'bg-white text-amber-900 shadow-xs'
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
                }}
                className={`flex items-center space-x-1.5 px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition ${
                  activeFilter === 'activity'
                    ? 'bg-white text-amber-900 shadow-xs'
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
                setSearchQuery('');
              }}
              className="mt-4 px-4 py-2 rounded-xl bg-amber-600 text-white text-xs font-semibold"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredProducts.map(product => (
              <div
                key={product.id}
                className="group bg-white rounded-2xl border border-stone-200/90 hover:border-amber-400/60 overflow-hidden shadow-xs hover:shadow-xl hover:shadow-stone-900/5 transition-all duration-300 flex flex-col justify-between"
              >
                {/* Image & Badges */}
                <div
                  className="relative h-56 w-full overflow-hidden bg-stone-100 cursor-pointer"
                  onClick={() => openProductDetail(product.id)}
                >
                  <img
                    src={product.primaryImageUrl || 'https://images.unsplash.com/photo-1549880338-65ddcdfd017b?auto=format&fit=crop&w=800&q=80'}
                    alt={product.primaryImageAlt || product.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    loading="lazy"
                  />

                  {/* Product Type Tag */}
                  <div className="absolute top-3 left-3 flex items-center space-x-1.5">
                    <span
                      className={`text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg backdrop-blur-md shadow-xs ${
                        product.productType === 'accommodation'
                          ? 'bg-amber-950/80 text-amber-200 border border-amber-400/30'
                          : 'bg-stone-950/80 text-emerald-200 border border-emerald-400/30'
                      }`}
                    >
                      {product.productType === 'accommodation' ? 'Lodge & Hotel' : 'Activity & Tour'}
                    </span>
                  </div>

                  {/* Verified Partner Badge */}
                  <div className="absolute top-3 right-3 bg-white/95 backdrop-blur-xs text-stone-800 text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center shadow-xs">
                    <ShieldCheck className="w-3 h-3 text-emerald-600 mr-1" /> Verified
                  </div>

                  {/* Price Banner */}
                  <div className="absolute bottom-3 left-3 right-3 bg-stone-950/75 backdrop-blur-md text-white px-3 py-1.5 rounded-xl flex justify-between items-center text-xs">
                    <div className="flex items-baseline space-x-1">
                      <span className="text-[10px] text-stone-300 font-medium">From</span>
                      <span className="text-base font-bold text-amber-400">
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
                      <span className="font-semibold text-amber-800 truncate">
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
                      className="text-lg font-bold text-stone-900 group-hover:text-amber-800 transition font-display line-clamp-1 cursor-pointer"
                    >
                      {product.name}
                    </h3>

                    {/* Short Description */}
                    <p className="mt-2 text-xs text-stone-600 line-clamp-2 leading-relaxed">
                      {product.shortDescription}
                    </p>

                    {/* Key inclusions chips */}
                    {product.inclusions && product.inclusions.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1">
                        {product.inclusions.slice(0, 2).map((inc, i) => (
                          <span
                            key={i}
                            className="inline-flex items-center text-[10px] text-stone-600 bg-stone-100 px-2 py-0.5 rounded-md"
                          >
                            <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600 mr-1 shrink-0" />
                            <span className="truncate max-w-[140px]">{inc}</span>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="mt-5 pt-4 border-t border-stone-100 flex items-center justify-between gap-2">
                    <button
                      onClick={() => openProductDetail(product.id)}
                      className="px-3 py-1.5 text-xs font-semibold text-stone-700 hover:text-stone-900 transition flex items-center cursor-pointer"
                    >
                      <span>Details</span>
                      <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
                    </button>

                    <div className="flex items-center space-x-1.5">
                      <button
                        onClick={() => addToTrip({ productId: product.id })}
                        className="px-3 py-1.5 text-xs font-semibold bg-stone-100 hover:bg-stone-200 text-stone-800 rounded-lg transition flex items-center cursor-pointer"
                      >
                        <Plus className="w-3 h-3 mr-1 text-amber-700" />
                        <span>Add to Trip</span>
                      </button>

                      <button
                        onClick={() => {
                          addToTrip({ productId: product.id });
                          openReservationModal();
                        }}
                        className="px-3.5 py-1.5 text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded-lg shadow-xs transition cursor-pointer"
                      >
                        Reserve
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
