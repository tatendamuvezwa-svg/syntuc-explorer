import React, { useState, useRef, useEffect } from 'react';
import { useSession } from '../../context/SessionContext.tsx';
import { api } from '../../services/api.ts';
import {
  Sparkles,
  Send,
  Mic,
  MicOff,
  ArrowRight,
  ShieldCheck,
  UserCheck,
  RotateCcw,
  ArrowLeft,
  Ship,
  Plane,
  Building,
  GraduationCap,
} from 'lucide-react';
import { AssistantResponse, AssistantAction } from '../../types/index.ts';
import { trackEvent } from '../../services/analytics.ts';
import syntucAvatarImg from '../../assets/images/syntuc_guide_avatar_1792315099007.jpg';

export const SYNTUC_AVATAR_URL = syntucAvatarImg || '/uploads/syntuc_avatar.jpg';

interface TalkViewProps {
  onBackToExplore?: () => void;
}

const INITIAL_MESSAGES = [
  {
    role: 'assistant' as const,
    text:
      "Hello! I'm Syntuc, your intelligent guide to Victoria Falls. Tell me what you're looking for, and I'll help you explore and compare experiences.",
    action: null,
  },
];

export const TalkView: React.FC<TalkViewProps> = ({ onBackToExplore }) => {
  const [inputMessage, setInputMessage] = useState<string>('');
  const [messages, setMessages] = useState<
    { role: 'user' | 'assistant'; text: string; action?: AssistantAction | null; requiresCoordinator?: boolean }[]
  >(INITIAL_MESSAGES);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isListening, setIsListening] = useState<boolean>(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { setActiveTab, openProductDetail, addToTrip, openReservationModal, openSchoolPlanner, openMyTrip, tripPlan } =
    useSession();

  useEffect(() => {
    trackEvent({ eventType: 'TALK_TO_SYNTUC_PAGE_VIEWED' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleResetChat = () => {
    trackEvent({ eventType: 'CHAT_RESET', metadata: { previousMessageCount: messages.length } });
    setMessages(INITIAL_MESSAGES);
    setInputMessage('');
    setIsProcessing(false);
    setIsListening(false);
  };

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

      recognition.onstart = () => setIsListening(true);
      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInputMessage(transcript);
        setIsListening(false);
      };
      recognition.onerror = () => setIsListening(false);
      recognition.onend = () => setIsListening(false);
      recognition.start();
    } catch {
      setIsListening(false);
    }
  };

  const handleSendMessage = async (textToSend?: string) => {
    const message = textToSend || inputMessage;
    if (!message.trim() || isProcessing) return;

    const userTurn = { role: 'user' as const, text: message.trim() };
    setMessages((prev) => [...prev, userTurn]);
    setInputMessage('');
    setIsProcessing(true);

    trackEvent({
      eventType: 'SYNTUC_MESSAGE_SENT',
      metadata: { length: message.trim().length, source: 'talk_page' },
    });

    try {
      const history = messages.slice(-15).map((m) => ({ role: m.role, text: m.text }));
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
            items: (tripPlan.items || []).map((item) => ({
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

      setMessages((prev) => [
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
      setMessages((prev) => [
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
      openMyTrip();
    } else if ((actType === 'OPEN_PRODUCT' || actType === 'VIEW_PRODUCT') && action.productId) {
      openProductDetail(action.productId);
    } else if (actType === 'OPEN_PACKAGE_INQUIRY' || actType === 'OPEN_PACKAGE' || actType === 'VIEW_PACKAGE') {
      setActiveTab('packages');
      onBackToExplore?.();
    } else if (actType === 'OPEN_BOOKING' || actType === 'REQUEST_RESERVATION') {
      openReservationModal();
    } else if (dest === 'school-trips') {
      openSchoolPlanner();
    } else if (dest === 'packages') {
      setActiveTab('packages');
      onBackToExplore?.();
    } else {
      onBackToExplore?.();
    }
  };

  const renderMessageContent = (text: string) => {
    const cleanText = text.replace(/\*\*([^*]+)\*\*/g, '$1');
    return cleanText;
  };

  return (
    <div className="min-h-screen bg-[#FBFAF7] py-6 sm:py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        {/* Back navigation */}
        {onBackToExplore && (
          <button
            type="button"
            onClick={onBackToExplore}
            className="inline-flex items-center gap-2 text-xs sm:text-sm text-[#4A5D50] hover:text-[#20372B] mb-6 font-medium transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Explorer</span>
          </button>
        )}

        {/* Dual-column Layout on Desktop */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Avatar Identity Card */}
          <div className="lg:col-span-4 space-y-6 lg:sticky lg:top-24">
            <div className="bg-white rounded-3xl border border-[#D8E3D5] p-6 shadow-[0_12px_32px_rgba(38,59,48,0.05)] text-center relative overflow-hidden">
              <div className="relative w-36 h-36 sm:w-44 sm:h-44 mx-auto mb-4 rounded-3xl overflow-hidden ring-4 ring-[#E2BE8C]/50 shadow-lg bg-stone-900">
                <img
                  src={SYNTUC_AVATAR_URL}
                  alt="Syntuc — Your Syntuc Travel Guide"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
                <span className="absolute bottom-2 right-2 w-4 h-4 bg-emerald-500 border-2 border-white rounded-full shadow-xs" />
              </div>

              <span className="inline-block text-[11px] uppercase tracking-wider font-bold text-[#8B6A3E] mb-1">
                Your Syntuc Travel Guide
              </span>
              <h1 className="text-2xl sm:text-3xl font-serif font-bold text-[#20372B]">
                Syntuc Explorer
              </h1>
              <p className="text-xs sm:text-sm text-[#4A5D50] leading-relaxed mt-2">
                Intelligent digital travel companion for Victoria Falls, the Zambezi River, and regional safaris.
              </p>

              <div className="mt-5 pt-4 border-t border-[#EDF2EB] text-left space-y-2.5 text-xs text-[#4A5D50]">
                <div className="flex items-center gap-2 text-[#20372B] font-semibold text-[11px] uppercase tracking-wider">
                  <ShieldCheck className="w-4 h-4 text-[#365D43]" />
                  <span>Verified Destination Knowledge</span>
                </div>
                <ul className="space-y-1.5 text-xs pl-6 list-disc text-[#5D7063]">
                  <li>Lodge & Hotel Tariffs with Meal Plans</li>
                  <li>Scenic Helicopter Flights (12m & 25m)</li>
                  <li>Heritage Sunset Cruises & Park Fees</li>
                  <li>School Trip Itineraries & Group Rates</li>
                </ul>
              </div>

              <div className="mt-5 pt-4 border-t border-[#EDF2EB] flex items-center justify-center gap-2 text-[11px] text-[#5D7063]">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>Ready to answer your travel questions</span>
              </div>
            </div>

            {/* Quick Topic Prompts Card */}
            <div className="hidden lg:block bg-[#F4F7F3] rounded-3xl border border-[#D8E3D5] p-5">
              <h2 className="text-xs font-bold uppercase tracking-wider text-[#20372B] mb-3 flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-[#8B6A3E]" />
                <span>Suggested Topics</span>
              </h2>
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => handleSendMessage('Compare the 12m and 25m scenic helicopter flights over Victoria Falls.')}
                  className="w-full text-left p-2.5 rounded-xl bg-white border border-[#D8E3D5] hover:border-[#8B6A3E] text-xs text-[#20372B] font-medium transition cursor-pointer flex items-center justify-between group"
                >
                  <span className="flex items-center gap-2">
                    <Plane className="w-3.5 h-3.5 text-[#8B6A3E]" />
                    <span>Compare Helicopter Flights</span>
                  </span>
                  <ArrowRight className="w-3 h-3 text-stone-400 group-hover:text-[#8B6A3E] transition" />
                </button>
                <button
                  type="button"
                  onClick={() => handleSendMessage('Tell me about the Heritage Standard Sunset Cruise on the Zambezi.')}
                  className="w-full text-left p-2.5 rounded-xl bg-white border border-[#D8E3D5] hover:border-[#8B6A3E] text-xs text-[#20372B] font-medium transition cursor-pointer flex items-center justify-between group"
                >
                  <span className="flex items-center gap-2">
                    <Ship className="w-3.5 h-3.5 text-[#8B6A3E]" />
                    <span>Heritage Sunset Cruise & Fees</span>
                  </span>
                  <ArrowRight className="w-3 h-3 text-stone-400 group-hover:text-[#8B6A3E] transition" />
                </button>
                <button
                  type="button"
                  onClick={() => handleSendMessage('What luxury river lodges are available along the Zambezi?')}
                  className="w-full text-left p-2.5 rounded-xl bg-white border border-[#D8E3D5] hover:border-[#8B6A3E] text-xs text-[#20372B] font-medium transition cursor-pointer flex items-center justify-between group"
                >
                  <span className="flex items-center gap-2">
                    <Building className="w-3.5 h-3.5 text-[#8B6A3E]" />
                    <span>Compare Zambezi Lodges</span>
                  </span>
                  <ArrowRight className="w-3 h-3 text-stone-400 group-hover:text-[#8B6A3E] transition" />
                </button>
                <button
                  type="button"
                  onClick={() => handleSendMessage('What are the school trip accommodation tariffs and group rates?')}
                  className="w-full text-left p-2.5 rounded-xl bg-white border border-[#D8E3D5] hover:border-[#8B6A3E] text-xs text-[#20372B] font-medium transition cursor-pointer flex items-center justify-between group"
                >
                  <span className="flex items-center gap-2">
                    <GraduationCap className="w-3.5 h-3.5 text-[#8B6A3E]" />
                    <span>School Trip Tariffs</span>
                  </span>
                  <ArrowRight className="w-3 h-3 text-stone-400 group-hover:text-[#8B6A3E] transition" />
                </button>
              </div>
            </div>
          </div>

          {/* Right Column: Conversational Experience */}
          <div className="lg:col-span-8 bg-white rounded-3xl border border-[#D8E3D5] shadow-[0_16px_40px_rgba(38,59,48,0.06)] flex flex-col h-[720px] max-h-[85vh] overflow-hidden">
            {/* Chat Header */}
            <div className="bg-[#1D3227] text-white p-4 flex items-center justify-between border-b border-[#2C4839] shrink-0">
              <div className="flex items-center gap-3">
                <div className="relative w-10 h-10 rounded-2xl overflow-hidden ring-2 ring-[#E2BE8C]/70 shadow-sm shrink-0 bg-stone-900">
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
                  <h2 className="text-sm sm:text-base font-serif font-bold text-white leading-tight">
                    Talk to Syntuc
                  </h2>
                </div>
              </div>

              <button
                type="button"
                onClick={handleResetChat}
                aria-label="Reset Conversation"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-[#D6E2D1] hover:text-white bg-[#2A4637] hover:bg-[#345845] border border-[#3D644F] transition cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5 text-[#E2BE8C]" />
                <span>New Conversation</span>
              </button>
            </div>

            {/* Message Stream */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 bg-[#FAF8F5]">
              {/* Welcoming banner inside stream */}
              <div className="bg-white rounded-2xl border border-[#D8E3D5] p-4 sm:p-5 shadow-xs">
                <div className="flex items-start gap-3.5">
                  <div className="relative shrink-0">
                    <img
                      src={SYNTUC_AVATAR_URL}
                      alt="Syntuc — Your Travel Guide"
                      referrerPolicy="no-referrer"
                      className="w-14 h-14 rounded-2xl object-cover ring-2 ring-[#E2BE8C]/60 shadow-sm bg-stone-900"
                    />
                    <span className="absolute -bottom-1 -right-1 px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-[#20372B] text-[#E2BE8C] border border-[#E2BE8C]/50 shadow-2xs">
                      Guide
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-[10px] uppercase tracking-wider font-bold text-[#8B6A3E] block mb-0.5">
                      Your Syntuc Travel Guide
                    </span>
                    <h3 className="text-base sm:text-lg font-serif font-bold text-[#20372B]">
                      Welcome to Syntuc Explorer
                    </h3>
                    <p className="text-xs text-[#4A5D50] leading-relaxed mt-1">
                      Hello! I'm Syntuc, your intelligent guide to Victoria Falls. Tell me what you're looking for, and I'll help you explore and compare experiences.
                    </p>
                  </div>
                </div>
              </div>

              {/* Messages */}
              {messages.map((msg, index) => (
                <div key={index} className="space-y-1">
                  {msg.role === 'assistant' ? (
                    <div className="flex items-start gap-3 max-w-[92%] sm:max-w-[85%]">
                      {/* Avatar thumbnail beside assistant response */}
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
                        <div className="p-4 rounded-2xl rounded-tl-xs bg-white text-[#20372B] border border-[#D8E3D5] shadow-xs text-xs sm:text-sm leading-relaxed">
                          <div className="whitespace-pre-wrap">{renderMessageContent(msg.text)}</div>
                        </div>

                        {msg.action && (
                          <button
                            onClick={() => handleActionClick(msg.action!)}
                            className="mt-2 px-3.5 py-2 bg-[#F4F7F3] hover:bg-[#EAF0E8] text-[#20372B] border border-[#D8E3D5] rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition cursor-pointer shadow-xs"
                          >
                            <span>{msg.action.label || 'View in Explorer'}</span>
                            <ArrowRight className="w-3.5 h-3.5 ml-1 text-[#8B6A3E]" />
                          </button>
                        )}

                        {msg.requiresCoordinator && (
                          <div className="mt-2 flex items-center text-xs text-[#8B6A3E] bg-[#FAF8F5] px-3 py-1.5 rounded-lg border border-[#E8E4DA]">
                            <UserCheck className="w-3.5 h-3.5 mr-1.5 text-[#8B6A3E]" />
                            <span>Special requirements flagged for Victoria Falls desk coordinator review.</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    /* Visitor message on right */
                    <div className="flex items-start justify-end gap-2 max-w-[85%] ml-auto">
                      <div className="p-4 rounded-2xl rounded-tr-xs bg-[#20372B] text-white text-xs sm:text-sm leading-relaxed shadow-xs">
                        <div className="whitespace-pre-wrap">{msg.text}</div>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {isProcessing && (
                <div className="flex items-start gap-3 text-xs text-[#5D7063]">
                  <img
                    src={SYNTUC_AVATAR_URL}
                    alt="Syntuc"
                    referrerPolicy="no-referrer"
                    className="w-8 h-8 rounded-xl object-cover border border-[#D8E3D5] shadow-2xs shrink-0 bg-stone-900"
                  />
                  <div className="flex items-center gap-2 bg-white border border-[#D8E3D5] rounded-2xl rounded-tl-xs px-4 py-3 shadow-2xs">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#365D43] animate-bounce" />
                    <div className="w-1.5 h-1.5 rounded-full bg-[#365D43] animate-bounce [animation-delay:150ms]" />
                    <div className="w-1.5 h-1.5 rounded-full bg-[#365D43] animate-bounce [animation-delay:300ms]" />
                    <span className="text-xs text-[#365D43] font-medium ml-1">Syntuc is thinking...</span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Quick Prompts Bar */}
            <div className="px-4 py-2.5 bg-[#F4F7F3] border-t border-[#D8E3D5] flex items-center space-x-2 overflow-x-auto text-xs shrink-0">
              <button
                onClick={() => handleSendMessage('Compare the 12m and 25m helicopter flights')}
                className="px-3 py-1 rounded-full bg-white border border-[#D8E3D5] text-[#20372B] whitespace-nowrap hover:border-[#8B6A3E] hover:text-[#8B6A3E] transition shadow-2xs cursor-pointer"
              >
                Compare Helicopters
              </button>
              <button
                onClick={() => handleSendMessage('Tell me about the Heritage Standard Sunset Cruise on the Zambezi.')}
                className="px-3 py-1 rounded-full bg-white border border-[#D8E3D5] text-[#20372B] whitespace-nowrap hover:border-[#8B6A3E] hover:text-[#8B6A3E] transition shadow-2xs cursor-pointer"
              >
                Heritage Sunset Cruise
              </button>
              <button
                onClick={() => handleSendMessage('What is the Bridge Tour $0 incentive?')}
                className="px-3 py-1 rounded-full bg-white border border-[#D8E3D5] text-[#20372B] whitespace-nowrap hover:border-[#8B6A3E] hover:text-[#8B6A3E] transition shadow-2xs cursor-pointer"
              >
                Bridge Tour $0 Incentive
              </button>
              <button
                onClick={() => handleSendMessage('What are the school trip accommodation tariffs?')}
                className="px-3 py-1 rounded-full bg-white border border-[#D8E3D5] text-[#20372B] whitespace-nowrap hover:border-[#8B6A3E] hover:text-[#8B6A3E] transition shadow-2xs cursor-pointer"
              >
                School Trip Tariffs
              </button>
            </div>

            {/* Input Bar */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="p-3 sm:p-4 bg-white border-t border-[#D8E3D5] flex items-center space-x-2 shrink-0"
            >
              <button
                type="button"
                onClick={handleVoiceInput}
                className={`p-2.5 rounded-xl border transition cursor-pointer ${
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
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder={isListening ? 'Listening to your voice...' : 'Ask Syntuc about Victoria Falls lodges, flights, cruises...'}
                className="flex-1 px-4 py-2.5 text-xs sm:text-sm rounded-xl bg-[#FAF8F5] border border-[#D8E3D5] focus:outline-hidden focus:ring-2 focus:ring-[#365D43]/20 focus:border-[#365D43]"
              />

              <button
                type="submit"
                disabled={isProcessing || !inputMessage.trim()}
                className="p-2.5 sm:px-4 sm:py-2.5 rounded-xl bg-[#20372B] hover:bg-[#2A4637] disabled:bg-stone-200 text-white transition cursor-pointer shadow-xs flex items-center gap-2"
              >
                <span className="hidden sm:inline text-xs font-semibold text-[#E2BE8C]">Send</span>
                <Send className="w-4 h-4 text-[#E2BE8C]" />
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
