import React, { useState, useEffect } from 'react';
import { useCoordinatorAuth } from '../../context/CoordinatorAuthContext.tsx';
import { api } from '../../services/api.ts';
import {
  Users,
  CalendarCheck,
  Package,
  Layers,
  FileText,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Plus,
  RefreshCw,
  LogOut,
  Image as ImageIcon,
  Upload,
  Lock,
  ExternalLink,
  Edit,
  Play,
  MessageSquare,
  Search,
  Filter,
  Eye,
  EyeOff,
  Video,
  ArrowUp,
  ArrowDown,
  Trash2,
  Star,
  Globe,
  GraduationCap,
  TrendingUp,
} from 'lucide-react';
import { AnalyticsDashboard } from './AnalyticsDashboard.tsx';
import { Lead, ReservationRequest, Product, KnowledgeSource, Package as PackageType, Category } from '../../types/index.ts';
import { ProductEditorModal } from './ProductEditorModal.tsx';
import { PackageEditorModal } from './PackageEditorModal.tsx';
import { ReservationDetailModal } from './ReservationDetailModal.tsx';
import { ErrorBoundary } from '../shared/ErrorBoundary.tsx';

interface CoordinatorPortalProps {
  onBackToExplorer: () => void;
  onOpenGuestDashboard: (token: string) => void;
}

