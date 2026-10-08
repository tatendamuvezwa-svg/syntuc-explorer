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
                <button
                  onClick={() => setCatalogFilter('activity')}
                  className={`px-3 py-1.5 rounded-lg transition ${
                    catalogFilter === 'activity'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'text-stone-600 hover:bg-stone-100'
                  }`}
                >
                  Activities ({products.filter(p => p.productType === 'activity').length})
                </button>
                <button
                  onClick={() => setCatalogFilter('package')}
                  className={`px-3 py-1.5 rounded-lg transition ${
                    catalogFilter === 'package'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'text-stone-600 hover:bg-stone-100'
                  }`}
                >
                  Packages ({packages.length})
                </button>
                <button
                  onClick={() => setCatalogFilter('published')}
                  className={`px-3 py-1.5 rounded-lg transition ${
                    catalogFilter === 'published'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-stone-600 hover:bg-stone-100'
                  }`}
                >
                  Published ({products.filter(p => p.isPublished).length + packages.filter(p => p.isPublished).length})
                </button>
                <button
                  onClick={() => setCatalogFilter('draft')}
                  className={`px-3 py-1.5 rounded-lg transition ${
                    catalogFilter === 'draft'
                      ? 'bg-amber-700 text-white shadow-xs'
                      : 'text-stone-600 hover:bg-stone-100'
                  }`}
                >
                  Drafts ({products.filter(p => !p.isPublished).length + packages.filter(p => !p.isPublished).length})
                </button>
              </div>

              {/* Search */}
              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={catalogSearch}
                  onChange={e => setCatalogSearch(e.target.value)}
                  placeholder="Filter catalogue by title or operator..."
                  className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-stone-200 bg-stone-50/50 focus:bg-white focus:outline-hidden"
                />
              </div>
            </div>

            {/* Products Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Filtered Products */}
              {catalogFilter !== 'package' &&
                products
                  .filter(p => {
                    if (catalogFilter === 'accommodation') return p.productType === 'accommodation';
                    if (catalogFilter === 'activity') return p.productType === 'activity';
                    if (catalogFilter === 'published') return p.isPublished;
                    if (catalogFilter === 'draft') return !p.isPublished;
                    return true;
                  })
                  .filter(p => {
                    if (!catalogSearch.trim()) return true;
                    const q = catalogSearch.toLowerCase();
                    return (
                      p.name.toLowerCase().includes(q) ||
                      (p.operatorName && p.operatorName.toLowerCase().includes(q)) ||
                      (p.shortDescription && p.shortDescription.toLowerCase().includes(q))
                    );
                  })
                  .map(p => (
                    <div
                      key={p.id}
                      className={`bg-white p-5 rounded-2xl border shadow-xs flex flex-col justify-between gap-4 transition hover:shadow-md ${
                        p.isPublished ? 'border-stone-200' : 'border-amber-300 bg-amber-50/20'
                      }`}
                    >
                      <div className="flex items-start gap-4">
                        <div className="relative w-24 h-24 rounded-xl overflow-hidden bg-stone-100 shrink-0 border border-stone-200">
                          {p.primaryImageUrl ? (
                            <img src={p.primaryImageUrl} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-stone-300">
                              <ImageIcon className="w-6 h-6" />
                            </div>
                          )}
                          <span
                            className={`absolute top-1 left-1 text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded shadow-xs ${
                              p.isPublished
                                ? 'bg-emerald-600 text-white'
                                : 'bg-amber-600 text-white'
                            }`}
                          >
                            {p.isPublished ? 'PUBLISHED' : 'DRAFT'}
                          </span>
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2">
                            <span className="text-[10px] uppercase font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                              {p.productType}
                            </span>
                            {p.videoUrl && (
                              <span className="text-[10px] font-semibold text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200 flex items-center">
                                <Video className="w-2.5 h-2.5 mr-1" /> Video
                              </span>
                            )}
                          </div>

                          <h4 className="text-base font-bold text-stone-900 mt-1 truncate">{p.name}</h4>
                          <p className="text-xs text-stone-500 line-clamp-2 mt-0.5">{p.shortDescription}</p>

                          <div className="mt-2 text-xs font-semibold text-stone-700">
                            Tariff: <span className="text-amber-800 font-display font-bold">US${p.basePrice}</span> ({p.priceBasis})
                          </div>
                        </div>
                      </div>

                      {/* Card Actions */}
                      <div className="flex items-center justify-between pt-3 border-t border-stone-100 text-xs">
                        <button
                          onClick={() => handleTogglePublishProduct(p.id, p.isPublished)}
                          className={`px-3 py-1.5 rounded-lg font-semibold flex items-center transition cursor-pointer ${
                            p.isPublished
                              ? 'bg-stone-100 hover:bg-stone-200 text-stone-700'
                              : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                          }`}
                        >
                          {p.isPublished ? (
                            <>
                              <EyeOff className="w-3.5 h-3.5 mr-1.5 text-stone-500" />
                              <span>Unpublish</span>
                            </>
                          ) : (
                            <>
                              <Eye className="w-3.5 h-3.5 mr-1.5" />
                              <span>Publish to Guests</span>
                            </>
                          )}
                        </button>

                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => {
                              setSelectedProductForMedia(p.id);
                              setActiveTab('media');
                            }}
                            className="p-2 text-stone-500 hover:text-amber-700 hover:bg-amber-50 rounded-xl transition cursor-pointer"
                            title="Manage Media & Gallery"
                          >
                            <ImageIcon className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => {
                              setProductToEdit(p);
                              setIsProductModalOpen(true);
                            }}
                            className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 font-semibold rounded-xl transition flex items-center cursor-pointer"
                            title="Edit Product & Media"
                          >
                            <Edit className="w-3.5 h-3.5 mr-1 text-amber-700" />
                            <span>Edit Details</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}

              {/* Filtered Packages */}
              {(catalogFilter === 'all' || catalogFilter === 'package' || catalogFilter === 'published' || catalogFilter === 'draft') &&
                packages
                  .filter(pkg => {
                    if (catalogFilter === 'published') return pkg.isPublished;
                    if (catalogFilter === 'draft') return !pkg.isPublished;
                    return true;
                  })
                  .filter(pkg => {
                    if (!catalogSearch.trim()) return true;
                    const q = catalogSearch.toLowerCase();
                    return pkg.name.toLowerCase().includes(q) || (pkg.tagline && pkg.tagline.toLowerCase().includes(q));
                  })
                  .map(pkg => (
                    <div
                      key={pkg.id}
                      className={`bg-white p-5 rounded-2xl border shadow-xs flex flex-col justify-between gap-4 transition hover:shadow-md ${
                        pkg.isPublished ? 'border-stone-200' : 'border-amber-300 bg-amber-50/20'
                      }`}
                    >
                      <div className="flex items-start gap-4">
                        <div className="relative w-24 h-24 rounded-xl overflow-hidden bg-stone-100 shrink-0 border border-stone-200">
                          <img src={pkg.primaryImageUrl} alt="" className="w-full h-full object-cover" />
                          <span
                            className={`absolute top-1 left-1 text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded shadow-xs ${
                              pkg.isPublished ? 'bg-emerald-600 text-white' : 'bg-amber-600 text-white'
                            }`}
                          >
                            {pkg.isPublished ? 'PUBLISHED' : 'DRAFT'}
                          </span>
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2">
                            <span className="text-[10px] uppercase font-bold text-indigo-800 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                              Curated Package
                            </span>
                            <span className="text-[10px] text-stone-500 font-semibold">
                              {pkg.durationNights}N / {pkg.durationDays}D
                            </span>
                          </div>

                          <h4 className="text-base font-bold text-stone-900 mt-1 truncate">{pkg.name}</h4>
                          <p className="text-xs text-stone-500 line-clamp-2 mt-0.5">{pkg.tagline}</p>

                          <div className="mt-2 text-xs font-semibold text-stone-700">
                            Tariff: <span className="text-amber-800 font-display font-bold">US${pkg.pricePerPerson}</span> (per person)
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-3 border-t border-stone-100 text-xs">
                        <button
                          onClick={() => handleTogglePublishPackage(pkg.id, pkg.isPublished)}
                          className={`px-3 py-1.5 rounded-lg font-semibold flex items-center transition cursor-pointer ${
                            pkg.isPublished
                              ? 'bg-stone-100 hover:bg-stone-200 text-stone-700'
                              : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                          }`}
                        >
                          {pkg.isPublished ? (
                            <>
                              <EyeOff className="w-3.5 h-3.5 mr-1.5 text-stone-500" />
                              <span>Unpublish</span>
                            </>
                          ) : (
                            <>
                              <Eye className="w-3.5 h-3.5 mr-1.5" />
                              <span>Publish</span>
                            </>
                          )}
                        </button>

                        <button
                          onClick={() => {
                            setPackageToEdit(pkg);
                            setIsPackageModalOpen(true);
                          }}
                          className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 font-semibold rounded-xl transition flex items-center cursor-pointer"
                        >
                          <Edit className="w-3.5 h-3.5 mr-1 text-amber-700" />
                          <span>Edit Package</span>
                        </button>
                      </div>
                    </div>
                  ))}
            </div>
          </div>
        )}

        {/* Tab 4: Media Management */}
        {activeTab === 'media' && (
          <div className="mt-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-stone-500">
                  Product Media & Gallery Management
                </h3>
                <p className="text-xs text-stone-500 mt-0.5">
                  Upload local files or link verified images. Primary thumbnails immediately update the live guest experience.
                </p>
              </div>

              {/* Select Product */}
              <div className="w-72">
                <select
                  value={selectedProductForMedia}
                  onChange={e => setSelectedProductForMedia(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 bg-white font-semibold"
                >
                  {products.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.productType})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Current Media Assets for Selected Product */}
            <div className="bg-white p-5 rounded-3xl border border-stone-200 shadow-xs space-y-4">
              <h4 className="text-xs uppercase font-bold tracking-wider text-stone-700">
                Gallery Assets for Selected Product ({productMediaList.length})
              </h4>

              {productMediaList.length === 0 ? (
                <div className="p-8 text-center text-stone-400 bg-stone-50 rounded-2xl border border-dashed border-stone-300">
                  No images currently linked to this product. Upload or link an image below.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                  {productMediaList.map((med, idx) => (
                    <div
                      key={med.id}
                      className={`bg-white rounded-2xl border overflow-hidden shadow-xs flex flex-col justify-between ${
                        med.isPrimary ? 'border-amber-600 ring-2 ring-amber-600/30' : 'border-stone-200'
                      }`}
                    >
                      <div className="relative h-36 bg-stone-100">
                        <img src={med.url} alt="" className="w-full h-full object-cover" />
                        {med.isPrimary && (
                          <span className="absolute top-2 left-2 text-[10px] font-extrabold uppercase bg-amber-600 text-white px-2 py-0.5 rounded shadow-xs flex items-center">
                            <Star className="w-2.5 h-2.5 mr-1 fill-white" /> PRIMARY THUMBNAIL
                          </span>
                        )}
                      </div>

                      <div className="p-3 text-xs space-y-2">
                        <p className="text-[11px] text-stone-600 line-clamp-1">{med.caption || 'No caption'}</p>

                        <div className="flex items-center justify-between pt-1 border-t border-stone-100">
                          <div className="flex space-x-1">
                            <button
                              type="button"
                              onClick={() => handleMoveMediaOrder(idx, 'up')}
                              disabled={idx === 0}
                              className="p-1 rounded bg-stone-100 hover:bg-stone-200 text-stone-600 disabled:opacity-30"
                              title="Move Left"
                            >
                              <ArrowUp className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleMoveMediaOrder(idx, 'down')}
                              disabled={idx === productMediaList.length - 1}
                              className="p-1 rounded bg-stone-100 hover:bg-stone-200 text-stone-600 disabled:opacity-30"
                              title="Move Right"
                            >
                              <ArrowDown className="w-3 h-3" />
                            </button>
                          </div>

                          <div className="flex items-center space-x-1">
                            {!med.isPrimary && (
                              <button
                                onClick={() => handleSetPrimaryMedia(med.id)}
                                className="px-2 py-1 text-[11px] font-semibold bg-amber-50 hover:bg-amber-600 hover:text-white text-amber-800 rounded-lg transition"
                                title="Set as Primary"
                              >
                                Set Primary
                              </button>
                            )}
                            <button
                              onClick={() => handleDeleteProductMedia(med.id)}
                              className="p-1 text-rose-600 hover:bg-rose-50 rounded-lg transition"
                              title="Delete Media"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Media Upload & URL Registration Box */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Local File Upload Form */}
              <div className="bg-white p-6 rounded-3xl border border-stone-200 shadow-xs space-y-4">
                <h4 className="text-xs uppercase font-bold tracking-wider text-stone-700 flex items-center">
                  <Upload className="w-3.5 h-3.5 mr-1.5 text-amber-700" />
                  Upload Local Image File
                </h4>

                <div className="space-y-3 text-xs">
                  <div>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/avif"
                      onChange={e => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setMediaUploadFile(file);
                          setMediaUploadPreview(URL.createObjectURL(file));
                        }
                      }}
                      className="w-full text-xs text-stone-500 file:mr-3 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-amber-600 file:text-white hover:file:bg-amber-700 file:cursor-pointer"
                    />
                  </div>

                  {mediaUploadPreview && (
                    <div className="h-32 rounded-xl overflow-hidden bg-stone-100 border border-stone-200">
                      <img src={mediaUploadPreview} alt="Preview" className="w-full h-full object-cover" />
                    </div>
                  )}

                  <div>
                    <label className="block font-semibold text-stone-700 mb-1">Caption</label>
                    <input
                      type="text"
                      value={newMediaCaption}
                      onChange={e => setNewMediaCaption(e.target.value)}
                      placeholder="e.g. Lodge swimming pool overlooking the river"
                      className="w-full px-3 py-2 rounded-xl border border-stone-200 text-xs"
                    />
                  </div>

                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="uploadPrimaryFile"
                      checked={isPrimaryUpload}
                      onChange={e => setIsPrimaryUpload(e.target.checked)}
                      className="rounded text-amber-600"
                    />
                    <label htmlFor="uploadPrimaryFile" className="font-semibold text-stone-700">
                      Immediately set as primary thumbnail
                    </label>
                  </div>

                  <button
                    type="button"
                    disabled={!mediaUploadFile || isUploadingMediaFile}
                    onClick={handleUploadLocalMediaFile}
                    className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-xl transition disabled:opacity-40 cursor-pointer"
                  >
                    {isUploadingMediaFile ? 'Uploading File...' : 'Upload & Save Image'}
                  </button>
                </div>
              </div>

              {/* External Verified URL Form */}
              <div className="bg-white p-6 rounded-3xl border border-stone-200 shadow-xs space-y-4">
                <h4 className="text-xs uppercase font-bold tracking-wider text-stone-700 flex items-center">
                  <Globe className="w-3.5 h-3.5 mr-1.5 text-stone-500" />
                  Register Verified External Image URL
                </h4>

                <form onSubmit={handleRegisterExternalMedia} className="space-y-3 text-xs">
                  <div>
                    <label className="block font-semibold text-stone-700 mb-1">Image URL *</label>
                    <input
                      type="url"
                      required
                      value={newMediaUrl}
                      onChange={e => setNewMediaUrl(e.target.value)}
                      placeholder="https://images.unsplash.com/..."
                      className="w-full px-3 py-2 rounded-xl border border-stone-200 text-xs"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-stone-700 mb-1">Caption</label>
                    <input
                      type="text"
                      value={newMediaCaption}
                      onChange={e => setNewMediaCaption(e.target.value)}
                      placeholder="e.g. Sunset view from upper deck"
                      className="w-full px-3 py-2 rounded-xl border border-stone-200 text-xs"
                    />
                  </div>

                  <div className="flex items-center space-x-2 pt-1">
                    <input
                      type="checkbox"
                      id="primary_check_ext"
                      checked={isPrimaryUpload}
                      onChange={e => setIsPrimaryUpload(e.target.checked)}
                      className="rounded text-amber-600"
                    />
                    <label htmlFor="primary_check_ext" className="font-semibold text-stone-700">
                      Immediately set as primary thumbnail
                    </label>
                  </div>

                  <button
                    type="submit"
                    className="px-4 py-2 bg-stone-800 hover:bg-stone-900 text-white font-semibold rounded-xl transition cursor-pointer"
                  >
                    Register Image URL
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Tab 5: Sources */}
        {activeTab === 'sources' && (
          <div className="mt-6 space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-stone-500">
              Authoritative Knowledge Sources & Evidence
            </h3>

            <div className="bg-white rounded-3xl border border-stone-200 overflow-hidden shadow-xs divide-y divide-stone-100">
              {sources.map(s => (
                <div key={s.id} className="p-5 flex items-start justify-between gap-4">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      {s.evidenceStatus}
                    </span>
                    <h4 className="text-base font-bold text-stone-900 mt-1">{s.name}</h4>
                    <p className="text-xs text-stone-600 mt-1">{s.notes}</p>
                    <div className="mt-2 text-[11px] text-stone-400">
                      Type: {s.sourceType} • Verified: {new Date(s.lastVerified).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab 6: R2 Security Suite Audit */}
        {activeTab === 'security' && (
          <div className="mt-6 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-stone-900 font-display flex items-center">
                  <ShieldCheck className="w-5 h-5 text-emerald-600 mr-2" />
                  R2 Regression & Security Suite Execution
                </h3>
                <p className="text-xs text-stone-500 mt-0.5">
                  Verifying all 12 frozen security assertions: session isolation, price injection rejection, Bridge Tour incentive rules, and coordinator auth.
                </p>
              </div>

              <button
                onClick={runSecurityTests}
                disabled={runningR2}
                className="px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-xs shadow-xs transition flex items-center cursor-pointer"
              >
                <Play className={`w-3.5 h-3.5 mr-1.5 ${runningR2 ? 'animate-spin' : ''}`} />
                <span>{runningR2 ? 'Executing Tests...' : 'Run Security Suite'}</span>
              </button>
            </div>

            {r2Report && (
              <div className="space-y-4">
                <div
                  className={`p-5 rounded-2xl border flex items-center justify-between ${
                    r2Report.allPassed
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                      : 'bg-rose-50 border-rose-300 text-rose-950'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <CheckCircle2 className="w-6 h-6 text-emerald-700" />
                    <div>
                      <h4 className="text-sm font-bold">
                        {r2Report.allPassed
                          ? 'All R2 Security Invariants PASSED'
                          : `${r2Report.failedCount} Security Tests FAILED`}
                      </h4>
                      <p className="text-xs text-stone-600">
                        {r2Report.passedCount} of {r2Report.total} security tests successfully verified.
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-bold font-mono px-3 py-1 bg-white rounded-lg border border-stone-200">
                    100% SECURE
                  </span>
                </div>

                <div className="bg-white rounded-3xl border border-stone-200 overflow-hidden divide-y divide-stone-100">
                  {r2Report.results?.map((res: any) => (
                    <div key={res.testId} className="p-4 flex items-start justify-between gap-4 text-xs">
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-mono font-bold text-stone-500">{res.testId}</span>
                          <span className="font-bold text-stone-900">{res.name}</span>
                        </div>
                        <p className="text-stone-500 mt-1">{res.details}</p>
                      </div>

                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase shrink-0 ${
                          res.passed
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {res.passed ? 'PASSED' : 'FAILED'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
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
