import React, { useState } from 'react';
import {
  Ship,
  Compass,
  Wine,
  Utensils,
  CheckCircle2,
  MapPin,
  Sparkles,
  ChevronRight,
  Info,
  Clock,
  Users,
  QrCode,
  MessageSquare,
  Send,
  ArrowLeft,
  ShieldCheck,
  Award,
  Sun,
  Waves,
  Heart,
  FileCheck,
} from 'lucide-react';
import syntucAvatarImg from '../../assets/images/syntuc_guide_avatar_1792315099007.jpg';

export interface HeritageOnboardViewProps {
  onBackToExplore: () => void;
  onOpenFeedback?: (productId?: string) => void;
  productId?: string;
}

interface ComplimentaryItem {
  id: string;
  name: string;
  category: 'canapes' | 'beverages';
  description: string;
  dietary?: string;
}

const COMPLIMENTARY_CANAPES: ComplimentaryItem[] = [
  {
    id: 'canape-beef',
    name: 'Char-Grilled Zimbabwean Beef Skewers',
    category: 'canapes',
    description: 'Tender marinated local beef glazed with Zambezi herb chimichurri.',
    dietary: 'Gluten-Free',
  },
  {
    id: 'canape-salmon',
    name: 'Smoked Salmon & Herbed Cream Crostini',
    category: 'canapes',
    description: 'Crisp baguette slice with whipped herbed cheese, capers, and fresh lemon zest.',
  },
  {
    id: 'canape-springrolls',
    name: 'Golden Vegetable Spring Rolls',
    category: 'canapes',
    description: 'Julienned seasonal vegetables in crisp pastry with sweet chili dipping sauce.',
    dietary: 'Vegetarian',
  },
  {
    id: 'canape-fishcakes',
    name: 'Zambezi River Catch Fish Cakes',
    category: 'canapes',
    description: 'Handcrafted fresh fish patties with local herbs and a citrus remoulade.',
  },
  {
    id: 'canape-cheese',
    name: 'Artisan African Cheese & Dried Fruit Board',
    category: 'canapes',
    description: 'Selection of regional cheeses, spiced nuts, local dried mango, and crackers.',
    dietary: 'Vegetarian',
  },
  {
    id: 'canape-bruschetta',
    name: 'Sun-Ripened Tomato & Basil Bruschetta',
    category: 'canapes',
    description: 'Diced vine tomatoes, wild sweet basil, garlic, and virgin olive oil reduction.',
    dietary: 'Vegan',
  },
];

const COMPLIMENTARY_BEVERAGES: ComplimentaryItem[] = [
  {
    id: 'bev-beer',
    name: 'Zambezi Lager & Local Craft Beers',
    category: 'beverages',
    description: 'Zimbabwe’s iconic cold lager brewed with pure water and malted barley.',
  },
  {
    id: 'bev-wine-white',
    name: 'Selected Sauvignon Blanc & Chenin Blanc',
    category: 'beverages',
    description: 'Crisp, chilled Southern African white wines pairing elegantly with canapés.',
  },
  {
    id: 'bev-wine-red',
    name: 'Selected Pinotage & Cabernet Sauvignon',
    category: 'beverages',
    description: 'Medium-bodied, aromatic red wines perfect for twilight river cruising.',
  },
  {
    id: 'bev-gt',
    name: 'Signature Zambezi Gin & Tonic',
    category: 'beverages',
    description: 'Artisan gin served over ice with craft Indian tonic, fresh cucumber, and lime.',
  },
  {
    id: 'bev-punch',
    name: 'Tropical Zambezi Sunset Punch',
    category: 'beverages',
    description: 'Non-alcoholic blend of fresh mango, guava, passion fruit, and sparkling water.',
    dietary: 'Non-Alcoholic',
  },
  {
    id: 'bev-water',
    name: 'Chilled Sparkling & Still Mineral Water',
    category: 'beverages',
    description: 'Served continuously with fresh citrus slices throughout the voyage.',
    dietary: 'Non-Alcoholic',
  },
  {
    id: 'bev-soda',
    name: 'Assorted Soft Drinks & Artisan Mixers',
    category: 'beverages',
    description: 'Ginger ale, soda water, tonic, and classic soft drinks served chilled.',
    dietary: 'Non-Alcoholic',
  },
];

