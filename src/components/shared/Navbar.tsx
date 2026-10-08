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
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-stone-200 transition-all">
      {/* Top micro-bar: SAINTECH product signature and trust indicator */}
      <div className="bg-stone-900 text-stone-300 text-xs px-4 py-1.5 flex justify-between items-center tracking-wide">
        <div className="flex items-center space-x-2">
          <span className="font-semibold text-amber-400">SAINTECH</span>
          <span className="text-stone-400 hidden sm:inline">| Smart Artificial Intelligence Native Technologies</span>
        </div>
        <div className="flex items-center space-x-4 text-[11px]">
          <span className="flex items-center text-stone-300">
            <MapPin className="w-3 h-3 text-amber-400 mr-1" /> Victoria Falls, Zimbabwe
          </span>
          <button
            onClick={isCoordinatorView ? onExitCoordinator : onOpenCoordinator}
            className="text-stone-400 hover:text-white transition flex items-center font-medium cursor-pointer"
          >
            <UserCheck className="w-3 h-3 mr-1 text-emerald-400" />
            {isCoordinatorView ? 'Exit Desk View' : 'Reservations Desk'}
          </button>
        </div>
      </div>

      {/* Main navigation */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between">
        {/* Brand identity */}
        <div
          onClick={() => {
            if (isCoordinatorView) onExitCoordinator();
            setActiveTab('explore');
          }}
          className="flex items-center space-x-3 cursor-pointer group"
        >
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-600 to-amber-800 flex items-center justify-center text-white shadow-md shadow-amber-600/20 group-hover:scale-105 transition-transform">
            <Compass className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-baseline space-x-1.5">
              <span className="text-xl font-bold tracking-tight text-stone-900 font-display">
                Syntuc Explorer
              </span>
              <span className="text-[10px] uppercase font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                Victoria Falls
              </span>
            </div>
            <p className="text-[11px] text-stone-500 font-medium">
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
                  ? 'text-amber-800 bg-amber-50 border border-amber-200/60 shadow-xs'
                  : 'text-stone-600 hover:text-stone-900 hover:bg-stone-50'
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
              className="px-3.5 py-2 rounded-lg text-sm font-semibold text-emerald-800 bg-emerald-50/70 hover:bg-emerald-100/70 border border-emerald-200/60 transition flex items-center shadow-xs"
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
                className="relative flex items-center space-x-2 px-3.5 py-2 rounded-xl bg-stone-100 hover:bg-stone-200/80 text-stone-800 text-sm font-semibold transition shadow-xs cursor-pointer"
              >
                <ShoppingBag className="w-4 h-4 text-amber-700" />
                <span className="hidden sm:inline">My Trip</span>
                {cartCount > 0 && (
                  <span className="w-5 h-5 rounded-full bg-amber-600 text-white text-xs font-bold flex items-center justify-center animate-bounce">
                    {cartCount}
                  </span>
                )}
              </button>

              <button
                onClick={() => {
                  const assistantTrigger = document.getElementById('syntuc-assistant-trigger');
                  if (assistantTrigger) assistantTrigger.click();
                }}
                className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white text-sm font-semibold shadow-md shadow-amber-700/20 hover:shadow-lg transition cursor-pointer"
              >
                <Sparkles className="w-4 h-4 text-amber-200" />
                <span>Talk to Syntuc</span>
              </button>
            </>
          ) : (
            <div className="flex items-center space-x-2">
              <span className="text-xs font-semibold uppercase text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200 flex items-center">
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
