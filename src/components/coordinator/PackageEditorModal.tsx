import React, { useState, useEffect } from 'react';
import { api } from '../../services/api.ts';
import { Package } from '../../types/index.ts';
import { X, CheckCircle2, AlertCircle, Play, Globe } from 'lucide-react';

interface PackageEditorModalProps {
  pkg: Package | null;
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export const PackageEditorModal: React.FC<PackageEditorModalProps> = ({
  pkg,
  isOpen,
  onClose,
  onSaved,
}) => {
  const isEditing = Boolean(pkg && pkg.id);

  const [name, setName] = useState<string>('');
  const [tagline, setTagline] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [durationDays, setDurationDays] = useState<number>(3);
  const [durationNights, setDurationNights] = useState<number>(2);
  const [pricePerPerson, setPricePerPerson] = useState<string>('350');
  const [currency, setCurrency] = useState<string>('USD');
  const [primaryImageUrl, setPrimaryImageUrl] = useState<string>('');
  const [videoUrl, setVideoUrl] = useState<string>('');
  const [highlightsText, setHighlightsText] = useState<string>('');
  const [inclusionsText, setInclusionsText] = useState<string>('');
  const [exclusionsText, setExclusionsText] = useState<string>('');
  const [isPublished, setIsPublished] = useState<boolean>(true);

  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (pkg) {
      setName(pkg.name || '');
      setTagline(pkg.tagline || '');
      setDescription(pkg.description || '');
      setDurationDays(pkg.durationDays || 3);
      setDurationNights(pkg.durationNights || 2);
      setPricePerPerson(pkg.pricePerPerson || '350');
      setCurrency(pkg.currency || 'USD');
      setPrimaryImageUrl(pkg.primaryImageUrl || '');
      setVideoUrl(pkg.videoUrl || '');
      setHighlightsText((pkg.highlights || []).join('\n'));
      setInclusionsText((pkg.inclusions || []).join('\n'));
      setExclusionsText((pkg.exclusions || []).join('\n'));
      setIsPublished(pkg.isPublished !== undefined ? Boolean(pkg.isPublished) : true);
    } else {
      setName('');
      setTagline('');
      setDescription('');
      setDurationDays(3);
      setDurationNights(2);
      setPricePerPerson('420.00');
      setCurrency('USD');
      setPrimaryImageUrl('https://images.unsplash.com/photo-1516426122078-c23e76319801?auto=format&fit=crop&w=1200&q=80');
      setVideoUrl('');
      setHighlightsText('Guided Victoria Falls Tour\nZambezi Sunset Cruise\nScenic Helicopter Flight');
      setInclusionsText('All park conservation fees\n2 nights verified accommodation\nDaily breakfast & transfers');
      setExclusionsText('International flights\nGratuities');
      setIsPublished(true);
    }
    setStatusMessage(null);
  }, [pkg, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !pricePerPerson || !primaryImageUrl.trim()) {
      setStatusMessage({ type: 'error', text: 'Please fill all required fields.' });
      return;
    }

    setIsSaving(true);
    setStatusMessage(null);

    const highlights = highlightsText.split('\n').map(s => s.trim()).filter(Boolean);
    const inclusions = inclusionsText.split('\n').map(s => s.trim()).filter(Boolean);
    const exclusions = exclusionsText.split('\n').map(s => s.trim()).filter(Boolean);

    const payload = {
      name: name.trim(),
      tagline: tagline.trim() || `${durationNights} Nights / ${durationDays} Days in Victoria Falls`,
      description: description.trim() || name.trim(),
      durationDays: Number(durationDays),
      durationNights: Number(durationNights),
      pricePerPerson: String(Number(pricePerPerson)),
      currency,
      highlights,
      inclusions,
      exclusions,
      primaryImageUrl: primaryImageUrl.trim(),
      videoUrl: videoUrl.trim() || null,
      isPublished,
    };

