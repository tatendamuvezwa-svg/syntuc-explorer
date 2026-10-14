import React from 'react';
import { Compass, Sparkles, MapPin, ShoppingBag, GraduationCap, ShieldCheck, UserCheck } from 'lucide-react';
import { useSession } from '../../context/SessionContext.tsx';

interface NavbarProps {
  onOpenCoordinator: () => void;
  isCoordinatorView: boolean;
  onExitCoordinator: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  onOpenCoordinator,
  isCoordinatorView,
  onExitCoordinator,
}) => {
  const { activeTab, setActiveTab, cartCount, openMyTrip, openSchoolPlanner } = useSession();

  return (
    <header className="sticky top-0 z-40 border-b border-[#E8E5DE] bg-[#FBFAF7]/95 backdrop-blur-xl">
      {/* Top micro-bar: SAINTECH product signature and trust indicator */}
      <div className="bg-[#20372B] text-white/75 text-[11px] px-4 py-2 flex justify-between items-center tracking-wide">
        <div className="flex items-center space-x-2">
          <span className="font-semibold text-[#E2BE8C]">SAINTECH</span>
          <span className="text-white/55 hidden sm:inline">| Smart Artificial Intelligence Native Technologies</span>
        </div>
        <div className="flex items-center space-x-4 text-[11px]">
          <span className="flex items-center text-white/75">
            <MapPin className="w-3 h-3 text-amber-400 mr-1" /> Victoria Falls, Zimbabwe
          </span>
          <button
            onClick={isCoordinatorView ? onExitCoordinator : onOpenCoordinator}
            className="text-white/65 hover:text-white transition flex items-center font-medium cursor-pointer"
          >
            <UserCheck className="w-3 h-3 mr-1 text-[#C5D8B8]" />
            {isCoordinatorView ? 'Exit Desk View' : 'Reservations Desk'}
          </button>
        </div>
      </div>

      {/* Main navigation */}
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-12 min-h-[76px] flex items-center justify-between gap-4">
        {/* Brand identity */}
        <div
          onClick={() => {
            if (isCoordinatorView) onExitCoordinator();
            setActiveTab('explore');
          }}
          className="flex items-center space-x-3 cursor-pointer group"
        >
          <div className="w-10 h-10 rounded-2xl bg-[#263B30] flex items-center justify-center text-white transition-colors group-hover:bg-[#34513F]">
            <Compass className="w-5 h-5" strokeWidth={1.7} />
          </div>
          <div>
            <div className="flex items-baseline space-x-1.5">
              <span className="text-lg sm:text-xl font-semibold tracking-[-0.035em] text-[#24382E] font-display">
                Syntuc Explorer
              </span>
              <span className="text-[9px] uppercase font-bold tracking-[0.12em] text-[#5A705F] bg-[#EEF1E9] px-2 py-1 rounded-full border border-[#DCE4D8]">
                Victoria Falls
              </span>
            </div>
            <p className="text-[11px] text-stone-500 font-medium tracking-wide">
              Explore. Plan. Experience.
            </p>
          </div>
        </div>

        {/* Guest Nav Links */}
        {!isCoordinatorView && (
          <nav className="hidden md:flex items-center space-x-1">
            <button
              onClick={() => setActiveTab('explore')}
              className={`px-3.5 py-2 rounded-lg text-sm font-semibold transition ${
                activeTab === 'explore'
                  ? 'text-[#263B30] bg-[#EAF0E8] border border-[#DCE6D9]'
                  : 'text-stone-600 hover:text-[#263B30] hover:bg-[#F0F1EC]'
              }`}
            >
              Explore
            </button>
            <button
              onClick={() => setActiveTab('packages')}
              className={`px-3.5 py-2 rounded-lg text-sm font-semibold transition ${
                activeTab === 'packages'
                  ? 'text-amber-800 bg-amber-50 border border-amber-200/60 shadow-xs'
                  : 'text-stone-600 hover:text-stone-900 hover:bg-stone-50'
              }`}
            >
              Curated Packages
            </button>
            <button
              onClick={openSchoolPlanner}
              className="px-3.5 py-2 rounded-lg text-sm font-semibold text-[#365D43] bg-[#EAF0E8] hover:bg-[#DFE9DC] border border-[#D8E3D5] transition flex items-center"
            >
              <GraduationCap className="w-4 h-4 mr-1.5 text-emerald-700" />
              School Trips
            </button>
          </nav>
        )}

        {/* Action Buttons: My Trip & Digital Guide */}
        <div className="flex items-center space-x-3">
          {!isCoordinatorView ? (
            <>
              <button
                onClick={openMyTrip}
                className="relative flex items-center space-x-2 px-3.5 py-2 rounded-xl bg-[#F0F0EA] hover:bg-[#E6E8E0] text-[#263B30] text-sm font-semibold transition cursor-pointer"
              >
                <ShoppingBag className="w-4 h-4 text-[#967044]" />
                <span className="hidden sm:inline">My Trip</span>
                {cartCount > 0 && (
                  <span className="w-5 h-5 rounded-full bg-[#263B30] text-white text-xs font-bold flex items-center justify-center">
                    {cartCount}
                  </span>
                )}
              </button>

              <button
                onClick={() => {
                  const assistantTrigger = document.getElementById('syntuc-assistant-trigger');
                  if (assistantTrigger) assistantTrigger.click();
                }}
                className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-[#263B30] hover:bg-[#34513F] text-white text-sm font-semibold transition cursor-pointer"
              >
                <Sparkles className="w-4 h-4 text-[#E2BE8C]" />
                <span>Talk to Syntuc</span>
              </button>
            </>
          ) : (
            <div className="flex items-center space-x-2">
              <span className="text-xs font-semibold uppercase text-[#365D43] bg-[#EAF0E8] px-2.5 py-1 rounded-md border border-[#D8E3D5] flex items-center">
                <ShieldCheck className="w-3.5 h-3.5 mr-1" /> Coordinator Desk Active
              </span>
              <button
                onClick={onExitCoordinator}
                className="px-3 py-1.5 text-xs font-medium text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-lg transition"
              >
                Return to Explorer
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
