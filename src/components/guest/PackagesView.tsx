import React, { useState, useEffect } from 'react';
import { Package } from '../../types/index.ts';
import { api } from '../../services/api.ts';
import { useSession } from '../../context/SessionContext.tsx';
import { CheckCircle2, Clock, Sparkles, ShieldCheck, ArrowRight, Calendar, Users } from 'lucide-react';

export const PackagesView: React.FC = () => {
  const [packages, setPackages] = useState<Package[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const { openReservationModal, showToast, addToTrip } = useSession();

  useEffect(() => {
    async function load() {
      try {
        const pkgs = await api.getPackages();
        setPackages(pkgs);
      } catch (err) {
        console.error('Failed to load packages:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div className="min-h-screen bg-[#FBFAF7] py-14 sm:py-18">
      <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-12">
        {/* Header */}
        <div className="max-w-2xl">
          <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-[#EEF1E9] text-[#365D43] text-xs font-semibold uppercase tracking-wider mb-3">
            <Sparkles className="w-3 h-3 text-[#967044]" />
            <span>Curated Multi-Day Journeys</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-medium tracking-[-0.04em] text-[#263B30] font-display">
            Victoria Falls Packages
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-stone-600 sm:text-lg">
            Thoughtfully packaged combinations of verified accommodations, scenic helicopter flights, rainforest walking tours, and Zambezi river safaris.
          </p>
        </div>

        {/* Packages Grid */}
        {loading ? (
          <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-8 animate-pulse">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-white rounded-2xl h-96 border border-[#E8E5DE]" />
            ))}
          </div>
        ) : (
          <div className="mt-10 grid grid-cols-1 lg:grid-cols-3 gap-8">
            {packages.map(pkg => (
              <div
                key={pkg.id}
                id={pkg.id}
                className="bg-white rounded-2xl border border-[#E8E5DE] shadow-[0_4px_24px_rgba(38,59,48,0.035)] hover:shadow-[0_16px_44px_rgba(38,59,48,0.09)] transition-all overflow-hidden flex flex-col justify-between"
              >
                <div>
                  {/* Hero image banner */}
                  <div className="relative h-60 w-full overflow-hidden bg-stone-100">
                    <img
                      src={pkg.primaryImageUrl}
                      alt={pkg.name}
                      className="w-full h-full object-cover hover:scale-[1.025] transition-transform duration-500"
                    />
                    <div className="absolute top-3 left-3 bg-stone-950/80 backdrop-blur-md text-white text-xs font-bold px-3 py-1 rounded-lg flex items-center">
                      <Clock className="w-3.5 h-3.5 mr-1 text-[#E2BE8C]" />
                      {pkg.durationDays} Days / {pkg.durationNights} Nights
                    </div>

                    <div className="absolute bottom-3 right-3 bg-white/95 backdrop-blur-md text-stone-900 px-3 py-1 rounded-xl shadow-md text-right">
                      <div className="text-[10px] text-stone-500 uppercase font-semibold">From</div>
                      <div className="text-xl font-medium text-[#263B30] font-display leading-tight">
                        US${pkg.pricePerPerson}
                      </div>
                      <div className="text-[10px] text-stone-400">per person</div>
                    </div>
                  </div>

                  {/* Body */}
                  <div className="p-6">
                    <h3 className="text-2xl font-medium tracking-[-0.025em] text-[#263B30] font-display">{pkg.name}</h3>
                    <p className="text-xs text-[#967044] font-semibold mt-2">{pkg.tagline}</p>
                    <p className="mt-3 text-sm text-stone-600 leading-6">{pkg.description}</p>

                    {/* Highlights */}
                    {pkg.highlights && pkg.highlights.length > 0 && (
                      <div className="mt-5 pt-4 border-t border-stone-100">
                        <h4 className="text-[11px] font-bold uppercase tracking-wider text-stone-400 mb-2">
                          Package Highlights
                        </h4>
                        <ul className="space-y-1.5 text-xs text-stone-700">
                          {pkg.highlights.map((hl, i) => (
                            <li key={i} className="flex items-start">
                              <CheckCircle2 className="w-3.5 h-3.5 text-[#54775A] mr-2 shrink-0 mt-0.5" />
                              <span>{hl}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer action */}
                <div className="p-6 pt-0">
                  <button
                    onClick={async () => {
                      showToast(`Adding "${pkg.name}" to trip...`);
                      await addToTrip({ productId: pkg.id });
                      openReservationModal();
                    }}
                    className="w-full min-h-12 py-3.5 rounded-full bg-[#263B30] hover:bg-[#34513F] text-white font-semibold text-sm transition flex items-center justify-center cursor-pointer"
                  >
                    <span>Inquire About This Package</span>
                    <ArrowRight className="w-4 h-4 ml-1.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
