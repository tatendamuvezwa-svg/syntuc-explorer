import React, { useState, useEffect, useRef } from 'react';
import { api } from '../../services/api.ts';
import { Product, MediaAsset } from '../../types/index.ts';
import {
  X,
  Upload,
  Image as ImageIcon,
  Video,
  CheckCircle2,
  AlertCircle,
  Play,
  ArrowUp,
  ArrowDown,
  Trash2,
  Star,
  Check,
  Globe,
  DollarSign,
  Clock,
  MapPin,
  Tag,
} from 'lucide-react';

interface ProductEditorModalProps {
  product: Product | null; // null if creating a new product
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  operators: { id: string; name: string }[];
  properties: { id: string; name: string }[];
  categories: { id: string; slug: string; name: string; type: string }[];
}

export const ProductEditorModal: React.FC<ProductEditorModalProps> = ({
  product,
  isOpen,
  onClose,
  onSaved,
  operators,
  properties,
  categories,
}) => {
  const isEditing = Boolean(product && product.id);

  // Form tab state
  const [activeTab, setActiveTab] = useState<'info' | 'media' | 'video' | 'details'>('info');

  // Form fields
  const [name, setName] = useState<string>('');
  const [productType, setProductType] = useState<'accommodation' | 'activity'>('activity');
  const [categorySlug, setCategorySlug] = useState<string>('adventure');
  const [operatorId, setOperatorId] = useState<string>('');
  const [propertyId, setPropertyId] = useState<string>('');
  const [shortDescription, setShortDescription] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [location, setLocation] = useState<string>('Victoria Falls, Zimbabwe');
  const [duration, setDuration] = useState<string>('');
  const [basePrice, setBasePrice] = useState<string>('50');
  const [currency, setCurrency] = useState<string>('USD');
  const [priceBasis, setPriceBasis] = useState<'per_person' | 'per_room_night' | 'per_group'>('per_person');
  const [inclusionsText, setInclusionsText] = useState<string>('');
  const [exclusionsText, setExclusionsText] = useState<string>('');
  const [videoUrl, setVideoUrl] = useState<string>('');
  const [isPublished, setIsPublished] = useState<boolean>(false);
  const [availabilityNote, setAvailabilityNote] = useState<string>('Subject to partner confirmation');

  // Media state
  const [mediaList, setMediaList] = useState<MediaAsset[]>([]);
  const [loadingMedia, setLoadingMedia] = useState<boolean>(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);
  const [uploadCaption, setUploadCaption] = useState<string>('');
  const [uploadAsPrimary, setUploadAsPrimary] = useState<boolean>(false);
  const [isUploading, setIsUploading] = useState<boolean>(false);

  // External URL upload state
  const [externalUrl, setExternalUrl] = useState<string>('');
  const [isRegisteringUrl, setIsRegisteringUrl] = useState<boolean>(false);

  // Status message
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (product) {
      setName(product.name || '');
      setProductType(product.productType || 'activity');
      setCategorySlug(product.categorySlug || 'adventure');
      setOperatorId(product.operatorId || '');
      setPropertyId(product.propertyId || '');
      setShortDescription(product.shortDescription || '');
      setDescription(product.description || '');
      setLocation(product.location || 'Victoria Falls, Zimbabwe');
      setDuration(product.duration || '');
      setBasePrice(product.basePrice || '50');
      setCurrency(product.currency || 'USD');
      setPriceBasis(product.priceBasis || 'per_person');
      setInclusionsText((product.inclusions || []).join('\n'));
      setExclusionsText((product.exclusions || []).join('\n'));
      setVideoUrl(product.videoUrl || '');
      setIsPublished(Boolean(product.isPublished));
      setAvailabilityNote(product.availabilityNote || 'Subject to partner confirmation');
      if (product.id) {
        loadProductMedia(product.id);
      } else {
        setMediaList([]);
      }
    } else {
      // Defaults for new product
      setName('');
      setProductType('activity');
      setCategorySlug('adventure');
      setOperatorId(operators[0]?.id || '');
      setPropertyId('');
      setShortDescription('');
      setDescription('');
      setLocation('Victoria Falls, Zimbabwe');
      setDuration('2 Hours');
      setBasePrice('65.00');
      setCurrency('USD');
      setPriceBasis('per_person');
      setInclusionsText('Professional licensed guide\nBottled mineral water\nHotel transfers');
      setExclusionsText('Rainforest national park entry fee\nPersonal items & gratuities');
      setVideoUrl('');
      setIsPublished(false); // New products start as DRAFT
      setAvailabilityNote('Subject to partner confirmation');
      setMediaList([]);
    }
    setStatusMessage(null);
    setUploadFile(null);
    setUploadPreview(null);
  }, [product, isOpen]);

  const loadProductMedia = async (productId: string) => {
    setLoadingMedia(true);
    try {
      const data = await api.getProductMedia(productId);
      setMediaList(data);
    } catch (err) {
      console.error('Failed to load product media:', err);
    } finally {
      setLoadingMedia(false);
    }
  };

  if (!isOpen) return null;

  // File selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadFile(file);
      const previewUrl = URL.createObjectURL(file);
      setUploadPreview(previewUrl);
    }
  };

  // Upload file to product
  const handleUploadFile = async () => {
    if (!uploadFile) return;
    if (!product?.id) {
      setStatusMessage({
        type: 'error',
        text: 'Please save the initial product first before uploading media files.',
      });
      return;
    }

    setIsUploading(true);
    setStatusMessage(null);

    try {
      const formData = new FormData();
      formData.append('file', uploadFile);
      formData.append('ownerId', product.id);
      formData.append('ownerType', 'product');
      formData.append('caption', uploadCaption.trim());
      formData.append('isPrimary', uploadAsPrimary ? 'true' : 'false');
      formData.append('displayOrder', String(mediaList.length));

      await api.uploadMedia(formData);

      setUploadFile(null);
      setUploadPreview(null);
      setUploadCaption('');
      setUploadAsPrimary(false);
      if (fileInputRef.current) fileInputRef.current.value = '';

      await loadProductMedia(product.id);
      setStatusMessage({ type: 'success', text: 'Image uploaded and linked successfully!' });
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Image upload failed' });
    } finally {
      setIsUploading(false);
    }
  };

  // Register external URL
  const handleRegisterUrl = async () => {
    if (!externalUrl.trim() || !product?.id) return;

    setIsRegisteringUrl(true);
    setStatusMessage(null);

    try {
      const formData = new FormData();
      formData.append('externalUrl', externalUrl.trim());
      formData.append('ownerId', product.id);
      formData.append('ownerType', 'product');
      formData.append('caption', uploadCaption.trim());
      formData.append('isPrimary', uploadAsPrimary ? 'true' : 'false');
      formData.append('displayOrder', String(mediaList.length));

      await api.uploadMedia(formData);

      setExternalUrl('');
      setUploadCaption('');
      setUploadAsPrimary(false);

      await loadProductMedia(product.id);
      setStatusMessage({ type: 'success', text: 'Image URL registered and applied successfully!' });
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Registration failed' });
    } finally {
      setIsRegisteringUrl(false);
    }
  };

  // Set primary image
  const handleSetPrimary = async (mediaId: string) => {
    try {
      await api.setPrimaryMedia(mediaId);
      if (product?.id) {
        await loadProductMedia(product.id);
      }
      setStatusMessage({ type: 'success', text: 'Primary thumbnail updated. Live guest views now reflect this!' });
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Failed to set primary thumbnail' });
    }
  };

  // Delete media asset
  const handleDeleteMedia = async (mediaId: string) => {
    if (!confirm('Are you sure you want to remove this media asset?')) return;
    try {
      await api.deleteMedia(mediaId);
      if (product?.id) {
        await loadProductMedia(product.id);
      }
      setStatusMessage({ type: 'success', text: 'Media asset deleted successfully' });
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Failed to delete media asset' });
    }
  };

  // Move gallery position up/down
  const handleMoveOrder = async (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= mediaList.length) return;

    const updated = [...mediaList];
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;

    const orderPayload = updated.map((m, idx) => ({ id: m.id, displayOrder: idx }));
    setMediaList(updated);

    try {
      await api.reorderMedia(orderPayload);
    } catch (err) {
      console.error('Failed to persist order:', err);
    }
  };

  // Save product (Create or Update)
  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setStatusMessage({ type: 'error', text: 'Product name is required.' });
      return;
    }
    if (!basePrice || isNaN(Number(basePrice))) {
      setStatusMessage({ type: 'error', text: 'A valid numeric tariff/base price is required.' });
      return;
    }

    setIsSaving(true);
    setStatusMessage(null);

    const inclusions = inclusionsText
      .split('\n')
      .map(s => s.trim())
      .filter(Boolean);
    const exclusions = exclusionsText
      .split('\n')
      .map(s => s.trim())
      .filter(Boolean);

    const payload = {
      name: name.trim(),
      productType,
      categorySlug,
      operatorId: operatorId || null,
      propertyId: propertyId || null,
      shortDescription: shortDescription.trim() || `${name.trim()} in Victoria Falls.`,
      description: description.trim() || `${name.trim()} offers an authentic Victoria Falls experience.`,
      location: location.trim() || 'Victoria Falls, Zimbabwe',
      duration: duration.trim() || null,
      basePrice: String(Number(basePrice)),
      currency,
      priceBasis,
      inclusions,
      exclusions,
      isPublished,
      videoUrl: videoUrl.trim() || null,
      availabilityNote: availabilityNote.trim() || 'Subject to partner confirmation',
    };

    try {
      if (isEditing && product) {
        await api.updateProduct(product.id, payload);
        setStatusMessage({ type: 'success', text: 'Product updated and revision recorded in audit history.' });
      } else {
        const res = await api.createProduct(payload);
        setStatusMessage({ type: 'success', text: 'Product created successfully as ' + (isPublished ? 'PUBLISHED' : 'DRAFT') });
      }
      onSaved();
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Failed to save product' });
    } finally {
      setIsSaving(false);
    }
  };

  // Video embed helper
  const getVideoPreviewEmbed = (url: string) => {
    if (!url) return null;
    const trimmed = url.trim();
    const ytMatch = trimmed.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i);
    if (ytMatch && ytMatch[1]) {
      return `https://www.youtube.com/embed/${ytMatch[1]}`;
    }
    const vimeoMatch = trimmed.match(/(?:vimeo\.com\/)(\d+)/i);
    if (vimeoMatch && vimeoMatch[1]) {
      return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
    }
    return null;
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-fadeIn"
    >
      <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[92vh] overflow-y-auto shadow-2xl border border-stone-200 flex flex-col">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-md px-6 py-4 border-b border-stone-100 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <span
              className={`text-xs uppercase font-extrabold px-2.5 py-0.5 rounded-md ${
                isPublished ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
              }`}
            >
              {isPublished ? 'PUBLISHED' : 'DRAFT'}
            </span>
            <h2 className="text-lg font-bold text-stone-900 font-display">
              {isEditing ? `Edit Product: ${product?.name}` : 'Create New Catalog Product'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab navigation */}
        <div className="px-6 border-b border-stone-100 flex space-x-6 text-xs font-semibold text-stone-600 bg-stone-50/50">
          <button
            onClick={() => setActiveTab('info')}
            className={`py-3 border-b-2 transition flex items-center ${
              activeTab === 'info' ? 'border-amber-600 text-amber-800' : 'border-transparent hover:text-stone-900'
            }`}
          >
            <Tag className="w-3.5 h-3.5 mr-1.5" />
            General & Pricing
          </button>
          <button
            onClick={() => setActiveTab('details')}
            className={`py-3 border-b-2 transition flex items-center ${
              activeTab === 'details' ? 'border-amber-600 text-amber-800' : 'border-transparent hover:text-stone-900'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
            Descriptions & Inclusions
          </button>
          <button
            onClick={() => setActiveTab('media')}
            className={`py-3 border-b-2 transition flex items-center ${
              activeTab === 'media' ? 'border-amber-600 text-amber-800' : 'border-transparent hover:text-stone-900'
            }`}
          >
            <ImageIcon className="w-3.5 h-3.5 mr-1.5" />
            Images & Media ({mediaList.length})
          </button>
          <button
            onClick={() => setActiveTab('video')}
            className={`py-3 border-b-2 transition flex items-center ${
              activeTab === 'video' ? 'border-amber-600 text-amber-800' : 'border-transparent hover:text-stone-900'
            }`}
          >
            <Video className="w-3.5 h-3.5 mr-1.5" />
            Video Link {videoUrl ? '•' : ''}
          </button>
        </div>

        {/* Status banner */}
        {statusMessage && (
          <div
            className={`mx-6 mt-4 p-3 rounded-xl text-xs flex items-center justify-between ${
              statusMessage.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : 'bg-rose-50 text-rose-800 border border-rose-200'
            }`}
          >
            <div className="flex items-center space-x-2">
              {statusMessage.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              )}
              <span>{statusMessage.text}</span>
            </div>
            <button onClick={() => setStatusMessage(null)} className="text-stone-400 hover:text-stone-600">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Modal content body */}
        <form onSubmit={handleSaveProduct} className="p-6 space-y-6 flex-1 text-xs">
          {/* TAB 1: General & Pricing */}
          {activeTab === 'info' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-stone-700 mb-1">Product Name *</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="e.g. Zambezi Sunset Catamaran Cruise"
                    className="w-full px-3 py-2 rounded-xl border border-stone-200 text-xs focus:ring-2 focus:ring-amber-500/20"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-stone-700 mb-1">Product Type *</label>
                  <select
                    value={productType}
                    onChange={e => setProductType(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl border border-stone-200 text-xs bg-white"
                  >
                    <option value="activity">Activity & Experience</option>
                    <option value="accommodation">Accommodation / Lodge / Hotel</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block font-semibold text-stone-700 mb-1">Category *</label>
                  <select
                    value={categorySlug}
                    onChange={e => setCategorySlug(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-stone-200 text-xs bg-white"
                  >
                    {categories.map(c => (
                      <option key={c.id} value={c.slug}>
                        {c.name} ({c.type})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-stone-700 mb-1">Verified Operator</label>
                  <select
                    value={operatorId}
                    onChange={e => setOperatorId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-stone-200 text-xs bg-white"
                  >
                    <option value="">-- Independent / Syntuc Partner --</option>
                    {operators.map(o => (
                      <option key={o.id} value={o.id}>
                        {o.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-stone-700 mb-1">Duration</label>
                  <input
                    type="text"
                    value={duration}
                    onChange={e => setDuration(e.target.value)}
                    placeholder="e.g. 2 Hours, Full Day, Overnight"
                    className="w-full px-3 py-2 rounded-xl border border-stone-200 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 bg-amber-50/50 rounded-2xl border border-amber-200/60">
                <div>
                  <label className="block font-semibold text-amber-900 mb-1">Tariff / Base Price (USD) *</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-stone-400 font-bold">$</span>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={basePrice}
                      onChange={e => setBasePrice(e.target.value)}
                      className="w-full pl-7 pr-3 py-2 rounded-xl border border-stone-200 text-xs bg-white font-bold"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-amber-900 mb-1">Price Basis *</label>
                  <select
                    value={priceBasis}
                    onChange={e => setPriceBasis(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl border border-stone-200 text-xs bg-white"
                  >
                    <option value="per_person">Per Person</option>
                    <option value="per_room_night">Per Room Night</option>
                    <option value="per_group">Per Group / Charter</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-amber-900 mb-1">Location</label>
                  <input
                    type="text"
                    value={location}
                    onChange={e => setLocation(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-stone-200 text-xs bg-white"
                  />
                </div>
              </div>

              {/* Publication state toggle */}
              <div className="p-4 bg-stone-50 rounded-2xl border border-stone-200 flex items-center justify-between">
                <div>
                  <div className="font-bold text-stone-800">Catalogue Publication State</div>
                  <div className="text-[11px] text-stone-500">
                    Draft items are only visible to Reservations Desk coordinators. Published items are live in the guest catalogue.
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isPublished}
                    onChange={e => setIsPublished(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-stone-300 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                  <span className="ml-2.5 font-bold text-xs">
                    {isPublished ? 'PUBLISHED' : 'DRAFT'}
                  </span>
                </label>
              </div>
            </div>
          )}

          {/* TAB 2: Descriptions & Inclusions */}
          {activeTab === 'details' && (
            <div className="space-y-4">
              <div>
                <label className="block font-semibold text-stone-700 mb-1">Short Description (Cards & Previews) *</label>
                <input
                  type="text"
                  value={shortDescription}
                  onChange={e => setShortDescription(e.target.value)}
                  placeholder="One sentence summary of the experience"
                  className="w-full px-3 py-2 rounded-xl border border-stone-200 text-xs"
                />
              </div>

              <div>
                <label className="block font-semibold text-stone-700 mb-1">Full Guest-Facing Description *</label>
                <textarea
                  rows={4}
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Detailed description of the lodge, room amenities, itinerary, wildlife sightings, etc."
                  className="w-full px-3 py-2 rounded-xl border border-stone-200 text-xs"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-emerald-800 mb-1">Inclusions (One per line)</label>
                  <textarea
                    rows={4}
                    value={inclusionsText}
                    onChange={e => setInclusionsText(e.target.value)}
                    placeholder="e.g. Guided walking tour&#10;Park refreshments&#10;Hotel pickup and drop-off"
                    className="w-full px-3 py-2 rounded-xl border border-stone-200 text-xs"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-rose-800 mb-1">Exclusions (One per line)</label>
                  <textarea
                    rows={4}
                    value={exclusionsText}
                    onChange={e => setExclusionsText(e.target.value)}
                    placeholder="e.g. National park conservation fee&#10;Gratuities&#10;Visa fees"
                    className="w-full px-3 py-2 rounded-xl border border-stone-200 text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-stone-700 mb-1">Availability / Confirmation Note</label>
                <input
                  type="text"
                  value={availabilityNote}
                  onChange={e => setAvailabilityNote(e.target.value)}
                  placeholder="e.g. Subject to partner confirmation"
                  className="w-full px-3 py-2 rounded-xl border border-stone-200 text-xs"
                />
              </div>
            </div>
          )}

          {/* TAB 3: Images & Media Management */}
          {activeTab === 'media' && (
            <div className="space-y-6">
              {!isEditing ? (
                <div className="p-6 bg-stone-50 rounded-2xl border border-stone-200 text-center">
                  <ImageIcon className="w-8 h-8 text-stone-400 mx-auto mb-2" />
                  <p className="text-xs text-stone-600 font-semibold">
                    Please click "Save Product" first to create the authoritative product record.
                  </p>
                  <p className="text-[11px] text-stone-500 mt-1">
                    Once created, you can immediately upload files, set primary thumbnails, and organize gallery images!
                  </p>
                </div>
              ) : (
                <>
                  {/* Current Media Assets */}
                  <div>
                    <h4 className="font-bold text-stone-800 uppercase tracking-wide text-[11px] mb-3">
                      Current Media Assets ({mediaList.length})
                    </h4>

                    {loadingMedia ? (
                      <div className="p-8 text-center text-stone-400">Loading media assets...</div>
                    ) : mediaList.length === 0 ? (
                      <div className="p-8 text-center text-stone-400 bg-stone-50 rounded-2xl border border-dashed border-stone-300">
                        No images linked to this product yet. Upload an image below.
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {mediaList.map((med, idx) => (
                          <div
                            key={med.id}
                            className={`group relative bg-stone-50 rounded-2xl border overflow-hidden shadow-xs flex flex-col justify-between ${
                              med.isPrimary
                                ? 'border-amber-600 ring-2 ring-amber-600/30'
                                : 'border-stone-200'
                            }`}
                          >
                            <div className="relative h-28 bg-stone-200">
                              <img src={med.url} alt="" className="w-full h-full object-cover" />
                              {med.isPrimary && (
                                <span className="absolute top-1.5 left-1.5 text-[9px] font-extrabold uppercase bg-amber-600 text-white px-2 py-0.5 rounded shadow-xs flex items-center">
                                  <Star className="w-2.5 h-2.5 mr-1 fill-white" /> PRIMARY
                                </span>
                              )}
                            </div>

                            <div className="p-2 space-y-1.5">
                              <p className="text-[10px] text-stone-600 truncate">{med.caption || 'No caption'}</p>

                              <div className="flex items-center justify-between pt-1 border-t border-stone-200">
                                <div className="flex space-x-1">
                                  <button
                                    type="button"
                                    onClick={() => handleMoveOrder(idx, 'up')}
                                    disabled={idx === 0}
                                    title="Move Left/Up"
                                    className="p-1 rounded bg-stone-100 hover:bg-stone-200 text-stone-600 disabled:opacity-30"
                                  >
                                    <ArrowUp className="w-3 h-3" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleMoveOrder(idx, 'down')}
                                    disabled={idx === mediaList.length - 1}
                                    title="Move Right/Down"
                                    className="p-1 rounded bg-stone-100 hover:bg-stone-200 text-stone-600 disabled:opacity-30"
                                  >
                                    <ArrowDown className="w-3 h-3" />
                                  </button>
                                </div>

                                <div className="flex space-x-1">
                                  {!med.isPrimary && (
                                    <button
                                      type="button"
                                      onClick={() => handleSetPrimary(med.id)}
                                      title="Set as Primary Thumbnail"
                                      className="p-1 rounded bg-amber-50 hover:bg-amber-600 hover:text-white text-amber-700 transition"
                                    >
                                      <Star className="w-3 h-3" />
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteMedia(med.id)}
                                    title="Delete Media"
                                    className="p-1 rounded bg-rose-50 hover:bg-rose-600 hover:text-white text-rose-600 transition"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Upload Image Section */}
                  <div className="p-5 bg-stone-50 rounded-2xl border border-stone-200 space-y-4">
                    <h4 className="font-bold text-stone-800 uppercase tracking-wide text-[11px] flex items-center">
                      <Upload className="w-3.5 h-3.5 mr-1.5 text-amber-700" /> Upload Local Image File
                    </h4>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
                      <div>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/jpeg,image/png,image/webp,image/avif"
                          onChange={handleFileSelect}
                          className="w-full text-xs text-stone-500 file:mr-3 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-amber-600 file:text-white hover:file:bg-amber-700 file:cursor-pointer"
                        />
                        <p className="text-[10px] text-stone-400 mt-1">
                          Supported formats: JPEG, PNG, WEBP, AVIF (Max 10MB)
                        </p>

                        <div className="mt-3">
                          <label className="block text-[11px] font-semibold text-stone-700 mb-1">Caption</label>
                          <input
                            type="text"
                            value={uploadCaption}
                            onChange={e => setUploadCaption(e.target.value)}
                            placeholder="e.g. Aerial view over Victoria Falls"
                            className="w-full px-3 py-1.5 rounded-lg border border-stone-200 text-xs bg-white"
                          />
                        </div>

                        <div className="mt-2 flex items-center space-x-2">
                          <input
                            type="checkbox"
                            id="uploadPrimary"
                            checked={uploadAsPrimary}
                            onChange={e => setUploadAsPrimary(e.target.checked)}
                            className="rounded text-amber-600"
                          />
                          <label htmlFor="uploadPrimary" className="text-xs font-semibold text-stone-700">
                            Set as Primary Thumbnail immediately
                          </label>
                        </div>

                        <button
                          type="button"
                          disabled={!uploadFile || isUploading}
                          onClick={handleUploadFile}
                          className="mt-3 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-xl text-xs transition disabled:opacity-40 cursor-pointer"
                        >
                          {isUploading ? 'Uploading Image...' : 'Upload Image'}
                        </button>
                      </div>

                      {/* Live Preview Before Upload */}
                      <div>
                        <div className="text-[11px] font-semibold text-stone-500 mb-1">Selected File Preview</div>
                        <div className="h-36 rounded-xl overflow-hidden bg-stone-200 border border-stone-300 flex items-center justify-center">
                          {uploadPreview ? (
                            <img src={uploadPreview} alt="Preview" className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-stone-400 text-xs">No file selected</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Or External Verified Image URL */}
                  <div className="p-4 bg-white rounded-2xl border border-stone-200 space-y-3">
                    <h4 className="font-bold text-stone-700 text-[11px] uppercase tracking-wide flex items-center">
                      <Globe className="w-3.5 h-3.5 mr-1.5 text-stone-500" /> Or Register Verified Image URL
                    </h4>
                    <div className="flex gap-2">
                      <input
                        type="url"
                        value={externalUrl}
                        onChange={e => setExternalUrl(e.target.value)}
                        placeholder="https://images.unsplash.com/..."
                        className="flex-1 px-3 py-1.5 rounded-lg border border-stone-200 text-xs"
                      />
                      <button
                        type="button"
                        disabled={!externalUrl.trim() || isRegisteringUrl}
                        onClick={handleRegisterUrl}
                        className="px-4 py-1.5 bg-stone-800 hover:bg-stone-900 text-white rounded-lg text-xs font-semibold disabled:opacity-40 transition cursor-pointer"
                      >
                        {isRegisteringUrl ? 'Applying...' : 'Apply URL'}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* TAB 4: Video Link & Preview */}
          {activeTab === 'video' && (
            <div className="space-y-4">
              <div>
                <label className="block font-semibold text-stone-700 mb-1">Product Video Link</label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={videoUrl}
                    onChange={e => setVideoUrl(e.target.value)}
                    placeholder="e.g. https://www.youtube.com/watch?v=... or https://vimeo.com/..."
                    className="flex-1 px-3 py-2 rounded-xl border border-stone-200 text-xs"
                  />
                  {videoUrl && (
                    <button
                      type="button"
                      onClick={() => setVideoUrl('')}
                      className="px-3 py-2 text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-xl text-xs font-semibold"
                    >
                      Clear Video
                    </button>
                  )}
                </div>
                <p className="text-[11px] text-stone-500 mt-1">
                  Supported formats: YouTube, Vimeo, or direct video URLs (.mp4, .webm). When provided, a dedicated video player will appear in the guest experience.
                </p>
              </div>

              {/* Video Live Preview */}
              <div>
                <div className="text-[11px] font-semibold text-stone-700 mb-1">Video Player Preview</div>
                <div className="relative aspect-video rounded-2xl overflow-hidden bg-stone-900 border border-stone-200 shadow-inner flex items-center justify-center">
                  {videoUrl ? (
                    getVideoPreviewEmbed(videoUrl) ? (
                      <iframe
                        src={getVideoPreviewEmbed(videoUrl)!}
                        title="Video Preview"
                        className="w-full h-full border-0"
                        allowFullScreen
                      />
                    ) : (
                      <video src={videoUrl} controls className="w-full h-full object-cover">
                        Your browser does not support HTML5 video.
                      </video>
                    )
                  ) : (
                    <div className="text-center text-stone-500">
                      <Play className="w-8 h-8 mx-auto mb-1 opacity-40" />
                      <span>Enter a valid video URL above to preview</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Footer Save & Actions */}
          <div className="pt-4 border-t border-stone-100 flex items-center justify-between">
            <div className="text-xs text-stone-500">
              {isEditing ? (
                <span>Revisions are automatically tracked in the audit trail.</span>
              ) : (
                <span>New products will be created in {isPublished ? 'PUBLISHED' : 'DRAFT'} mode.</span>
              )}
            </div>

            <div className="flex items-center space-x-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl border border-stone-200 hover:bg-stone-50 font-semibold text-stone-700 transition"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={isSaving}
                className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-semibold shadow-md shadow-amber-600/30 transition disabled:opacity-50 cursor-pointer"
              >
                {isSaving ? 'Saving Product...' : isEditing ? 'Save Changes' : 'Create Product'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
