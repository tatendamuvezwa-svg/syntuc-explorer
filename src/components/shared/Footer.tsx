import React from 'react';
import { Compass, ShieldCheck, HeartHandshake, MapPin, Sparkles } from 'lucide-react';
import { useSession } from '../../context/SessionContext.tsx';

export const Footer: React.FC = () => {
  const { setActiveTab, openSchoolPlanner } = useSession();

  return (
    <footer className="bg-stone-900 text-stone-300 border-t border-stone-800">
      {/* Trust bar */}
      <div className="border-b border-stone-800 py-8 bg-stone-950/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="flex items-start space-x-3.5">
            <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-white">Verified Local Partners</h4>
              <p className="text-xs text-stone-400 mt-1">
                Official contracted operators in Victoria Falls, Zimbabwe with authentic tariffs and verified safety credentials.
              </p>
            </div>
          </div>

          <div className="flex items-start space-x-3.5">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <HeartHandshake className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-white">No Upfront Payment</h4>
              <p className="text-xs text-stone-400 mt-1">
                Submit your reservation request freely. Partner availability is physically confirmed before any commitment.
              </p>
            </div>
          </div>

          <div className="flex items-start space-x-3.5">
            <div className="p-2.5 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-white">Intelligent Destination Guidance</h4>
              <p className="text-xs text-stone-400 mt-1">
                Ground-truth advice for rainforest walks, scenic helicopter flights, Zambezi cruises, and educational trips.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main footer contents */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="md:col-span-2">
            <div className="flex items-center space-x-2.5 mb-3">
              <div className="w-8 h-8 rounded-lg bg-amber-600 flex items-center justify-center text-white font-bold">
                <Compass className="w-5 h-5" />
              </div>
              <span className="text-lg font-bold text-white font-display">Syntuc Explorer</span>
            </div>
            <p className="text-sm text-stone-400 max-w-md leading-relaxed">
              Explore. Plan. Experience. Your intelligent guide to Victoria Falls, Zimbabwe. Dedicated to showcasing the majestic Mosi-oa-Tunya and the Zambezi River.
            </p>
            <div className="mt-4 flex items-center text-xs text-stone-400">
              <MapPin className="w-3.5 h-3.5 text-amber-400 mr-1.5" />
              Victoria Falls Tourism Hub, Parkway Drive, Victoria Falls, Zimbabwe
            </div>
          </div>

          <div>
            <h4 className="text-xs uppercase tracking-wider font-bold text-stone-200 mb-3">Explore</h4>
            <ul className="space-y-2 text-sm text-stone-400">
              <li>
                <button onClick={() => setActiveTab('explore')} className="hover:text-white transition">
                  Riverfront Lodges & Hotels
                </button>
              </li>
              <li>
                <button onClick={() => setActiveTab('explore')} className="hover:text-white transition">
                  Scenic Helicopter Tours
                </button>
              </li>
              <li>
                <button onClick={() => setActiveTab('explore')} className="hover:text-white transition">
                  Zambezi Luxury Cruises
                </button>
              </li>
              <li>
                <button onClick={() => setActiveTab('packages')} className="hover:text-white transition">
                  Curated Packages
                </button>
              </li>
              <li>
                <button onClick={openSchoolPlanner} className="text-amber-400 hover:text-amber-300 transition font-medium">
                  School Trip Commercial Planner
                </button>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-xs uppercase tracking-wider font-bold text-stone-200 mb-3">Commercial Trust</h4>
            <p className="text-xs text-stone-400 leading-relaxed mb-3">
              Syntuc Explorer is a destination management service. Reservation requests are submitted without payment and reviewed by human partner desks.
            </p>
            <div className="bg-stone-800/80 p-3 rounded-lg border border-stone-700/60 text-xs">
              <div className="font-semibold text-white">Bridge Tour Incentive</div>
              <p className="text-[11px] text-stone-400 mt-1">
                Complimentary Historic 1905 Bridge Tour when booking 2+ nights accommodation + 2 qualifying priority activities.
              </p>
            </div>
          </div>
        </div>

        {/* Bottom SAINTECH signature */}
        <div className="mt-12 pt-8 border-t border-stone-800 flex flex-col sm:flex-row justify-between items-center text-xs text-stone-500">
          <p>© {new Date().getFullYear()} Syntuc Explorer. All rights reserved.</p>
          <div className="mt-4 sm:mt-0 flex items-center space-x-2">
            <span>Built by</span>
            <span className="font-bold text-stone-300 tracking-wider">SAINTECH</span>
            <span className="text-[10px] text-stone-500 hidden md:inline">
              (Smart Artificial Intelligence Native Technologies)
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
};