const COMPANION_FAQS = [
  {
    q: 'What wildlife can we spot on this stretch of the Zambezi?',
    a: 'The Upper Zambezi is a pristine haven for resident hippo pods, basking Nile crocodiles, and majestic African fish eagles. Keep your eyes on the riverbanks and sand islands—elephants frequently swim across here in the late afternoon to graze on lush river grass!',
  },
  {
    q: 'What makes the Zambezi River above the Falls so unique?',
    a: 'Flowing 2,574 km across six countries, the Zambezi is Africa’s fourth-longest river. Right here above Victoria Falls, the river spreads nearly 2 km wide in tranquil, braided channels before making its dramatic 108-meter drop into the Batoka Gorge.',
  },
  {
    q: 'When is the best golden hour for sunset photos?',
    a: 'The finest golden glow typically peaks between 17:15 and 17:45. Look toward the western sandbars as silhouetted palm trees, water lilies, and river reflections create Zimbabwe’s most famous sunset panorama.',
  },
  {
    q: 'Are the food and drinks really 100% complimentary?',
    a: 'Yes, absolutely! The handcrafted canapés and all selected wines, local beers, gin & tonics, and soft drinks listed in this menu are fully included in your cruise ticket. Enjoy unlimited hospitality from our onboard crew.',
  },
  {
    q: 'How are National Park conservation fees handled?',
    a: 'National Park fees (US$12 for international guests, US$6 for local residents) support the Zimbabwe Parks & Wildlife Management Authority (Zimparks) in preserving the river eco-corridor, anti-poaching patrols, and wildlife protection.',
  },
];