export const CoordinatorPortal: React.FC<CoordinatorPortalProps> = ({
  onBackToExplorer,
  onOpenGuestDashboard,
}) => {
  const { staffUser, isAuthenticated, loading, login, logout, error } = useCoordinatorAuth();

  // Login form state - Strictly no prefilled or default credentials
  const [emailInput, setEmailInput] = useState<string>('');
  const [passwordInput, setPasswordInput] = useState<string>('');
  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false);

  // Active workbench tab
  const [activeTab, setActiveTab] = useState<
    'leads' | 'reservations' | 'analytics' | 'products' | 'media' | 'sources' | 'security' | 'staff'
  >('reservations');

  // Operational data
  const [leads, setLeads] = useState<Lead[]>([]);
  const [reservations, setReservations] = useState<ReservationRequest[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [packages, setPackages] = useState<PackageType[]>([]);
  const [operators, setOperators] = useState<any[]>([]);
  const [properties, setProperties] = useState<any[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [sources, setSources] = useState<KnowledgeSource[]>([]);
  const [staffUsers, setStaffUsers] = useState<any[]>([]);
  const [r2Report, setR2Report] = useState<any>(null);
  const [runningR2, setRunningR2] = useState<boolean>(false);
  const [loadingData, setLoadingData] = useState<boolean>(false);

  // Catalogue Management Modals & Filters
  const [isProductModalOpen, setIsProductModalOpen] = useState<boolean>(false);
  const [isPackageModalOpen, setIsPackageModalOpen] = useState<boolean>(false);
  const [productToEdit, setProductToEdit] = useState<Product | null>(null);
  const [packageToEdit, setPackageToEdit] = useState<PackageType | null>(null);
  const [catalogFilter, setCatalogFilter] = useState<
    'all' | 'accommodation' | 'activity' | 'package' | 'published' | 'draft'
  >('all');
  const [catalogSearch, setCatalogSearch] = useState<string>('');

  // Editing modals & states for reservations
  const [selectedRes, setSelectedRes] = useState<ReservationRequest | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState<boolean>(false);
  const [newStatus, setNewStatus] = useState<string>('REVIEWED');
  const [internalNote, setInternalNote] = useState<string>('');
  const [portalNotice, setPortalNotice] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const notify = (text: string, type: 'success' | 'error' = 'success') => {
    setPortalNotice({ text, type });
    setTimeout(() => setPortalNotice(null), 5000);
  };

  // Admin deletion state
  const [deletingReservationId, setDeletingReservationId] = useState<string | null>(null);

  const handleDeleteReservation = async (reservation: ReservationRequest) => {
    if (!reservation) return;
    const confirmed = window.confirm(
      `Permanently delete reservation ${reservation.referenceNumber}? This action is irreversible.`
    );
    if (!confirmed) return;

    try {
      setDeletingReservationId(reservation.id);
      await api.deleteReservation(reservation.id);
      notify(`Reservation ${reservation.referenceNumber} deleted`, 'success');
      await loadAllData();
      if (selectedRes?.id === reservation.id) {
        setSelectedRes(null);
        setIsDetailModalOpen(false);
      }
    } catch (err: any) {
      notify(err?.message || 'Failed to delete reservation', 'error');
    } finally {
      setDeletingReservationId(null);
    }
  };

  // Media state
  const [selectedProductForMedia, setSelectedProductForMedia] = useState<string>('');
  const [productMediaList, setProductMediaList] = useState<any[]>([]);
  const [newMediaUrl, setNewMediaUrl] = useState<string>('');
  const [newMediaCaption, setNewMediaCaption] = useState<string>('');
  const [newMediaAlt, setNewMediaAlt] = useState<string>('');
  const [isPrimaryUpload, setIsPrimaryUpload] = useState<boolean>(true);
  const [mediaUploadFile, setMediaUploadFile] = useState<File | null>(null);
  const [mediaUploadPreview, setMediaUploadPreview] = useState<string | null>(null);
  const [isUploadingMediaFile, setIsUploadingMediaFile] = useState<boolean>(false);

  const loadAllData = async () => {
    if (!isAuthenticated) return;
    setLoadingData(true);
    try {
      const [leadsRes, resRes, prodRes, pkgRes, opsRes, propsRes, catsRes, srcRes] = await Promise.all([
        api.getLeads(),
        api.getReservations(),
        api.getCoordinatorProducts(),
        api.getCoordinatorPackages(),
        api.getOperators(),
        api.getProperties(),
        api.getCategories(),
        api.getKnowledgeSources(),
      ]);
      setLeads(leadsRes);
      setReservations(resRes);
      setProducts(prodRes);
      setPackages(pkgRes);
      setOperators(opsRes);
      setProperties(propsRes);
      setCategories(catsRes);
      setSources(srcRes);
      if (staffUser?.role === 'admin') {
        try {
          const usersRes = await api.getStaffUsers();
          setStaffUsers(usersRes);
        } catch (_) {}
      }
      if (prodRes.length > 0 && !selectedProductForMedia) {
        setSelectedProductForMedia(prodRes[0].id);
      }
    } catch (e) {
      console.error('Coordinator data fetch error:', e);
    } finally {
      setLoadingData(false);
    }
  };

  const handleToggleStaffActive = async (userId: string) => {
    try {
      const res = await api.toggleStaffActive(userId);
      setStaffUsers(prev => prev.map(u => (u.id === userId ? { ...u, isActive: res.isActive } : u)));
    } catch (e: any) {
      alert('Failed to update staff user status: ' + e.message);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      loadAllData();
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (selectedProductForMedia && selectedProductForMedia.trim() !== '') {
      api.getProductMedia(selectedProductForMedia).then(setProductMediaList).catch(() => setProductMediaList([]));
    } else {
      setProductMediaList([]);
    }
  }, [selectedProductForMedia]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    try {
      await login(emailInput, passwordInput);
    } catch (e) {
      // Handled by context
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleUpdateStatus = async () => {
    if (!selectedRes) return;
    try {
      await api.updateReservationStatus(selectedRes.id, newStatus, internalNote);
      alert(`Reservation status updated to ${newStatus}`);
      setSelectedRes(null);
      setInternalNote('');
      await loadAllData();
    } catch (e: any) {
      alert('Error updating status: ' + e.message);
    }
  };

  const handleTogglePublishProduct = async (id: string, currentStatus: boolean) => {
    try {
      await api.toggleProductPublish(id, !currentStatus);
      await loadAllData();
    } catch (e: any) {
      alert('Failed to update publication state: ' + e.message);
    }
  };

  const handleTogglePublishPackage = async (id: string, currentStatus: boolean) => {
    try {
      await api.updatePackage(id, { isPublished: !currentStatus });
      await loadAllData();
    } catch (e: any) {
      alert('Failed to update package publication state: ' + e.message);
    }
  };

  const handleSetPrimaryMedia = async (mediaId: string) => {
    try {
      await api.setPrimaryMedia(mediaId);
      if (selectedProductForMedia) {
        const updated = await api.getProductMedia(selectedProductForMedia);
        setProductMediaList(updated);
      }
      const prodRes = await api.getCoordinatorProducts();
      setProducts(prodRes);
      alert('Primary thumbnail updated! Live guest product views immediately reflect this image.');
    } catch (e: any) {
      alert('Failed to set primary media: ' + e.message);
    }
  };

  const handleUploadLocalMediaFile = async () => {
    if (!mediaUploadFile || !selectedProductForMedia) return;
    setIsUploadingMediaFile(true);
    try {
      const formData = new FormData();
      formData.append('file', mediaUploadFile);
      formData.append('ownerType', 'product');
      formData.append('ownerId', selectedProductForMedia);
      formData.append('caption', newMediaCaption.trim());
      formData.append('altText', newMediaAlt.trim() || newMediaCaption.trim());
      formData.append('isPrimary', isPrimaryUpload ? 'true' : 'false');
      formData.append('displayOrder', String(productMediaList.length));

      await api.uploadMedia(formData);
      alert('Media asset uploaded and linked to product successfully!');
      setMediaUploadFile(null);
      setMediaUploadPreview(null);
      setNewMediaCaption('');
      setNewMediaAlt('');

      const updated = await api.getProductMedia(selectedProductForMedia);
      setProductMediaList(updated);
      const prodRes = await api.getCoordinatorProducts();
      setProducts(prodRes);
    } catch (e: any) {
      alert('Media upload failed: ' + e.message);
    } finally {
      setIsUploadingMediaFile(false);
    }
  };

  const handleDeleteProductMedia = async (mediaId: string) => {
    if (!confirm('Are you sure you want to delete this media asset?')) return;
    try {
      await api.deleteMedia(mediaId);
      if (selectedProductForMedia) {
        const updated = await api.getProductMedia(selectedProductForMedia);
        setProductMediaList(updated);
      }
      const prodRes = await api.getCoordinatorProducts();
      setProducts(prodRes);
    } catch (e: any) {
      alert('Failed to delete media: ' + e.message);
    }
  };

  const handleMoveMediaOrder = async (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= productMediaList.length) return;

    const updated = [...productMediaList];
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;

    setProductMediaList(updated);
    try {
      await api.reorderMedia(updated.map((m, idx) => ({ id: m.id, displayOrder: idx })));
    } catch (e) {
      console.error('Failed to reorder media:', e);
    }
  };

  const handleRegisterExternalMedia = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMediaUrl.trim() || !selectedProductForMedia) return;
    try {
      const formData = new FormData();
      formData.append('ownerType', 'product');
      formData.append('ownerId', selectedProductForMedia);
      formData.append('externalUrl', newMediaUrl.trim());
      formData.append('caption', newMediaCaption);
      formData.append('altText', newMediaAlt || newMediaCaption);
      formData.append('isPrimary', isPrimaryUpload ? 'true' : 'false');
      formData.append('displayOrder', String(productMediaList.length));

      await api.uploadMedia(formData);
      alert('Media asset successfully registered and linked to product!');
      setNewMediaUrl('');
      setNewMediaCaption('');
      setNewMediaAlt('');
      const updated = await api.getProductMedia(selectedProductForMedia);
      setProductMediaList(updated);
      const prodRes = await api.getCoordinatorProducts();
      setProducts(prodRes);
    } catch (e: any) {
      alert('Media upload failed: ' + e.message);
    }
  };

  const runSecurityTests = async () => {
    setRunningR2(true);
    try {
      const rep = await api.runR2SecurityTests();
      setR2Report(rep);
    } catch (e: any) {
      alert('Failed to run R2 tests: ' + e.message);
    } finally {
      setRunningR2(false);
    }
  };

  // If not authenticated, show Coordinator Login screen
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#FAF8F5] flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-3xl border border-stone-200 shadow-xl max-w-md w-full">
          <div className="flex items-center space-x-3 mb-6">
            <div className="p-3 rounded-2xl bg-amber-600 text-white shadow-md">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-stone-900 font-display">
                Reservations Desk Login
              </h2>
              <p className="text-xs text-stone-500">Syntuc Victoria Falls Staff Portal</p>
            </div>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl font-medium">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Authorized Staff Email
              </label>
              <input
                type="email"
                required
                value={emailInput}
                onChange={e => setEmailInput(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-stone-200 focus:outline-hidden focus:ring-2 focus:ring-amber-500/20"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">Password</label>
              <input
                type="password"
                required
                value={passwordInput}
                onChange={e => setPasswordInput(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-stone-200 focus:outline-hidden focus:ring-2 focus:ring-amber-500/20"
              />
              <span className="text-[10px] text-stone-400 mt-1 block">
                Security notice: Mock/bypass tokens are strictly rejected.
              </span>
            </div>

            <button
              type="submit"
              disabled={isLoggingIn}
              className="w-full py-3 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:bg-stone-300 text-white font-semibold text-xs shadow-md shadow-amber-600/20 transition cursor-pointer"
            >
              {isLoggingIn ? 'Authenticating...' : 'Sign In to Workbench'}
            </button>

            <button
              type="button"
              onClick={onBackToExplorer}
              className="w-full py-2.5 text-xs text-stone-500 hover:text-stone-800 font-medium transition"
            >
              Return to Guest Explorer
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF8F5]">
      {/* Top Coordinator Banner */}
      <div className="bg-stone-900 text-white border-b border-stone-800 px-4 sm:px-8 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <span className="font-display font-bold text-amber-400 text-lg">Syntuc Desk</span>
          <span className="text-xs text-stone-400">|</span>
          <span className="text-xs text-stone-300 font-medium">
            Coordinator: <b className="text-white">{staffUser?.name}</b> ({staffUser?.role})
          </span>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={loadAllData}
            className="p-1.5 text-stone-400 hover:text-white rounded-lg transition"
            title="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 ${loadingData ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={logout}
            className="text-xs text-rose-400 hover:text-rose-300 flex items-center font-medium transition cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5 mr-1" /> Logout
          </button>
        </div>
      </div>

      {/* Main Workbench Navigation Tabs */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex items-center space-x-2 border-b border-stone-200 pb-3 overflow-x-auto text-xs font-semibold">
          <button
            onClick={() => setActiveTab('reservations')}
            className={`px-4 py-2 rounded-xl transition ${
              activeTab === 'reservations'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-stone-600 hover:bg-stone-100'
            }`}
          >
            Reservation Requests ({reservations.length})
          </button>
          <button
            onClick={() => setActiveTab('analytics')}
            className={`px-4 py-2 rounded-xl transition flex items-center space-x-1.5 ${
              activeTab === 'analytics'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-stone-600 hover:bg-stone-100'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Attribution & Analytics</span>
          </button>
          <button
            onClick={() => setActiveTab('leads')}
            className={`px-4 py-2 rounded-xl transition ${
              activeTab === 'leads'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-stone-600 hover:bg-stone-100'
            }`}
          >
            Leads & Touch History ({leads.length})
          </button>
          <button
            onClick={() => setActiveTab('products')}
            className={`px-4 py-2 rounded-xl transition ${
              activeTab === 'products'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-stone-600 hover:bg-stone-100'
            }`}
          >
            Catalog Governance ({products.length})
          </button>
          <button
            onClick={() => setActiveTab('media')}
            className={`px-4 py-2 rounded-xl transition ${
              activeTab === 'media'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-stone-600 hover:bg-stone-100'
            }`}
          >
            Media Management
          </button>
          <button
            onClick={() => setActiveTab('sources')}
            className={`px-4 py-2 rounded-xl transition ${
              activeTab === 'sources'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-stone-600 hover:bg-stone-100'
            }`}
          >
            Knowledge Sources ({sources.length})
          </button>
          <button
            onClick={() => {
              setActiveTab('security');
              if (!r2Report) runSecurityTests();
            }}
            className={`px-4 py-2 rounded-xl transition flex items-center ${
              activeTab === 'security'
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'text-emerald-800 bg-emerald-50 hover:bg-emerald-100'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5 mr-1" />
            R2 Security Suite Audit
          </button>
          {staffUser?.role === 'admin' && (
            <button
              onClick={() => setActiveTab('staff')}
              className={`px-4 py-2 rounded-xl transition flex items-center ${
                activeTab === 'staff'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'text-stone-600 hover:bg-stone-100'
              }`}
            >
              <Users className="w-3.5 h-3.5 mr-1" />
              Staff Accounts ({staffUsers.length})
            </button>
          )}
        </div>

        {/* Tab: Analytics */}
        {activeTab === 'analytics' && (
          <div className="mt-6">
            <AnalyticsDashboard />
          </div>
        )}

        {/* Tab 1: Reservations */}
        {activeTab === 'reservations' && (
          <div className="mt-6 space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-stone-500">
              Active Reservation Requests
            </h3>

            <div className="bg-white rounded-3xl border border-stone-200 overflow-hidden shadow-xs divide-y divide-stone-100">
              {reservations.length === 0 ? (
                <div className="p-12 text-center text-xs text-stone-400">No reservations submitted yet.</div>
              ) : (
                reservations.map(res => (
                  <div
                    key={res.id}
                    className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-stone-50/60 transition"
                  >
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-mono text-xs font-bold text-stone-900 bg-stone-100 px-2 py-0.5 rounded border border-stone-200">
                          {res.referenceNumber}
                        </span>
                        {res.requestType === 'SCHOOL_DELEGATION' ? (
                          <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-purple-100 text-purple-900 border border-purple-200 flex items-center">
                            <GraduationCap className="w-3 h-3 mr-1" />
                            School Delegation
                          </span>
                        ) : (
                          <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-stone-100 text-stone-600 border border-stone-200">
                            Standard
                          </span>
                        )}
                        <span
                          className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                            res.status === 'CONFIRMED'
                              ? 'bg-emerald-100 text-emerald-800'
                              : res.status === 'PARTNER_CONTACTED'
                              ? 'bg-sky-100 text-sky-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {res.status}
                        </span>
                        {res.isBridgeIncentiveApplied && (
                          <span className="text-[10px] bg-emerald-50 text-emerald-700 font-bold px-2 py-0.5 rounded border border-emerald-200">
                            Bridge $0 Applied
                          </span>
                        )}
                      </div>

                      <div className="mt-2 text-sm font-bold text-stone-900">
                        {res.requestType === 'SCHOOL_DELEGATION' && res.schoolMetadata?.schoolName ? (
                          <span>{res.schoolMetadata.schoolName} • </span>
                        ) : null}
                        {res.guest?.fullName} •{' '}
                        <span className="text-xs font-normal text-stone-500">{res.guest?.email}</span>
                      </div>

                      <div className="mt-1 text-xs text-stone-500 flex flex-wrap gap-x-4">
                        <span>Dates: {res.startDate || 'TBD'} to {res.endDate || 'TBD'}</span>
                        {res.requestType === 'SCHOOL_DELEGATION' ? (
                          <>
                            <span>Students: {res.schoolMetadata?.studentCount || res.childrenCount}</span>
                            <span>Teachers: {res.schoolMetadata?.teacherCount || res.adultsCount}</span>
                            <span>Accommodation: {res.schoolMetadata?.accommodationTier || 'budget'}</span>
                          </>
                        ) : (
                          <span>Party: {res.adultsCount} Adults, {res.childrenCount} Children</span>
                        )}
                        <span>Items: {res.items?.length || res.schoolMetadata?.lineItems?.length || 0}</span>
                      </div>

                      {/* Marketing Attribution Origin Snapshot */}
                      {((res as any).firstTouchSource || (res as any).lastTouchSource) && (
                        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]">
                          <span className="font-bold text-stone-500 uppercase text-[9px] tracking-wider">Marketing Origin:</span>
                          <span className="bg-amber-50 text-amber-900 border border-amber-200/80 px-2 py-0.5 rounded-md font-medium flex items-center space-x-1">
                            <span className="text-[10px] text-amber-700">First:</span>
                            <strong className="capitalize">{(res as any).firstTouchSource || 'direct'}</strong>
                            {(res as any).firstTouchCampaign && (
                              <span className="text-stone-600 font-mono text-[10px]">({(res as any).firstTouchCampaign})</span>
                            )}
                            {(res as any).firstTouchContent && (
                              <span className="text-amber-800 font-mono text-[10px] font-bold">[Ad: {(res as any).firstTouchContent}]</span>
                            )}
                          </span>
                          {((res as any).lastTouchSource && (res as any).lastTouchSource !== (res as any).firstTouchSource) && (
                            <span className="bg-stone-100 text-stone-800 border border-stone-200 px-2 py-0.5 rounded-md font-medium flex items-center space-x-1">
                              <span className="text-[10px] text-stone-500">Last:</span>
                              <strong className="capitalize">{(res as any).lastTouchSource}</strong>
                              {(res as any).lastTouchCampaign && (
                                <span className="text-stone-600 font-mono text-[10px]">({(res as any).lastTouchCampaign})</span>
                              )}
                              {(res as any).lastTouchContent && (
                                <span className="text-stone-800 font-mono text-[10px] font-bold">[Ad: {(res as any).lastTouchContent}]</span>
                              )}
                            </span>
                          )}
                          <span className="text-[9px] font-mono text-stone-500 bg-stone-100 px-1.5 py-0.5 rounded">
                            {(res as any).attributionConfidence || 'DIRECT'}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col md:items-end gap-2 shrink-0">
                      <div className="text-lg font-extrabold text-amber-800 font-display">
                        US${res.authoritativeTotal}
                      </div>

                      <div className="flex items-center space-x-2">
                        {res.guestToken && (
                          <button
                            type="button"
                            onClick={() => onOpenGuestDashboard(res.guestToken!)}
                            className="px-2.5 py-1 text-xs font-medium text-stone-600 hover:text-stone-900 bg-stone-100 hover:bg-stone-200 rounded-lg transition flex items-center cursor-pointer"
                            title="Open guest-facing tracking view"
                          >
                            <ExternalLink className="w-3 h-3 mr-1 text-stone-500" />
                            <span>Guest Link</span>
                          </button>
                        )}

                        {staffUser?.role === 'admin' && (
                          <button
                            type="button"
                            onClick={() => handleDeleteReservation(res)}
                            disabled={deletingReservationId === res.id}
                            className="px-3 py-1 text-xs font-semibold bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg transition cursor-pointer border border-rose-200"
                            title="Delete reservation (admin only)"
                          >
                            {deletingReservationId === res.id ? 'Deleting...' : 'Delete'}
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => {
                            setSelectedRes(res);
                            setIsDetailModalOpen(true);
                          }}
                          className="px-3.5 py-1 text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition cursor-pointer flex items-center shadow-xs"
                        >
                          <span>View Details</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Tab 2: Leads */}
        {activeTab === 'leads' && (
          <div className="mt-6 space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-stone-500">
              Commercial Leads & First Touch / Last Touch Tracking
            </h3>

            <div className="bg-white rounded-3xl border border-stone-200 overflow-hidden shadow-xs">
              <table className="w-full text-left text-xs">
                <thead className="bg-stone-50 border-b border-stone-200 text-stone-500 uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="p-4">Traveler</th>
                    <th className="p-4">Contact</th>
                    <th className="p-4">First Touch</th>
                    <th className="p-4">Last Touch</th>
                    <th className="p-4">Est. Value</th>
                    <th className="p-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {leads.map(lead => (
                    <tr key={lead.id} className="hover:bg-stone-50/50">
                      <td className="p-4 font-bold text-stone-900">{lead.guest?.fullName || 'Anonymous Guest'}</td>
                      <td className="p-4 text-stone-600">{lead.guest?.email}</td>
                      <td className="p-4 text-stone-500">
                        {new Date(lead.firstTouchTimestamp).toLocaleDateString()}
                      </td>
                      <td className="p-4 text-stone-500">
                        {new Date(lead.lastTouchTimestamp).toLocaleString()}
                      </td>
                      <td className="p-4 font-bold text-amber-800 font-display">US${lead.estimatedValue}</td>
                      <td className="p-4">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                          {lead.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 3: Catalog Governance & Management */}
        {activeTab === 'products' && (
          <div className="mt-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-stone-500">
                  Authoritative Catalogue Management
                </h3>
                <p className="text-xs text-stone-500 mt-0.5">
                  Maintain live verified inventory, accommodations, activities, curated packages, pricing, and video links.
                </p>
              </div>

              {/* Action buttons */}
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => {
                    setPackageToEdit(null);
                    setIsPackageModalOpen(true);
                  }}
                  className="px-3.5 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 font-semibold text-xs transition flex items-center cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 mr-1 text-amber-700" />
                  <span>New Package</span>
                </button>

                <button
                  onClick={() => {
                    setProductToEdit(null);
                    setIsProductModalOpen(true);
                  }}
                  className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs shadow-md shadow-amber-600/30 transition flex items-center cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  <span>Create Product</span>
                </button>
              </div>
            </div>

            {/* Filter pills & Search bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-white rounded-2xl border border-stone-200 shadow-xs">
              <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 sm:pb-0 text-xs font-semibold">
                <button
                  onClick={() => setCatalogFilter('all')}
                  className={`px-3 py-1.5 rounded-lg transition ${
                    catalogFilter === 'all'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'text-stone-600 hover:bg-stone-100'
                  }`}
                >
                  All ({products.length + packages.length})
                </button>
                <button
                  onClick={() => setCatalogFilter('accommodation')}
                  className={`px-3 py-1.5 rounded-lg transition ${
                    catalogFilter === 'accommodation'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'text-stone-600 hover:bg-stone-100'
                  }`}
                >
                  Accommodations ({products.filter(p => p.productType === 'accommodation').length})
                </button>

                {/* ... rest of file unchanged ... */}
              </div>
            </div>
          </div>
        )}

        {/* other tabs and modals rendered below (omitted for brevity; unchanged) */}
      </div>

      {/* Full Internal Reservation Detail View & Lifecycle Modal */}
      <ReservationDetailModal
        reservation={selectedRes}
        isOpen={isDetailModalOpen}
        onClose={() => {
          setIsDetailModalOpen(false);
          setSelectedRes(null);
        }}
        onStatusUpdated={(updatedRes) => {
          setReservations(prev =>
            prev.map(r => (r.id === updatedRes.id ? { ...r, ...updatedRes } : r))
          );
          setSelectedRes(updatedRes);
          notify(`Reservation #${updatedRes.referenceNumber} status updated to ${updatedRes.status}`);
        }}
        onOpenGuestDashboard={onOpenGuestDashboard}
      />

      {/* Product Creation & Editing Modal */}
      <ProductEditorModal
        isOpen={isProductModalOpen}
        product={productToEdit}
        onClose={() => {
          setIsProductModalOpen(false);
          setProductToEdit(null);
        }}
        onSaved={async () => {
          setIsProductModalOpen(false);
          setProductToEdit(null);
          await loadAllData();
        }}
        operators={operators}
        properties={properties}
        categories={categories}
      />

      {/* Package Creation & Editing Modal */}
      <PackageEditorModal
        isOpen={isPackageModalOpen}
        pkg={packageToEdit}
        onClose={() => {
          setIsPackageModalOpen(false);
          setPackageToEdit(null);
        }}
        onSaved={async () => {
          setIsPackageModalOpen(false);
          setPackageToEdit(null);
          await loadAllData();
        }}
      />
    </div>
  );
};