    try {
      if (isEditing && pkg) {
        await api.updatePackage(pkg.id, payload);
        setStatusMessage({ type: 'success', text: 'Package updated successfully!' });
      } else {
        await api.createPackage(payload);
        setStatusMessage({ type: 'success', text: 'Package created successfully!' });
      }
      onSaved();
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Failed to save package' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-fadeIn"
    >
      <div className="bg-white rounded-3xl max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-stone-200 flex flex-col">
        <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-md px-6 py-4 border-b border-stone-100 flex items-center justify-between">
          <h2 className="text-lg font-bold text-stone-900 font-display">
            {isEditing ? `Edit Package: ${pkg?.name}` : 'Create Curated Package'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-full text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {statusMessage && (
          <div
            className={`mx-6 mt-4 p-3 rounded-xl text-xs flex items-center justify-between ${
              statusMessage.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : 'bg-rose-50 text-rose-800 border border-rose-200'
            }`}
          >
            <span>{statusMessage.text}</span>
            <button onClick={() => setStatusMessage(null)}>
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-stone-700 mb-1">Package Name *</label>
              <input
                type="text"
                required
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Victoria Falls Classic 3-Day Safari"
                className="w-full px-3 py-2 rounded-xl border border-stone-200 text-xs"
              />
            </div>

            <div>
              <label className="block font-semibold text-stone-700 mb-1">Tagline</label>
              <input
                type="text"
                value={tagline}
                onChange={e => setTagline(e.target.value)}
                placeholder="e.g. The definitive introductory journey"
                className="w-full px-3 py-2 rounded-xl border border-stone-200 text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block font-semibold text-stone-700 mb-1">Duration Days *</label>
              <input
                type="number"
                min={1}
                value={durationDays}
                onChange={e => setDurationDays(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl border border-stone-200 text-xs"
              />
            </div>

            <div>
              <label className="block font-semibold text-stone-700 mb-1">Duration Nights *</label>
              <input
                type="number"
                min={0}
                value={durationNights}
                onChange={e => setDurationNights(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl border border-stone-200 text-xs"
              />
            </div>

            <div>
              <label className="block font-semibold text-stone-700 mb-1">Price Per Person (USD) *</label>
              <input
                type="number"
                step="0.01"
                required
                value={pricePerPerson}
                onChange={e => setPricePerPerson(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-stone-200 text-xs font-bold"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-stone-700 mb-1">Description *</label>
            <textarea
              rows={3}
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-stone-200 text-xs"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-stone-700 mb-1">Primary Image URL *</label>
              <input
                type="url"
                required
                value={primaryImageUrl}
                onChange={e => setPrimaryImageUrl(e.target.value)}
                placeholder="https://images.unsplash.com/..."
                className="w-full px-3 py-2 rounded-xl border border-stone-200 text-xs"
              />
              {primaryImageUrl && (
                <div className="mt-2 h-28 rounded-xl overflow-hidden bg-stone-100 border border-stone-200">
                  <img src={primaryImageUrl} alt="Preview" className="w-full h-full object-cover" />
                </div>
              )}
            </div>

            <div>
              <label className="block font-semibold text-stone-700 mb-1">Featured Video Link (Optional)</label>
              <input
                type="url"
                value={videoUrl}
                onChange={e => setVideoUrl(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=..."
                className="w-full px-3 py-2 rounded-xl border border-stone-200 text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block font-semibold text-stone-700 mb-1">Highlights (One per line)</label>
              <textarea
                rows={3}
                value={highlightsText}
                onChange={e => setHighlightsText(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-stone-200 text-xs"
              />
            </div>

            <div>
              <label className="block font-semibold text-emerald-800 mb-1">Inclusions (One per line)</label>
              <textarea
                rows={3}
                value={inclusionsText}
                onChange={e => setInclusionsText(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-stone-200 text-xs"
              />
            </div>

            <div>
              <label className="block font-semibold text-rose-800 mb-1">Exclusions (One per line)</label>
              <textarea
                rows={3}
                value={exclusionsText}
                onChange={e => setExclusionsText(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-stone-200 text-xs"
              />
            </div>
          </div>

          <div className="flex items-center space-x-2 pt-2">
            <input
              type="checkbox"
              id="pkgPublished"
              checked={isPublished}
              onChange={e => setIsPublished(e.target.checked)}
              className="rounded text-amber-600"
            />
            <label htmlFor="pkgPublished" className="font-semibold text-stone-800">
              Publish package immediately to guest catalog
            </label>
          </div>

          <div className="pt-4 border-t border-stone-100 flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-stone-200 text-stone-700 font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-semibold shadow-xs"
            >
              {isSaving ? 'Saving...' : isEditing ? 'Save Changes' : 'Create Package'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