export const HeritageOnboardView: React.FC<HeritageOnboardViewProps> = ({
  onBackToExplore,
  onOpenFeedback,
  productId = 'heritage-standard-sunset-cruise',
}) => {
  // Check-in state
  const [guestName, setGuestName] = useState('');
  const [deckPreference, setDeckPreference] = useState('Upper Observation Deck');
  const [partySize, setPartySize] = useState('2');
  const [dietaryNote, setDietaryNote] = useState('None / Standard');
  const [specialOccasion, setSpecialOccasion] = useState('Sunset Leisure');
  const [isCheckedIn, setIsCheckedIn] = useState(false);
  const [boardingPassCode, setBoardingPassCode] = useState('EXP-ZAM-8842');

  // Menu demonstration wishlist state
  const [wishlist, setWishlist] = useState<string[]>(['canape-beef', 'bev-gt', 'bev-wine-white']);
  const [activeMenuTab, setActiveMenuTab] = useState<'all' | 'canapes' | 'beverages'>('all');

  // Companion chat state
  const [chatMessages, setChatMessages] = useState<Array<{ sender: 'companion' | 'guest'; text: string }>>([
    {
      sender: 'companion',
      text: "Sawubona and welcome aboard the Heritage Expedition Boat Cruise! I'm Syntuc, your digital river companion. Tap any topic below or ask me about wildlife, river history, and photo spots as we cruise.",
    },
  ]);
  const [customQuestion, setCustomQuestion] = useState('');

  // Discover Zambezi active tab
  const [activeDiscoveryTopic, setActiveDiscoveryTopic] = useState<'ecosystem' | 'wildlife' | 'history' | 'conservation'>('ecosystem');

  const handleCompleteCheckin = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = guestName.trim() || 'Honored Guest';
    setGuestName(cleanName);
    const randomCode = `EXP-${Math.floor(1000 + Math.random() * 9000)}`;
    setBoardingPassCode(randomCode);
    setIsCheckedIn(true);
  };

  const toggleWishlistItem = (itemId: string) => {
    setWishlist((prev) =>
      prev.includes(itemId) ? prev.filter((id) => id !== itemId) : [...prev, itemId]
    );
  };

  const handleAskCompanion = (question: string, answer: string) => {
    setChatMessages((prev) => [
      ...prev,
      { sender: 'guest', text: question },
      { sender: 'companion', text: answer },
    ]);
  };

  const handleCustomQuestionSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customQuestion.trim()) return;

    const query = customQuestion.trim();
    setCustomQuestion('');

    // Match keywords or provide a verified informative fallback
    let reply =
      "The captain and crew are navigating the calm upper waters of the Zambezi. Feel free to ask the crew for another refreshment or enjoy the wildlife watching!";
    const qLower = query.toLowerCase();

    if (qLower.includes('animal') || qLower.includes('hippo') || qLower.includes('croc') || qLower.includes('bird')) {
      reply =
        "Look towards the reed beds! The Zambezi's upper channels are home to pods of hippos, basking Nile crocodiles, and over 400 species of birds including African fish eagles and malachite kingfishers.";
    } else if (qLower.includes('beer') || qLower.includes('wine') || qLower.includes('drink') || qLower.includes('food') || qLower.includes('eat')) {
      reply =
        "All our canapés and selected beverages are 100% complimentary during the cruise. Our onboard crew will be serving skewers, fresh crostini, local beers, and fine wines continuously!";
    } else if (qLower.includes('fall') || qLower.includes('gorge') || qLower.includes('how far')) {
      reply =
        "We cruise along the tranquil upper river, safely about 4 to 5 kilometres upstream from the precipice of Victoria Falls, ensuring calm waters and stunning sunset vistas.";
    } else if (qLower.includes('review') || qLower.includes('feedback') || qLower.includes('comment')) {
      reply =
        "We'd love your thoughts! Tap 'Submit Cruise Review' in the header or at the bottom of this page to fill out our quick verified crew review card.";
    }

    setChatMessages((prev) => [
      ...prev,
      { sender: 'guest', text: query },
      { sender: 'companion', text: reply },
    ]);
  };

  const displayedMenuItems =
    activeMenuTab === 'all'
      ? [...COMPLIMENTARY_CANAPES, ...COMPLIMENTARY_BEVERAGES]
      : activeMenuTab === 'canapes'
      ? COMPLIMENTARY_CANAPES
      : COMPLIMENTARY_BEVERAGES;

  return (
    <div className="min-h-screen bg-[#FBFAF7] text-[#29342D] pb-24">
      {/* Top SAINTECH signature & Back Navigation */}
      <div className="bg-[#1C2F24] text-white px-4 py-2 text-xs flex justify-between items-center border-b border-[#2B4536]">
        <div className="flex items-center space-x-2">
          <span className="font-semibold text-[#E2BE8C] tracking-wide">SAINTECH</span>
          <span className="text-white/50 hidden sm:inline">| Smart Artificial Intelligence Native Technologies</span>
        </div>
        <button
          onClick={onBackToExplore}
          className="flex items-center text-[#DCE7D8] hover:text-white transition font-medium cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5 mr-1" />
          <span>Return to Explorer</span>
        </button>
      </div>

      {/* Main Experience Hero Banner */}
      <div className="relative overflow-hidden bg-gradient-to-b from-[#20372B] to-[#15251D] text-white px-4 py-8 sm:py-12">
        <div className="max-w-4xl mx-auto">
          {/* Status pill & cruise identifier */}
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div className="inline-flex items-center space-x-2 bg-white/10 backdrop-blur-md px-3 py-1 rounded-full text-xs font-medium text-[#E2BE8C] border border-[#E2BE8C]/30">
              <Ship className="w-3.5 h-3.5" />
              <span>Heritage Expedition Boat Cruise • Onboard Portal</span>
            </div>
            <div className="flex items-center space-x-2 text-xs text-white/70">
              <MapPin className="w-3.5 h-3.5 text-[#E2BE8C]" />
              <span>Upper Zambezi River, Victoria Falls</span>
            </div>
          </div>

          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-white font-display">
                Welcome Aboard, Explorer
              </h1>
              <p className="mt-2 text-sm sm:text-base text-white/80 max-w-xl">
                Experience the magic of the Zambezi sunset with Pure Africa hospitality. Check in below, browse your complimentary refreshments, and explore the river with Syntuc.
              </p>
            </div>

            {/* Syntuc Digital Companion Badge */}
            <div className="flex items-center space-x-3 bg-white/10 backdrop-blur-md p-3.5 rounded-2xl border border-white/15 shrink-0">
              <div className="relative w-12 h-12 rounded-full overflow-hidden ring-2 ring-[#E2BE8C] shrink-0 bg-stone-900">
                <img
                  src={syntucAvatarImg || '/uploads/syntuc_avatar.jpg'}
                  alt="Syntuc Companion"
                  className="w-full h-full object-cover"
                />
                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-400 rounded-full ring-2 ring-[#20372B]" />
              </div>
              <div>
                <div className="flex items-center space-x-1">
                  <span className="text-xs font-bold text-white">Syntuc Companion</span>
                  <Sparkles className="w-3 h-3 text-[#E2BE8C]" />
                </div>
                <p className="text-[11px] text-white/70">Digital Cruise Guide</p>
                <div className="flex items-center text-[10px] text-emerald-300 font-medium mt-0.5">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1 animate-pulse" />
                  Onboard & Active
                </div>
              </div>
            </div>
          </div>

          {/* Quick jump anchor bar */}
          <div className="mt-8 pt-4 border-t border-white/15 flex items-center gap-2 overflow-x-auto pb-1 text-xs">
            <a
              href="#checkin"
              className="px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-white font-medium transition shrink-0"
            >
              1. Passenger Check-in
            </a>
            <a
              href="#menu"
              className="px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-white font-medium transition shrink-0"
            >
              2. Complimentary Menu
            </a>
            <a
              href="#companion"
              className="px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-white font-medium transition shrink-0"
            >
              3. Ask Syntuc
            </a>
            <a
              href="#discovery"
              className="px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-white font-medium transition shrink-0"
            >
              4. Discover the Zambezi
            </a>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 mt-8 space-y-10">
        {/* ========================================================= */}
        {/* SECTION 1: WELCOME / PASSENGER CHECK-IN                   */}
        {/* ========================================================= */}
        <section id="checkin" className="scroll-mt-6">
          <div className="bg-white rounded-3xl border border-[#E8E5DE] shadow-sm overflow-hidden">
            <div className="p-6 sm:p-8">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-[#34513F]">
                  <FileCheck className="w-4 h-4 text-[#54775A]" />
                  <span>Section 1 • Boarding & Verification</span>
                </div>
                {isCheckedIn && (
                  <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold flex items-center">
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Checked In
                  </span>
                )}
              </div>

              <h2 className="text-xl sm:text-2xl font-bold text-[#20372B]">
                Passenger Digital Check-in
              </h2>
              <p className="text-sm text-stone-600 mt-1">
                Verify your party details to receive your digital boarding pass and let the onboard team prepare your seating and complimentary refreshments.
              </p>

              {!isCheckedIn ? (
                <form onSubmit={handleCompleteCheckin} className="mt-6 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-stone-700 mb-1">
                        Primary Passenger Name *
                      </label>
                      <input
                        type="text"
                        value={guestName}
                        onChange={(e) => setGuestName(e.target.value)}
                        placeholder="e.g. Captain James or Sarah Jenkins"
                        required
                        className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 focus:outline-none focus:ring-2 focus:ring-[#34513F] text-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-stone-700 mb-1">
                        Party Size
                      </label>
                      <div className="relative">
                        <select
                          value={partySize}
                          onChange={(e) => setPartySize(e.target.value)}
                          className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 focus:outline-none focus:ring-2 focus:ring-[#34513F] text-sm bg-white"
                        >
                          <option value="1">1 Passenger (Solo Explorer)</option>
                          <option value="2">2 Passengers (Couple / Pair)</option>
                          <option value="3">3 Passengers</option>
                          <option value="4">4 Passengers (Family / Friends)</option>
                          <option value="5+">5+ Passengers (Group)</option>
                        </select>
                        <Users className="w-4 h-4 text-stone-400 absolute right-3 top-3 pointer-events-none" />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-stone-700 mb-1">
                        Preferred Seating / Deck Area
                      </label>
                      <select
                        value={deckPreference}
                        onChange={(e) => setDeckPreference(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 focus:outline-none focus:ring-2 focus:ring-[#34513F] text-sm bg-white"
                      >
                        <option value="Upper Observation Deck">Upper Observation Deck (360° River Views)</option>
                        <option value="Main Salon Deck">Main Salon Deck (Shaded, Easy Access)</option>
                        <option value="Sunset Bow Seating">Sunset Bow Seating (Front Water Vistas)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-stone-700 mb-1">
                        Dietary Preference Note
                      </label>
                      <select
                        value={dietaryNote}
                        onChange={(e) => setDietaryNote(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 focus:outline-none focus:ring-2 focus:ring-[#34513F] text-sm bg-white"
                      >
                        <option value="None / Standard">None / Standard (Enjoys all Canapés)</option>
                        <option value="Vegetarian">Vegetarian Friendly</option>
                        <option value="Vegan">Vegan</option>
                        <option value="Gluten-Free">Gluten-Free</option>
                        <option value="Halal Friendly">Halal Friendly</option>
                        <option value="Nut Allergy Alert">Nut Allergy Alert</option>
                      </select>
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-stone-700 mb-1">
                        Cruise Occasion (Optional)
                      </label>
                      <input
                        type="text"
                        value={specialOccasion}
                        onChange={(e) => setSpecialOccasion(e.target.value)}
                        placeholder="e.g. Honeymoon, Birthday, Wildlife Photography, First Time in Zimbabwe"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 focus:outline-none focus:ring-2 focus:ring-[#34513F] text-sm"
                      />
                    </div>
                  </div>

                  <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <p className="text-xs text-stone-500 flex items-center">
                      <ShieldCheck className="w-4 h-4 text-emerald-600 mr-1.5 shrink-0" />
                      Digital check-in links to your Pure Africa expedition manifest.
                    </p>
                    <button
                      type="submit"
                      className="w-full sm:w-auto px-6 py-3 rounded-xl bg-[#20372B] hover:bg-[#34513F] text-white font-semibold text-sm transition shadow-md shadow-[#20372B]/20 flex items-center justify-center cursor-pointer"
                    >
                      <CheckCircle2 className="w-4 h-4 mr-2 text-[#E2BE8C]" />
                      <span>Issue Digital Boarding Pass</span>
                    </button>
                  </div>
                </form>
              ) : (
                /* Boarding Pass Card */
                <div className="mt-6 rounded-2xl bg-[#F6F8F5] border-2 border-[#D4E2D1] p-5 sm:p-7 relative overflow-hidden">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-[#D4E2D1]">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full">
                        Official Boarding Pass
                      </span>
                      <h3 className="text-xl font-bold text-[#20372B] mt-1 font-display">
                        Heritage Expedition Boat Cruise
                      </h3>
                      <p className="text-xs text-stone-600">Pure Africa Waterfront Jetty • Victoria Falls</p>
                    </div>

                    <div className="text-right flex items-center gap-2">
                      <div className="p-2 bg-white rounded-xl border border-stone-200 shadow-2xs">
                        <QrCode className="w-10 h-10 text-stone-800" />
                      </div>
                      <div className="text-left">
                        <span className="text-[10px] uppercase font-bold text-stone-500">Pass Code</span>
                        <p className="text-sm font-mono font-bold text-[#20372B]">{boardingPassCode}</p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-4 border-b border-[#D4E2D1] text-xs">
                    <div>
                      <span className="text-stone-500 font-medium">Guest Name</span>
                      <p className="font-bold text-stone-800 mt-0.5">{guestName}</p>
                    </div>
                    <div>
                      <span className="text-stone-500 font-medium">Deck Assignment</span>
                      <p className="font-bold text-stone-800 mt-0.5">{deckPreference}</p>
                    </div>
                    <div>
                      <span className="text-stone-500 font-medium">Party Size</span>
                      <p className="font-bold text-stone-800 mt-0.5">{partySize} Passenger(s)</p>
                    </div>
                    <div>
                      <span className="text-stone-500 font-medium">Dietary Note</span>
                      <p className="font-bold text-stone-800 mt-0.5">{dietaryNote}</p>
                    </div>
                  </div>

                  <div className="pt-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                    <div className="flex items-center text-emerald-800 font-medium">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 mr-2 animate-ping" />
                      <span>Ready for boarding · Manifest verified by Syntuc Explorer</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => setIsCheckedIn(false)}
                      className="text-xs text-stone-500 hover:text-stone-800 underline transition cursor-pointer"
                    >
                      Edit Check-in Info
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ========================================================= */}
        {/* SECTION 2: COMPLIMENTARY FOOD AND DRINKS                  */}
        {/* ========================================================= */}
        <section id="menu" className="scroll-mt-6">
          <div className="bg-white rounded-3xl border border-[#E8E5DE] shadow-sm p-6 sm:p-8">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-amber-800">
                <Utensils className="w-4 h-4 text-amber-700" />
                <span>Section 2 • Onboard Refreshments</span>
              </div>
              <span className="px-3 py-1 rounded-full bg-amber-100 text-amber-900 text-xs font-bold border border-amber-200 flex items-center">
                <Award className="w-3.5 h-3.5 mr-1 text-amber-700" /> 100% Complimentary
              </span>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-[#20372B]">
                  Complimentary Canapés & Beverages
                </h2>
                <p className="text-sm text-stone-600 mt-1 max-w-xl">
                  Included in your cruise fare. Tap any item to add to your personal refreshment wishlist. Our onboard cabin team serves these continuously during your voyage.
                </p>
              </div>
            </div>

            {/* Zero-Charge Guarantee Pill */}
            <div className="mt-4 p-3.5 rounded-2xl bg-[#FAF6EE] border border-[#ECDDC3] flex items-center gap-3 text-xs text-amber-950">
              <Info className="w-4 h-4 text-amber-700 shrink-0" />
              <span>
                <strong>No Extra Charge:</strong> All listed chef’s canapés, craft beers, selected wines, gin & tonic, and refreshments are fully complimentary. There are no add-on bills or mandatory tips on refreshments.
              </span>
            </div>

            {/* Category filter tabs */}
            <div className="mt-6 flex items-center gap-2 border-b border-stone-200 pb-3">
              <button
                type="button"
                onClick={() => setActiveMenuTab('all')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  activeMenuTab === 'all'
                    ? 'bg-[#20372B] text-white shadow-xs'
                    : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                }`}
              >
                All Complimentary ({COMPLIMENTARY_CANAPES.length + COMPLIMENTARY_BEVERAGES.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveMenuTab('canapes')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center cursor-pointer ${
                  activeMenuTab === 'canapes'
                    ? 'bg-[#20372B] text-white shadow-xs'
                    : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                }`}
              >
                <Utensils className="w-3 h-3 mr-1.5 text-amber-500" />
                <span>Chef’s Canapés ({COMPLIMENTARY_CANAPES.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveMenuTab('beverages')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center cursor-pointer ${
                  activeMenuTab === 'beverages'
                    ? 'bg-[#20372B] text-white shadow-xs'
                    : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                }`}
              >
                <Wine className="w-3 h-3 mr-1.5 text-rose-500" />
                <span>Selected Beverages ({COMPLIMENTARY_BEVERAGES.length})</span>
              </button>
            </div>

            {/* Menu items grid */}
            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {displayedMenuItems.map((item) => {
                const isSelected = wishlist.includes(item.id);
                return (
                  <div
                    key={item.id}
                    onClick={() => toggleWishlistItem(item.id)}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? 'border-[#54775A] bg-[#F4F8F4] shadow-xs'
                        : 'border-stone-200 bg-stone-50/60 hover:border-stone-300 hover:bg-white'
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-xs font-bold text-stone-900 group-hover:text-[#20372B]">
                          {item.name}
                        </span>
                        <div
                          className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-xs transition ${
                            isSelected
                              ? 'bg-[#20372B] text-white'
                              : 'bg-stone-200 text-stone-500'
                          }`}
                        >
                          {isSelected ? <CheckCircle2 className="w-4 h-4 text-[#E2BE8C]" /> : '+'}
                        </div>
                      </div>
                      <p className="text-xs text-stone-600 mt-1.5 leading-relaxed">
                        {item.description}
                      </p>
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-stone-200/60 flex items-center justify-between text-[11px]">
                      <span className="font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200/50">
                        Complimentary (US$0)
                      </span>
                      {item.dietary && (
                        <span className="text-stone-500 italic">{item.dietary}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Demonstration Notice */}
            <div className="mt-6 pt-4 border-t border-stone-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-stone-500">
              <div className="flex items-center space-x-2">
                <Heart className="w-4 h-4 text-rose-500 fill-rose-500" />
                <span>
                  <strong>{wishlist.length} items</strong> marked in your onboard refreshment preferences.
                </span>
              </div>
              <span className="text-stone-400 italic">
                Demonstration tray • Refreshments are served by the deck crew throughout the cruise.
              </span>
            </div>
          </div>
        </section>

        {/* ========================================================= */}
        {/* SECTION 3: MEET YOUR SYNTUC EXPLORER COMPANION            */}
        {/* ========================================================= */}
        <section id="companion" className="scroll-mt-6">
          <div className="bg-white rounded-3xl border border-[#E8E5DE] shadow-sm p-6 sm:p-8">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-[#34513F]">
                <Sparkles className="w-4 h-4 text-[#E2BE8C]" />
                <span>Section 3 • Digital River Companion</span>
              </div>
              <span className="text-xs text-stone-400">Preview Mode</span>
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-[#20372B]">
                  Meet Syntuc, Your Cruise Companion
                </h2>
                <p className="text-sm text-stone-600 mt-1 max-w-xl">
                  Ask Syntuc about Upper Zambezi wildlife, photography moments, and river history as we cruise.
                </p>
              </div>

              {/* Direct Link to Crew Review */}
              {onOpenFeedback && (
                <button
                  type="button"
                  onClick={() => onOpenFeedback(productId)}
                  className="px-4 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 font-semibold text-xs flex items-center transition shadow-2xs cursor-pointer"
                  title="Submit cruise feedback"
                >
                  <Ship className="w-3.5 h-3.5 mr-1.5 text-amber-700" />
                  <span>Review This Cruise</span>
                </button>
              )}
            </div>

            {/* Conversation Window */}
            <div className="mt-6 rounded-2xl bg-stone-50 border border-stone-200 overflow-hidden flex flex-col h-[340px]">
              <div className="bg-[#20372B] text-white px-4 py-2.5 flex items-center justify-between text-xs">
                <div className="flex items-center space-x-2">
                  <div className="relative w-6 h-6 rounded-full overflow-hidden ring-1 ring-[#E2BE8C]">
                    <img
                      src={syntucAvatarImg || '/uploads/syntuc_avatar.jpg'}
                      alt="Syntuc"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <span className="font-semibold text-[#E2BE8C]">Syntuc River Companion</span>
                </div>
                <span className="text-[11px] text-white/70">Zambezi Live Companion</span>
              </div>

              <div className="flex-1 p-4 overflow-y-auto space-y-3 text-xs">
                {chatMessages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`flex ${msg.sender === 'guest' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-2.5 leading-relaxed ${
                        msg.sender === 'guest'
                          ? 'bg-[#20372B] text-white rounded-br-xs'
                          : 'bg-white text-stone-800 border border-stone-200 shadow-2xs rounded-bl-xs'
                      }`}
                    >
                      {msg.text}
                    </div>
                  </div>
                ))}
              </div>

              {/* Chat Input */}
              <form onSubmit={handleCustomQuestionSubmit} className="p-3 bg-white border-t border-stone-200 flex items-center gap-2">
                <input
                  type="text"
                  value={customQuestion}
                  onChange={(e) => setCustomQuestion(e.target.value)}
                  placeholder="Ask a question about the river, wildlife, or cruise..."
                  className="flex-1 px-3.5 py-2 rounded-xl border border-stone-300 focus:outline-none focus:ring-2 focus:ring-[#20372B] text-xs"
                />
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-[#20372B] hover:bg-[#34513F] text-white text-xs font-semibold flex items-center cursor-pointer transition"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </form>
            </div>

            {/* Quick Prompt Chips */}
            <div className="mt-4">
              <span className="text-xs font-semibold text-stone-600 block mb-2">
                Suggested questions for Syntuc:
              </span>
              <div className="flex flex-wrap gap-2">
                {COMPANION_FAQS.map((faq, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleAskCompanion(faq.q, faq.a)}
                    className="text-left text-xs bg-stone-100 hover:bg-[#EAF0E8] text-[#263B30] hover:text-[#20372B] border border-stone-200 hover:border-[#C9D6C7] px-3 py-1.5 rounded-full transition cursor-pointer"
                  >
                    {faq.q}
                  </button>
                ))}
              </div>
            </div>

            {/* Transparency disclaimer */}
            <p className="mt-4 text-[11px] text-stone-400">
              * Note: This companion shell demonstrates interactive guided insights during the voyage. For formal post-cruise coordinator ratings, use the verified review link above.
            </p>
          </div>
        </section>

        {/* ========================================================= */}
        {/* SECTION 4: DISCOVER THE ZAMBEZI                           */}
        {/* ========================================================= */}
        <section id="discovery" className="scroll-mt-6">
          <div className="bg-white rounded-3xl border border-[#E8E5DE] shadow-sm p-6 sm:p-8">
            <div className="flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-emerald-800 mb-2">
              <Waves className="w-4 h-4 text-emerald-700" />
              <span>Section 4 • Educational Discovery</span>
            </div>

            <h2 className="text-xl sm:text-2xl font-bold text-[#20372B]">
              Discover the Zambezi River
            </h2>
            <p className="text-sm text-stone-600 mt-1">
              Verified ecological, wildlife, and cultural heritage insights for guests cruising above Victoria Falls.
            </p>

            {/* Topic Selector Tabs */}
            <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => setActiveDiscoveryTopic('ecosystem')}
                className={`p-3 rounded-xl text-left border transition cursor-pointer ${
                  activeDiscoveryTopic === 'ecosystem'
                    ? 'border-[#20372B] bg-[#F4F8F4]'
                    : 'border-stone-200 bg-stone-50 hover:bg-white'
                }`}
              >
                <Waves className="w-4 h-4 text-emerald-700 mb-1" />
                <div className="font-bold text-xs text-stone-900">Ecosystem</div>
                <div className="text-[10px] text-stone-500">Channels & floodplains</div>
              </button>

              <button
                type="button"
                onClick={() => setActiveDiscoveryTopic('wildlife')}
                className={`p-3 rounded-xl text-left border transition cursor-pointer ${
                  activeDiscoveryTopic === 'wildlife'
                    ? 'border-[#20372B] bg-[#F4F8F4]'
                    : 'border-stone-200 bg-stone-50 hover:bg-white'
                }`}
              >
                <Sun className="w-4 h-4 text-amber-700 mb-1" />
                <div className="font-bold text-xs text-stone-900">Wildlife & Birds</div>
                <div className="text-[10px] text-stone-500">Hippos, crocs & eagles</div>
              </button>

              <button
                type="button"
                onClick={() => setActiveDiscoveryTopic('history')}
                className={`p-3 rounded-xl text-left border transition cursor-pointer ${
                  activeDiscoveryTopic === 'history'
                    ? 'border-[#20372B] bg-[#F4F8F4]'
                    : 'border-stone-200 bg-stone-50 hover:bg-white'
                }`}
              >
                <Compass className="w-4 h-4 text-indigo-700 mb-1" />
                <div className="font-bold text-xs text-stone-900">Cultural Lore</div>
                <div className="text-[10px] text-stone-500">Nyami Nyami & Mosi-oa-Tunya</div>
              </button>

              <button
                type="button"
                onClick={() => setActiveDiscoveryTopic('conservation')}
                className={`p-3 rounded-xl text-left border transition cursor-pointer ${
                  activeDiscoveryTopic === 'conservation'
                    ? 'border-[#20372B] bg-[#F4F8F4]'
                    : 'border-stone-200 bg-stone-50 hover:bg-white'
                }`}
              >
                <ShieldCheck className="w-4 h-4 text-rose-700 mb-1" />
                <div className="font-bold text-xs text-stone-900">Conservation</div>
                <div className="text-[10px] text-stone-500">Park fees & eco-boating</div>
              </button>
            </div>

            {/* Topic Content Panel */}
            <div className="mt-6 p-5 sm:p-6 rounded-2xl bg-stone-50 border border-stone-200">
              {activeDiscoveryTopic === 'ecosystem' && (
                <div className="space-y-3 text-xs leading-relaxed text-stone-700">
                  <h3 className="text-sm font-bold text-[#20372B]">
                    The Upper Zambezi: A River of Islands
                  </h3>
                  <p>
                    Upstream from Victoria Falls, the Zambezi River flows over a flat basalt plateau, widening out to nearly 2 kilometers in breadth. This gives birth to hundreds of permanent and seasonal reed islands dotted with water-berry trees and wild date palms.
                  </p>
                  <p>
                    Because the river gradient here is gentle, the current is tranquil compared to the turbulent Batoka Gorge below the falls, making it the ideal habitat for waterbirds and riverine safari cruising.
                  </p>
                </div>
              )}

              {activeDiscoveryTopic === 'wildlife' && (
                <div className="space-y-3 text-xs leading-relaxed text-stone-700">
                  <h3 className="text-sm font-bold text-[#20372B]">
                    River Guardians: Hippos, Crocodiles & Fish Eagles
                  </h3>
                  <p>
                    The Zambezi is home to dense concentrations of Nile hippopotamus pods. During daylight, hippos submerge to stay cool, resurfacing every 3 to 5 minutes to breathe. At twilight, they begin to leave the river channels to graze on dry land.
                  </p>
                  <p>
                    Basking Nile crocodiles can be spotted on warm sandbanks, while the haunting cry of the African Fish Eagle (known as the &apos;Voice of Africa&apos;) frequently rings across the water from high deadwood perches.
                  </p>
                </div>
              )}

              {activeDiscoveryTopic === 'history' && (
                <div className="space-y-3 text-xs leading-relaxed text-stone-700">
                  <h3 className="text-sm font-bold text-[#20372B]">
                    The Great River & Nyami Nyami
                  </h3>
                  <p>
                    To the indigenous Tonga people who have inhabited the valley for centuries, the Zambezi is watched over by Nyami Nyami, the Zambezi River God—a revered serpent-bodied spirit who protects the river and its people.
                  </p>
                  <p>
                    The Tonga name for the falls, <em>Mosi-oa-Tunya</em> (&apos;The Smoke That Thunders&apos;), captures the immense columns of spray that rise more than 400 meters above the canyon, visible from river viewpoints for kilometers around.
                  </p>
                </div>
              )}

              {activeDiscoveryTopic === 'conservation' && (
                <div className="space-y-3 text-xs leading-relaxed text-stone-700">
                  <h3 className="text-sm font-bold text-[#20372B]">
                    Pure Africa Eco-Responsibility & Park Protection
                  </h3>
                  <p>
                    The Heritage Expedition Boat operates under strict environmental guidelines: low-wash navigation reduces shoreline erosion and preserves sensitive bird-nesting reeds along the riverbanks.
                  </p>
                  <p>
                    Every guest contribution through mandatory National Park fees goes directly to the Zimbabwe Parks and Wildlife Management Authority to fund anti-poaching operations, community ranger patrols, and wildlife preservation.
                  </p>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Bottom Review & Explorer links */}
        <div className="p-6 rounded-3xl bg-[#20372B] text-white flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-bold font-display">Enjoyed Your Cruise Experience?</h3>
            <p className="text-xs text-white/75 mt-0.5">
              Submit your verified guest feedback on captain commentary, canapés, and boat comfort.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {onOpenFeedback && (
              <button
                type="button"
                onClick={() => onOpenFeedback(productId)}
                className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-stone-900 font-bold text-xs transition cursor-pointer shadow-sm"
              >
                Submit Cruise Review
              </button>
            )}
            <button
              type="button"
              onClick={onBackToExplore}
              className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold text-xs transition cursor-pointer"
            >
              Back to Catalogue
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
