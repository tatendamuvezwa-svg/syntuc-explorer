import React, { useState, useEffect } from 'react';
import { api } from '../../services/api.ts';
import { useSession } from '../../context/SessionContext.tsx';
import {
  X,
  MapPin,
  Clock,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Users,
  Bed,
  Plus,
  ArrowRight,
  Info,
  Calendar,
  Play,
} from 'lucide-react';
import { Room, MediaAsset } from '../../types/index.ts';

function formatVideoEmbed(url: string): { type: 'iframe' | 'video'; embedUrl: string } | null {
  if (!url) return null;
  const trimmed = url.trim();

  // YouTube standard watch or share link
  const ytMatch = trimmed.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i);
  if (ytMatch && ytMatch[1]) {
    return { type: 'iframe', embedUrl: `https://www.youtube.com/embed/${ytMatch[1]}` };
  }

  // Vimeo
  const vimeoMatch = trimmed.match(/(?:vimeo\.com\/)(\d+)/i);
  if (vimeoMatch && vimeoMatch[1]) {
    return { type: 'iframe', embedUrl: `https://player.vimeo.com/video/${vimeoMatch[1]}` };
  }

  // Direct MP4 / WebM
  if (trimmed.match(/\.(mp4|webm|ogg)$/i)) {
    return { type: 'video', embedUrl: trimmed };
  }

  // Default fallback if already embeddable
  return { type: 'iframe', embedUrl: trimmed };
}

