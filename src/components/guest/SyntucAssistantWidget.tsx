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
} from 'lucide-react';
import { AssistantResponse, AssistantAction } from '../../types/index.ts';
import { trackEvent } from '../../services/analytics.ts';

const INITIAL_MESSAGES = [
  {
    role: 'assistant' as const,
    text:
      'Hello! I am Syntuc Explorer, your intelligent guide to Victoria Falls, built by SAINTECH. I can help you compare river lodges, explain scenic helicopter flights, discover Zambezi sunset cruises, or plan educational school trips. How may I assist your journey?',
    action: null,
  },
];

export const SyntucAssistantWidget: React.FC = () => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
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
      const response: AssistantResponse = await api.sendAssistantChat(
        message.trim(),
        history,
        tripPlan ? { itemsCount: tripPlan.items.length, adults: tripPlan.adultsCount } : null
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
            'Victoria Falls offers extraordinary sights including guided rainforest walks, 12-minute or 25-minute helicopter flights, and luxury sunset cruises. How can I help you explore?',
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
      {/* Floating launcher button */}
      <button
        id="syntuc-assistant-trigger"
        onClick={() => {
          if (!isOpen) {
            trackEvent({ eventType: 'SYNTUC_CHAT_OPENED' });
          }
          setIsOpen(!isOpen);
        }}
        aria-label="Open Syntuc Explorer digital guide"
        className="fixed bottom-6 right-6 z-40 p-4 rounded-full bg-gradient-to-r from-amber-600 to-amber-800 text-white shadow-xl shadow-amber-900/20 hover:scale-105 active:scale-95 transition-all flex items-center justify-center cursor-pointer group"
        title="Talk to Syntuc Explorer"
      >
        <Sparkles className="w-6 h-6 animate-pulse text-amber-200" />
      </button>

      {/* Slide-out conversational panel */}
      {isOpen && (
        <div
          role="dialog"
          aria-modal="false"
          aria-labelledby="assistant-panel-title"
          className="fixed bottom-22 right-6 z-50 w-[92vw] sm:w-[420px] h-[550px] bg-white rounded-3xl shadow-2xl border border-stone-200/90 flex flex-col overflow-hidden animate-fadeIn"
        >
          {/* Header */}
          <div className="bg-stone-900 text-white p-4 flex items-center justify-between border-b border-stone-800">
            <div className="flex items-center space-x-2.5">
              <div className="w-9 h-9 rounded-xl bg-amber-600 flex items-center justify-center text-white shadow-xs">
                <Compass className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center space-x-1.5">
                  <h4 id="assistant-panel-title" className="font-bold text-sm font-display text-white">Syntuc Explorer</h4>
                  <span className="text-[10px] bg-amber-500/20 text-amber-300 px-1.5 py-0.2 rounded border border-amber-500/30">
                    SAINTECH AI
                  </span>
                </div>
                <p className="text-[10px] text-stone-400">Intelligent Victoria Falls Guide</p>
              </div>
            </div>
            <div className="flex items-center space-x-1.5">
              <button
                type="button"
                onClick={handleResetChat}
                aria-label="Reset Chat"
                title="Reset conversation context & start new chat"
                className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-xl text-xs font-semibold text-stone-300 hover:text-white bg-stone-800 hover:bg-stone-700 border border-stone-700 transition cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                <span>Reset Chat</span>
              </button>
              <button
                onClick={() => setIsOpen(false)}
                aria-label="Close digital guide"
                className="p-1.5 rounded-full text-stone-400 hover:text-white hover:bg-stone-800 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Messages list */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-stone-50/50">
            {messages.map((msg, index) => (
              <div
                key={index}
                className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[85%] p-3.5 rounded-2xl text-xs leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-amber-600 text-white rounded-tr-xs'
                      : 'bg-white text-stone-800 border border-stone-200/80 rounded-tl-xs shadow-xs'
                  }`}
                >
                  <div className="whitespace-pre-wrap">
                    {msg.role === 'assistant' ? renderMessageContent(msg.text) : msg.text}
                  </div>
                </div>

                {/* Structured Action Chip */}
                {msg.action && (
                  <button
                    onClick={() => handleActionClick(msg.action!)}
                    className="mt-2 px-3 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition cursor-pointer shadow-xs"
                  >
                    <span>{msg.action.label || 'View in Explorer'}</span>
                    <ArrowRight className="w-3.5 h-3.5 ml-1" />
                  </button>
                )}

                {/* Coordinator Needed Flag */}
                {msg.requiresCoordinator && (
                  <div className="mt-1.5 flex items-center text-[10px] text-amber-800 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                    <UserCheck className="w-3 h-3 mr-1 text-amber-700" />
                    <span>Special requirements flagged for Victoria Falls desk coordinator review.</span>
                  </div>
                )}
              </div>
            ))}

            {isProcessing && (
              <div className="flex items-center space-x-2 text-stone-400 text-xs py-2">
                <div className="w-2 h-2 rounded-full bg-amber-600 animate-bounce" />
                <div className="w-2 h-2 rounded-full bg-amber-600 animate-bounce delay-100" />
                <div className="w-2 h-2 rounded-full bg-amber-600 animate-bounce delay-200" />
                <span className="text-[11px] text-stone-500">Syntuc is thinking...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick prompt chips */}
          <div className="px-3 py-1.5 bg-stone-100/70 border-t border-stone-200/60 flex items-center space-x-1.5 overflow-x-auto text-[11px]">
            <button
              onClick={() => handleSendMessage('What is the difference between the 12m and 25m helicopter flights?')}
              className="px-2.5 py-1 rounded-full bg-white border border-stone-200 text-stone-700 whitespace-nowrap hover:border-amber-400 hover:text-amber-800 transition"
            >
              Compare Helicopters
            </button>
            <button
              onClick={() => handleSendMessage('How does the Bridge Tour incentive work?')}
              className="px-2.5 py-1 rounded-full bg-white border border-stone-200 text-stone-700 whitespace-nowrap hover:border-amber-400 hover:text-amber-800 transition"
            >
              Bridge Tour $0 Incentive
            </button>
            <button
              onClick={() => handleSendMessage('What are the school trip accommodation options and tariffs?')}
              className="px-2.5 py-1 rounded-full bg-white border border-stone-200 text-stone-700 whitespace-nowrap hover:border-amber-400 hover:text-amber-800 transition"
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
            className="p-3 bg-white border-t border-stone-200 flex items-center space-x-2"
          >
            <button
              type="button"
              onClick={handleVoiceInput}
              className={`p-2 rounded-xl border transition ${
                isListening
                  ? 'bg-rose-500 text-white border-rose-600 animate-pulse'
                  : 'bg-stone-50 text-stone-600 border-stone-200 hover:bg-stone-100'
              }`}
              title={isListening ? 'Listening... click to stop' : 'Click for voice input'}
            >
              {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>

            <input
              type="text"
              value={inputMessage}
              onChange={e => setInputMessage(e.target.value)}
              placeholder={isListening ? 'Listening to your voice...' : 'Ask about Victoria Falls lodges, flights, cruises...'}
              className="flex-1 px-3 py-2 text-xs rounded-xl bg-stone-50 border border-stone-200 focus:outline-hidden focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
            />

            <button
              type="submit"
              disabled={isProcessing || !inputMessage.trim()}
              className="p-2 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:bg-stone-200 text-white transition cursor-pointer"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}
    </>
  );
};
