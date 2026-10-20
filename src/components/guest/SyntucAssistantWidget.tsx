import React, { useState, useRef, useEffect } from 'react';
import { useSession } from '../../context/SessionContext.tsx';
import { api } from '../../services/api.ts';
import {
  Sparkles,
  X,
  Send,
  Mic,
  MicOff,
  Compass,
  ArrowRight,
  ShieldCheck,
  UserCheck,
  Bot,
  RotateCcw,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { AssistantResponse, AssistantAction } from '../../types/index.ts';
import { trackEvent } from '../../services/analytics.ts';
import syntucAvatarImg from '../../assets/images/syntuc_guide_avatar_1792315099007.jpg';

export const SYNTUC_AVATAR_URL = syntucAvatarImg || '/uploads/syntuc_avatar.jpg';

export const INITIAL_MESSAGES = [
  {
    role: 'assistant' as const,
    text:
      "Hello! I'm Syntuc, your intelligent guide to Victoria Falls. Tell me what you're looking for, and I'll help you explore and compare experiences.",
    action: null,
  },
];

export const SyntucAssistantWidget: React.FC = () => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [inputMessage, setInputMessage] = useState<string>('');
  const [messages, setMessages] = useState<
    { role: 'user' | 'assistant'; text: string; action?: AssistantAction | null; requiresCoordinator?: boolean }[]
  >(INITIAL_MESSAGES);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isListening, setIsListening] = useState<boolean>(false);

  const handleResetChat = () => {
    trackEvent({ eventType: 'CHAT_RESET', metadata: { previousMessageCount: messages.length } });
    setMessages(INITIAL_MESSAGES);
    setInputMessage('');
    setIsProcessing(false);
    setIsListening(false);
  };

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { setActiveTab, openProductDetail, addToTrip, openReservationModal, openSchoolPlanner, openMyTrip, tripPlan } =
    useSession();

  // Scroll to bottom when messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Speech Recognition support
  const handleVoiceInput = () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert('Speech recognition is not supported in this browser. Please type your message.');
      return;
    }

    if (isListening) {
      setIsListening(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'en-US';
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInputMessage(transcript);
        setIsListening(false);
      };

      recognition.onerror = () => {
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.start();
    } catch (e) {
      setIsListening(false);
    }
  };

  const handleSendMessage = async (textToSend?: string) => {
    const message = textToSend || inputMessage;
    if (!message.trim() || isProcessing) return;

    const userTurn = { role: 'user' as const, text: message.trim() };
    setMessages(prev => [...prev, userTurn]);
    setInputMessage('');
    setIsProcessing(true);

    trackEvent({
      eventType: 'SYNTUC_MESSAGE_SENT',
      metadata: { length: message.trim().length },
    });

    try {
      // Build rich conversation history for multi-turn context
      const history = messages.slice(-15).map(m => ({ role: m.role, text: m.text }));
      const tripContext = tripPlan
        ? {
            tripPlanId: tripPlan.id,
            title: tripPlan.title,
            startDate: tripPlan.startDate,
            endDate: tripPlan.endDate,
            adultsCount: tripPlan.adultsCount,
            childrenCount: tripPlan.childrenCount,
            interests: tripPlan.interests || [],
            intensity: tripPlan.intensity || null,
            itemsCount: tripPlan.items?.length || 0,
            items: (tripPlan.items || []).map(item => ({
              id: item.id,
              productId: item.productId,
              productName: item.product?.name || item.productId,
              productType: item.product?.productType || null,
              roomId: item.roomId || null,
              roomName: item.room?.name || null,
              variantId: item.variantId || null,
              variantName: item.variant?.name || null,
              scheduledDate: item.scheduledDate || null,
              checkOutDate: item.checkOutDate || null,
              scheduledTime: item.scheduledTime || null,
              guestCount: item.guestCount,
              notes: item.notes || null,
              priceBasis: item.variant?.priceBasis || item.product?.priceBasis || null,
              unitPrice: item.variant?.price ?? item.product?.basePrice ?? null,
              currency: item.variant?.currency || item.product?.currency || 'USD',
              compulsoryFees: item.variant?.compulsoryFees || (item.product as any)?.compulsoryFees || [],
            })),
          }
        : null;

      const response: AssistantResponse = await api.sendAssistantChat(
        message.trim(),
        history,
        tripContext
      );

      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          text: response.replyText,
          action: response.action,
          requiresCoordinator: response.requiresCoordinator,
        },
      ]);
    } catch (err) {
      console.error('Assistant error:', err);
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          text:
            'I am currently unable to retrieve a verified answer from the destination catalogue. Please check your connection and try asking again, or browse our verified accommodations and activities directly.',
          action: null,
        },
      ]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleActionClick = (action: AssistantAction) => {
    if (!action) return;

    const actType = (action.type || '').toUpperCase();
    const dest = (action.destination || '').toLowerCase();

    if (actType === 'ADD_TO_TRIP' && action.productId) {
      addToTrip({ productId: action.productId });
      setIsOpen(false);
      openMyTrip();
    } else if ((actType === 'OPEN_PRODUCT' || actType === 'VIEW_PRODUCT') && action.productId) {
      openProductDetail(action.productId);
      setIsOpen(false);
    } else if (actType === 'OPEN_PACKAGE_INQUIRY' || actType === 'OPEN_PACKAGE' || actType === 'VIEW_PACKAGE') {
      setActiveTab('packages');
      setIsOpen(false);
      if (action.productId) {
        setTimeout(() => {
          const el = document.getElementById(action.productId!);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            el.classList.add('ring-4', 'ring-amber-500/40');
            setTimeout(() => el.classList.remove('ring-4', 'ring-amber-500/40'), 2500);
          }
        }, 150);
      }
    } else if (actType === 'OPEN_BOOKING' || actType === 'REQUEST_RESERVATION') {
      openReservationModal();
      setIsOpen(false);
    } else if (
      actType === 'OPEN_TRIP' ||
      actType === 'VIEW_TRIP' ||
      dest === 'planner' ||
      dest === 'itinerary' ||
      dest === 'my-trip' ||
      dest === 'trip'
    ) {
      openMyTrip();
      setIsOpen(false);
    } else if (dest === 'school-trips') {
      openSchoolPlanner();
      setIsOpen(false);
    } else if (dest === 'packages') {
      setActiveTab('packages');
      if (action.productId) {
        setTimeout(() => {
          const el = document.getElementById(action.productId!);
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 150);
      }
      setIsOpen(false);
    } else {
      setActiveTab('explore');
      setTimeout(() => {
        document.getElementById('catalog-section')?.scrollIntoView({ behavior: 'smooth' });
      }, 150);
      setIsOpen(false);
    }
  };

  // Render assistant message with interactive inline terms
  const renderMessageContent = (text: string) => {
    // List of recognized catalog terms mapped to actions
    const termMap: { pattern: RegExp; action: AssistantAction }[] = [
      {
        pattern: /Victoria Falls Essential Journey/gi,
        action: { type: 'OPEN_PACKAGE_INQUIRY', productId: 'pkg_essential_vf', productName: 'Victoria Falls Essential Journey', label: 'View Essential Journey Package' },
      },
      {
        pattern: /Zambezi Luxury Safari & River Retreat/gi,
        action: { type: 'OPEN_PACKAGE_INQUIRY', productId: 'pkg_luxury_zambezi', productName: 'Zambezi Luxury Safari & River Retreat', label: 'View Luxury Safari Retreat' },
      },
      {
        pattern: /Batoka Adventure & Wilderness Duo/gi,
        action: { type: 'OPEN_PACKAGE_INQUIRY', productId: 'pkg_batoka_adventure', productName: 'Batoka Adventure & Wilderness Duo', label: 'View Batoka Adventure' },
      },
      {
        pattern: /Flight of Angels(?: — Scenic Helicopter Tour)?/gi,
        action: { type: 'OPEN_PRODUCT', productId: 'prod_flight_of_angels', productName: 'Flight of Angels Scenic Helicopter Tour', label: 'View Flight of Angels' },
      },
      {
        pattern: /Zambezi Gorge & Falls Extended Flight/gi,
        action: { type: 'OPEN_PRODUCT', productId: 'prod_zambezi_extended_flight', productName: 'Zambezi Gorge & Falls Extended Flight', label: 'View Extended Gorge Flight' },
      },
      {
        pattern: /Zambezi Explorer Luxury Sunset Cruise/gi,
        action: { type: 'OPEN_PRODUCT', productId: 'prod_zambezi_explorer_cruise', productName: 'Zambezi Explorer Luxury Sunset Cruise', label: 'View Sunset Cruise' },
      },
      {
        pattern: /A'Zambezi River Lodge/gi,
        action: { type: 'OPEN_PRODUCT', productId: 'prod_azambezi', productName: "A'Zambezi River Lodge", label: "View A'Zambezi River Lodge" },
      },
      {
        pattern: /Victoria Falls Rainbow Hotel/gi,
        action: { type: 'OPEN_PRODUCT', productId: 'prod_rainbow', productName: 'Victoria Falls Rainbow Hotel', label: 'View Rainbow Hotel' },
      },
      {
        pattern: /Shearwater Explorers Village/gi,
        action: { type: 'OPEN_PRODUCT', productId: 'prod_explorers', productName: 'Shearwater Explorers Village', label: 'View Explorers Village' },
      },
      {
        pattern: /Old Drift Lodge/gi,
        action: { type: 'OPEN_PRODUCT', productId: 'prod_olddrift', productName: 'Old Drift Lodge', label: 'View Old Drift Lodge' },
      },
      {
        pattern: /The Elephant Camp/gi,
        action: { type: 'OPEN_PRODUCT', productId: 'prod_elephantcamp', productName: 'The Elephant Camp', label: 'View The Elephant Camp' },
      },
      {
        pattern: /Chobe National Park (?:Full-Day )?Safari/gi,
        action: { type: 'OPEN_PRODUCT', productId: 'prod_chobe_safari', productName: 'Chobe National Park Full-Day Safari', label: 'View Chobe Safari' },
      },
      {
        pattern: /(?:1905 Historic Bridge Tour|Victoria Falls Historic Bridge Adventures)/gi,
        action: { type: 'OPEN_PRODUCT', productId: 'prod_bridge_adventures', productName: 'Victoria Falls Historic Bridge Adventures', label: 'View Bridge Adventures' },
      },
      {
        pattern: /Rainforest (?:Guided )?Walking Tour/gi,
        action: { type: 'OPEN_PRODUCT', productId: 'prod_rainforest_walk', productName: 'Victoria Falls Rainforest Walking Tour', label: 'View Rainforest Tour' },
      },
      {
        pattern: /The Boma(?: — Dinner & Drum Show)?/gi,
        action: { type: 'OPEN_PRODUCT', productId: 'prod_boma_dinner', productName: 'The Boma — Dinner & Drum Show', label: 'View The Boma' },
      },
      {
        pattern: /School Trip (?:Commercial )?Planner/gi,
        action: { type: 'NAVIGATE', destination: 'school-trips', label: 'Open School Trip Planner' },
      },
      {
        pattern: /(?:Trip Planner|Itinerary Planner|My Trip)/gi,
        action: { type: 'NAVIGATE', destination: 'planner', label: 'Open Itinerary Planner' },
      },
    ];

    // Clean markdown bold syntax around terms: **term** -> term
    const cleanText = text.replace(/\*\*([^*]+)\*\*/g, '$1');

    // Build combined regex with capturing group
    const combinedRegex = new RegExp(
      termMap.map(t => t.pattern.source).join('|'),
      'gi'
    );

    const elements: React.ReactNode[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = combinedRegex.exec(cleanText)) !== null) {
      const matchStart = match.index;
      const matchEnd = combinedRegex.lastIndex;
      const matchedString = match[0];

      // Add text before match
      if (matchStart > lastIndex) {
        elements.push(cleanText.substring(lastIndex, matchStart));
      }

      // Find matching action
      const matchedEntry = termMap.find(t =>
        new RegExp(`^${t.pattern.source}$`, 'i').test(matchedString)
      );

      if (matchedEntry) {
        const action = matchedEntry.action;
        elements.push(
          <button
            key={`term-${matchStart}`}
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleActionClick(action);
            }}
            className="inline-flex items-center text-amber-900 font-semibold underline decoration-amber-500 hover:decoration-amber-800 bg-amber-100/70 hover:bg-amber-200 px-1.5 py-0.5 rounded text-[11px] transition cursor-pointer mx-0.5 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
            title={`Click to open ${matchedString}`}
          >
            <span>{matchedString}</span>
            <ArrowRight className="w-2.5 h-2.5 ml-0.5 inline opacity-70" />
          </button>
        );
      } else {
        elements.push(matchedString);
      }

      lastIndex = matchEnd;
    }

    // Add trailing text
    if (lastIndex < cleanText.length) {
      elements.push(cleanText.substring(lastIndex));
    }

    return elements.length > 0 ? elements : cleanText;
  };

  return (
    <>
      {/* Floating launcher button with avatar identity */}
      <button
        id="syntuc-assistant-trigger"
        onClick={() => {
          if (!isOpen) {
            trackEvent({ eventType: 'SYNTUC_CHAT_OPENED' });
          }
          setIsOpen(!isOpen);
        }}
        aria-label="Talk to Syntuc — Your Syntuc Travel Guide"
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2.5 p-1.5 pr-4 rounded-full bg-[#20372B] hover:bg-[#2A4637] text-white shadow-[0_12px_36px_rgba(32,55,43,0.35)] border border-[#E2BE8C]/50 hover:scale-[1.03] active:scale-95 transition-all duration-200 cursor-pointer group"
        title="Talk to Syntuc — Your Syntuc Travel Guide"
      >
        <div className="relative w-11 h-11 rounded-full overflow-hidden ring-2 ring-[#E2BE8C] shrink-0 bg-stone-900">
          <img
            src={SYNTUC_AVATAR_URL}
            alt="Syntuc Travel Guide"
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
          />
          <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-[#20372B] rounded-full" />
        </div>
        <div className="text-left hidden sm:block">
          <div className="text-xs font-bold text-white flex items-center gap-1.5">
            <span>Talk to Syntuc</span>
            <Sparkles className="w-3 h-3 text-[#E2BE8C]" />
          </div>
          <span className="text-[10px] text-[#D6E2D1] block leading-tight">Your Travel Guide</span>
        </div>
      </button>

      {/* Slide-out conversational panel */}
      {isOpen && (
        <div
          role="dialog"
          aria-modal="false"
          aria-labelledby="assistant-panel-title"
          className={`fixed inset-x-2 bottom-3 top-14 sm:inset-auto sm:bottom-22 sm:right-6 ${
            isExpanded ? 'sm:w-[720px] sm:h-[720px]' : 'sm:w-[480px] sm:h-[640px]'
          } z-50 bg-[#FBFAF7] rounded-3xl shadow-[0_24px_64px_rgba(20,35,27,0.25)] border border-[#D8E3D5] flex flex-col overflow-hidden transition-all duration-300 animate-fadeIn`}
        >
          {/* Header with Avatar Portrait */}
          <div className="bg-[#1D3227] text-white p-3.5 sm:p-4 flex items-center justify-between border-b border-[#2C4839] shrink-0">
            <div className="flex items-center space-x-3">
              <div className="relative w-11 h-11 rounded-2xl overflow-hidden ring-2 ring-[#E2BE8C]/70 shadow-sm shrink-0 bg-stone-900">
                <img
                  src={SYNTUC_AVATAR_URL}
                  alt="Syntuc"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-400 border border-[#1D3227] rounded-full" />
              </div>
              <div>
                <span className="text-[10px] uppercase tracking-wider font-semibold text-[#E2BE8C] block leading-none mb-0.5">
                  Your Syntuc Travel Guide
                </span>
                <h4 id="assistant-panel-title" className="font-bold text-sm sm:text-base font-serif text-white leading-tight">
                  Syntuc Explorer
                </h4>
                <p className="text-[10px] text-[#A6BFAB] flex items-center gap-1.5 mt-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Online · Victoria Falls Guide</span>
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-1.5">
              <button
                type="button"
                onClick={() => setIsExpanded(!isExpanded)}
                aria-label={isExpanded ? 'Collapse panel' : 'Expand panel'}
                title={isExpanded ? 'Collapse view' : 'Expand for wider view'}
                className="hidden sm:inline-flex p-1.5 rounded-xl text-[#A6BFAB] hover:text-white hover:bg-[#2C4839] transition cursor-pointer"
              >
                {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>
              <button
                type="button"
                onClick={handleResetChat}
                aria-label="Reset Chat"
                title="Reset conversation context & start new chat"
                className="inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-xl text-[11px] font-semibold text-[#D6E2D1] hover:text-white bg-[#2A4637] hover:bg-[#345845] border border-[#3D644F] transition cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5 text-[#E2BE8C]" />
                <span className="hidden sm:inline">Reset</span>
              </button>
              <button
                onClick={() => setIsOpen(false)}
                aria-label="Close digital guide"
                className="p-1.5 rounded-xl text-[#A6BFAB] hover:text-white hover:bg-[#2C4839] transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Messages list */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#FAF8F5]">
            {/* Welcome Portrait Banner */}
            <div className="bg-white rounded-2xl border border-[#D8E3D5] p-4 sm:p-5 shadow-[0_2px_12px_rgba(38,59,48,0.03)]">
              <div className="flex items-start gap-3.5">
                <div className="relative shrink-0">
                  <img
                    src={SYNTUC_AVATAR_URL}
                    alt="Syntuc - Your Travel Guide"
                    referrerPolicy="no-referrer"
                    className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl object-cover ring-2 ring-[#E2BE8C]/70 shadow-sm bg-stone-900"
                  />
                  <span className="absolute -bottom-1 -right-1 px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-[#20372B] text-[#E2BE8C] border border-[#E2BE8C]/50 shadow-2xs">
                    Guide
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-[10px] uppercase tracking-wider font-bold text-[#8B6A3E] block mb-0.5">
                    Your Syntuc Travel Guide
                  </span>
                  <h3 className="text-base sm:text-lg font-serif font-bold text-[#20372B] leading-snug">
                    Meet Syntuc
                  </h3>
                  <p className="text-xs text-[#4A5D50] leading-relaxed mt-1">
                    Hello! I'm Syntuc, your intelligent guide to Victoria Falls. Tell me what you're looking for, and I'll help you explore and compare experiences.
                  </p>
                </div>
              </div>
              <div className="mt-3 pt-2.5 border-t border-[#EDF2EB] flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] font-medium text-[#5D7063]">
                <span className="flex items-center gap-1 text-[#20372B] font-semibold">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#365D43]" /> Verified Local Rates
                </span>
                <span aria-hidden="true" className="text-stone-300">·</span>
                <span>River Lodges</span>
                <span aria-hidden="true" className="text-stone-300">·</span>
                <span>Helicopter Flights</span>
                <span aria-hidden="true" className="text-stone-300">·</span>
                <span>Sunset Cruises</span>
              </div>
            </div>

            {/* Conversation Messages */}
            {messages.map((msg, index) => {
              // Skip first message if identical to welcome banner to avoid duplication
              if (index === 0 && messages.length > 1) {
                // If conversation has progressed, we can still show or skip
              }

              return (
                <div key={index} className="space-y-1">
                  {msg.role === 'assistant' ? (
                    <div className="flex items-start gap-2.5 max-w-[92%] sm:max-w-[85%]">
                      {/* Avatar Thumbnail beside Assistant Response */}
                      <div className="relative shrink-0 mt-0.5">
                        <img
                          src={SYNTUC_AVATAR_URL}
                          alt="Syntuc"
                          referrerPolicy="no-referrer"
                          className="w-8 h-8 rounded-xl object-cover border border-[#D8E3D5] shadow-2xs bg-stone-900"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="text-[11px] font-bold text-[#20372B]">Syntuc</span>
                          <span className="text-[9px] font-semibold text-[#8B6A3E] uppercase tracking-wider">
                            Travel Guide
                          </span>
                        </div>
                        <div className="p-3.5 rounded-2xl rounded-tl-xs bg-white text-[#20372B] border border-[#D8E3D5] shadow-xs text-xs leading-relaxed">
                          <div className="whitespace-pre-wrap">
                            {renderMessageContent(msg.text)}
                          </div>
                        </div>

                        {/* Structured Action Chip */}
                        {msg.action && (
                          <button
                            onClick={() => handleActionClick(msg.action!)}
                            className="mt-2 px-3 py-1.5 bg-[#F4F7F3] hover:bg-[#EAF0E8] text-[#20372B] border border-[#D8E3D5] rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition cursor-pointer shadow-xs"
                          >
                            <span>{msg.action.label || 'View in Explorer'}</span>
                            <ArrowRight className="w-3.5 h-3.5 ml-1 text-[#8B6A3E]" />
                          </button>
                        )}

                        {/* Coordinator Needed Flag */}
                        {msg.requiresCoordinator && (
                          <div className="mt-1.5 flex items-center text-[10px] text-[#8B6A3E] bg-[#FAF8F5] px-2.5 py-1 rounded-lg border border-[#E8E4DA]">
                            <UserCheck className="w-3 h-3 mr-1 text-[#8B6A3E]" />
                            <span>Special requirements flagged for Victoria Falls desk coordinator review.</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    /* Visitor Message: Clearly distinguished on right with dark theme */
                    <div className="flex items-start justify-end gap-2 max-w-[88%] ml-auto">
                      <div className="p-3.5 rounded-2xl rounded-tr-xs bg-[#20372B] text-white text-xs leading-relaxed shadow-xs">
                        <div className="whitespace-pre-wrap">{msg.text}</div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {isProcessing && (
              <div className="flex items-start gap-2.5 text-xs text-[#5D7063]">
                <img
                  src={SYNTUC_AVATAR_URL}
                  alt="Syntuc"
                  referrerPolicy="no-referrer"
                  className="w-8 h-8 rounded-xl object-cover border border-[#D8E3D5] shadow-2xs shrink-0 bg-stone-900"
                />
                <div className="flex items-center gap-2 bg-white border border-[#D8E3D5] rounded-2xl rounded-tl-xs px-3.5 py-2.5 shadow-2xs">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#365D43] animate-bounce" />
                  <div className="w-1.5 h-1.5 rounded-full bg-[#365D43] animate-bounce [animation-delay:150ms]" />
                  <div className="w-1.5 h-1.5 rounded-full bg-[#365D43] animate-bounce [animation-delay:300ms]" />
                  <span className="text-[11px] text-[#365D43] font-medium ml-1">Syntuc is thinking...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick prompt chips */}
          <div className="px-3 py-2 bg-[#F4F7F3] border-t border-[#D8E3D5] flex items-center space-x-1.5 overflow-x-auto text-[11px] shrink-0">
            <button
              onClick={() => handleSendMessage('What is the difference between the 12m and 25m helicopter flights?')}
              className="px-2.5 py-1 rounded-full bg-white border border-[#D8E3D5] text-[#20372B] whitespace-nowrap hover:border-[#8B6A3E] hover:text-[#8B6A3E] transition shadow-2xs cursor-pointer"
            >
              Compare Helicopters
            </button>
            <button
              onClick={() => handleSendMessage('How does the Bridge Tour incentive work?')}
              className="px-2.5 py-1 rounded-full bg-white border border-[#D8E3D5] text-[#20372B] whitespace-nowrap hover:border-[#8B6A3E] hover:text-[#8B6A3E] transition shadow-2xs cursor-pointer"
            >
              Bridge Tour $0 Incentive
            </button>
            <button
              onClick={() => handleSendMessage('Tell me about the Heritage Standard Sunset Cruise on the Zambezi.')}
              className="px-2.5 py-1 rounded-full bg-white border border-[#D8E3D5] text-[#20372B] whitespace-nowrap hover:border-[#8B6A3E] hover:text-[#8B6A3E] transition shadow-2xs cursor-pointer"
            >
              Heritage Sunset Cruise
            </button>
            <button
              onClick={() => handleSendMessage('What are the school trip accommodation options and tariffs?')}
              className="px-2.5 py-1 rounded-full bg-white border border-[#D8E3D5] text-[#20372B] whitespace-nowrap hover:border-[#8B6A3E] hover:text-[#8B6A3E] transition shadow-2xs cursor-pointer"
            >
              School Trip Tariffs
            </button>
          </div>

          {/* Input field */}
          <form
            onSubmit={e => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="p-3 bg-white border-t border-[#D8E3D5] flex items-center space-x-2 shrink-0"
          >
            <button
              type="button"
              onClick={handleVoiceInput}
              className={`p-2 rounded-xl border transition cursor-pointer ${
                isListening
                  ? 'bg-rose-500 text-white border-rose-600 animate-pulse'
                  : 'bg-[#F4F7F3] text-[#4A5D50] border-[#D8E3D5] hover:bg-[#EAF0E8]'
              }`}
              title={isListening ? 'Listening... click to stop' : 'Click for voice input'}
            >
              {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>

            <input
              type="text"
              value={inputMessage}
              onChange={e => setInputMessage(e.target.value)}
              placeholder={isListening ? 'Listening to your voice...' : 'Ask Syntuc about Victoria Falls lodges, flights, cruises...'}
              className="flex-1 px-3 py-2 text-xs rounded-xl bg-[#FAF8F5] border border-[#D8E3D5] focus:outline-hidden focus:ring-2 focus:ring-[#365D43]/20 focus:border-[#365D43]"
            />

            <button
              type="submit"
              disabled={isProcessing || !inputMessage.trim()}
              className="p-2 rounded-xl bg-[#20372B] hover:bg-[#2A4637] disabled:bg-stone-200 text-white transition cursor-pointer shadow-xs"
            >
              <Send className="w-4 h-4 text-[#E2BE8C]" />
            </button>
          </form>
        </div>
      )}
    </>
  );
};