export const ProductDetailModal: React.FC = () => {
  const { selectedProductId, closeProductDetail, addToTrip, openReservationModal } = useSession();
  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeMediaUrl, setActiveMediaUrl] = useState<string>('');
  const [selectedRoomId, setSelectedRoomId] = useState<string>('');
  const [guestCount, setGuestCount] = useState<number>(2);

  useEffect(() => {
    if (!selectedProductId) return;
    setLoading(true);
    async function load() {
      try {
        const data = await api.getProductDetail(selectedProductId!);
        setProduct(data);
        setActiveMediaUrl(data.primaryImageUrl || (data.media?.[0]?.url) || '');
        if (data.rooms && data.rooms.length > 0) {
          setSelectedRoomId(data.rooms[0].id);
        }
      } catch (err) {
        console.error('Failed to load product detail:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [selectedProductId]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeProductDetail();
      }
    };
    if (selectedProductId) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedProductId, closeProductDetail]);

  if (!selectedProductId) return null;

  const handleAddAndClose = async (openReservation: boolean = false) => {
    if (!product) return;
    await addToTrip({
      productId: product.id,
      roomId: product.productType === 'accommodation' ? selectedRoomId : undefined,
      guestCount,
    });
    closeProductDetail();
    if (openReservation) {
      openReservationModal();
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="product-modal-title"
      className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 animate-fadeIn"
    >
      <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-stone-200 flex flex-col">
        {/* Header bar */}
        <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-md px-6 py-4 border-b border-stone-100 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span
              className={`text-xs uppercase font-bold px-2.5 py-0.5 rounded-md ${
                product?.productType === 'accommodation'
                  ? 'bg-amber-100 text-amber-900'
                  : 'bg-emerald-100 text-emerald-900'
              }`}
            >
              {product?.productType === 'accommodation' ? 'Accommodation' : 'Activity & Experience'}
            </span>
            <span className="text-xs text-stone-500 font-medium">
              Verified by {product?.operator?.name || 'Syntuc Victoria Falls'}
            </span>
          </div>
          <button
            onClick={closeProductDetail}
            aria-label="Close product details dialog"
            className="p-2 rounded-full text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {loading ? (
          <div className="p-12 text-center">
            <div className="w-10 h-10 border-4 border-amber-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm text-stone-500">Loading verified experience details...</p>
          </div>
        ) : !product ? (
          <div className="p-12 text-center text-stone-500">Product details unavailable.</div>
        ) : (
          <div className="p-6 sm:p-8 space-y-8">
            {/* Gallery Section */}
            <div>
              <div className="relative h-80 sm:h-96 w-full rounded-2xl overflow-hidden bg-stone-100 shadow-inner">
                <img
                  src={activeMediaUrl || 'https://images.unsplash.com/photo-1549880338-65ddcdfd017b?auto=format&fit=crop&w=1200&q=80'}
                  alt={product.name}
                  className="w-full h-full object-cover transition-all duration-300"
                />
                <div className="absolute top-4 left-4 bg-stone-900/80 backdrop-blur-md text-white px-3 py-1 rounded-lg text-xs font-semibold flex items-center">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 mr-1.5" />
                  Authoritative Catalog Record
                </div>
              </div>

              {/* Thumbnails */}
              {product.media && product.media.length > 1 && (
                <div className="mt-3 flex items-center space-x-2 overflow-x-auto pb-1">
                  {product.media.map((med: MediaAsset) => (
                    <button
                      key={med.id}
                      onClick={() => setActiveMediaUrl(med.url)}
                      className={`relative w-20 h-16 rounded-xl overflow-hidden shrink-0 border-2 transition ${
                        activeMediaUrl === med.url ? 'border-amber-600 scale-105' : 'border-stone-200 opacity-70 hover:opacity-100'
                      }`}
                    >
                      <img src={med.thumbnailUrl || med.url} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Title & Metadata */}
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
              <div>
                <h2 id="product-modal-title" className="text-2xl sm:text-3xl font-bold text-stone-900 font-display">
                  {product.name}
                </h2>
                <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-stone-500 font-medium">
                  <span className="flex items-center text-amber-800">
                    <MapPin className="w-3.5 h-3.5 mr-1" />
                    {product.location}
                  </span>
                  {product.duration && (
                    <span className="flex items-center">
                      <Clock className="w-3.5 h-3.5 mr-1" />
                      {product.duration}
                    </span>
                  )}
                  <span className="flex items-center text-emerald-700">
                    <ShieldCheck className="w-3.5 h-3.5 mr-1" />
                    {product.availabilityNote || 'Subject to partner confirmation'}
                  </span>
                </div>
              </div>

              {/* Pricing box */}
              <div className="bg-amber-50/80 border border-amber-200/80 rounded-2xl p-4 shrink-0 text-left md:text-right">
                <div className="text-xs text-amber-900 font-semibold uppercase tracking-wide">
                  Catalog Tariff
                </div>
                <div className="text-2xl font-extrabold text-amber-800 font-display mt-0.5">
                  US${product.basePrice}
                </div>
                <div className="text-xs text-stone-500">
                  {product.priceBasis === 'per_room_night' ? 'per room / night' : 'per person'}
                </div>
              </div>
            </div>

            {/* Description */}
            <div className="prose prose-stone text-sm leading-relaxed text-stone-700">
              <p>{product.description}</p>
            </div>

            {/* Accommodation Rooms Section */}
            {product.productType === 'accommodation' && product.rooms && product.rooms.length > 0 && (
              <div className="space-y-3 pt-4 border-t border-stone-200">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold text-stone-900 font-display flex items-center">
                    <Bed className="w-4 h-4 mr-2 text-amber-700" /> Select Room Option
                  </h3>
                  <span className="text-xs text-stone-500">Available on request</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {product.rooms.map((room: Room) => (
                    <div
                      key={room.id}
                      onClick={() => setSelectedRoomId(room.id)}
                      className={`p-4 rounded-xl border-2 transition cursor-pointer flex flex-col justify-between ${
                        selectedRoomId === room.id
                          ? 'border-amber-600 bg-amber-50/40 shadow-sm'
                          : 'border-stone-200 hover:border-stone-300 bg-white'
                      }`}
                    >
                      <div>
                        <div className="flex items-start justify-between">
                          <h4 className="text-sm font-bold text-stone-900">{room.name}</h4>
                          <span className="text-sm font-bold text-amber-800 font-display">
                            US${room.pricePerNight}
                          </span>
                        </div>
                        <p className="text-xs text-stone-500 mt-1 line-clamp-2">{room.description}</p>
                      </div>

                      <div className="mt-3 pt-2 border-t border-stone-100 flex items-center justify-between text-[11px] text-stone-500">
                        <span className="flex items-center">
                          <Users className="w-3 h-3 mr-1" /> Up to {room.capacityAdults} adults
                        </span>
                        <span className="text-amber-800 font-medium">per night</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Featured Video Section */}
            {product.videoUrl && formatVideoEmbed(product.videoUrl) && (
              <div className="pt-4 border-t border-stone-200">
                <h3 className="text-xs font-bold text-stone-900 uppercase tracking-wide mb-3 flex items-center">
                  <Play className="w-3.5 h-3.5 mr-2 text-amber-700" />
                  Featured Experience Video
                </h3>
                <div className="relative aspect-video rounded-2xl overflow-hidden bg-stone-900 border border-stone-200 shadow-md">
                  {formatVideoEmbed(product.videoUrl)!.type === 'iframe' ? (
                    <iframe
                      src={formatVideoEmbed(product.videoUrl)!.embedUrl}
                      title={`${product.name} Video`}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      className="w-full h-full border-0"
                    />
                  ) : (
                    <video
                      src={formatVideoEmbed(product.videoUrl)!.embedUrl}
                      controls
                      className="w-full h-full object-cover"
                    >
                      Your browser does not support HTML5 video.
                    </video>
                  )}
                </div>
              </div>
            )}

            {/* Inclusions & Exclusions */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-stone-200 text-xs">
              {product.inclusions && product.inclusions.length > 0 && (
                <div className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-100">
                  <h4 className="font-bold text-emerald-900 uppercase tracking-wide text-[11px] mb-2 flex items-center">
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1.5 text-emerald-600" /> Inclusions
                  </h4>
                  <ul className="space-y-1.5 text-stone-600">
                    {product.inclusions.map((inc: string, i: number) => (
                      <li key={i} className="flex items-start">
                        <span className="text-emerald-600 font-bold mr-1.5">•</span>
                        <span>{inc}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {product.exclusions && product.exclusions.length > 0 && (
                <div className="bg-rose-50/50 p-4 rounded-xl border border-rose-100">
                  <h4 className="font-bold text-rose-900 uppercase tracking-wide text-[11px] mb-2 flex items-center">
                    <XCircle className="w-3.5 h-3.5 mr-1.5 text-rose-500" /> Exclusions
                  </h4>
                  <ul className="space-y-1.5 text-stone-600">
                    {product.exclusions.map((exc: string, i: number) => (
                      <li key={i} className="flex items-start">
                        <span className="text-rose-500 font-bold mr-1.5">•</span>
                        <span>{exc}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Guests count and Actions */}
            <div className="pt-6 border-t border-stone-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center space-x-3">
                <span className="text-xs font-semibold text-stone-700">Guests:</span>
                <div className="flex items-center border border-stone-200 rounded-lg">
                  <button
                    onClick={() => setGuestCount(Math.max(1, guestCount - 1))}
                    className="px-2.5 py-1 text-sm font-bold text-stone-600 hover:bg-stone-100"
                  >
                    -
                  </button>
                  <span className="px-3 py-1 text-sm font-semibold text-stone-800">{guestCount}</span>
                  <button
                    onClick={() => setGuestCount(guestCount + 1)}
                    className="px-2.5 py-1 text-sm font-bold text-stone-600 hover:bg-stone-100"
                  >
                    +
                  </button>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <button
                  onClick={() => handleAddAndClose(false)}
                  className="px-4 py-2.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 font-semibold text-xs transition flex items-center cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 mr-1.5 text-amber-700" />
                  <span>Add to My Trip</span>
                </button>

                <button
                  onClick={() => handleAddAndClose(true)}
                  className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs shadow-md shadow-amber-600/30 transition flex items-center cursor-pointer"
                >
                  <span>Request Reservation</span>
                  <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
