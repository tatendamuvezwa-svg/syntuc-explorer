import React, { useState, useEffect } from 'react';
import { api } from '../../services/api.ts';
import {
  TrendingUp,
  Users,
  Target,
  Compass,
  ArrowRight,
  Filter,
  Calendar,
  Sparkles,
  DollarSign,
  Layers,
  Copy,
  Check,
  Eye,
  MessageSquare,
  Search,
  ExternalLink,
  ShieldCheck,
  ChevronRight,
  RefreshCw,
  Share2,
} from 'lucide-react';

export const AnalyticsDashboard: React.FC = () => {
  const [loading, setLoading] = useState<boolean>(true);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // Filter state
  const [range, setRange] = useState<string>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // Active sub-view
  const [subView, setSubView] = useState<'overview' | 'sources' | 'campaigns' | 'ads' | 'reservations' | 'builder'>(
    'overview'
  );

  // Guest Journey Modal
  const [selectedJourneyIdentifier, setSelectedJourneyIdentifier] = useState<string | null>(null);
  const [journeyData, setJourneyData] = useState<any>(null);
  const [loadingJourney, setLoadingJourney] = useState<boolean>(false);

  // Link Builder state
  const [builderBaseUrl, setBuilderBaseUrl] = useState<string>('https://syntuc.com/');
  const [builderSource, setBuilderSource] = useState<string>('tiktok');
  const [builderMedium, setBuilderMedium] = useState<string>('paid_social');
  const [builderCampaign, setBuilderCampaign] = useState<string>('helicopter_launch');
  const [builderContent, setBuilderContent] = useState<string>('helicopter_ad_01');
  const [builderTerm, setBuilderTerm] = useState<string>('');
  const [copiedLink, setCopiedLink] = useState<boolean>(false);

  const loadDashboard = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getAnalyticsDashboard(range, startDate || undefined, endDate || undefined);
      setData(res);
    } catch (err: any) {
      console.error('Failed to load analytics dashboard:', err);
      setError(err.message || 'Unable to fetch analytics data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, [range, startDate, endDate]);

  const handleOpenJourney = async (identifier: string) => {
    setSelectedJourneyIdentifier(identifier);
    setLoadingJourney(true);
    try {
      const res = await api.getVisitorJourney(identifier);
      setJourneyData(res);
    } catch (err) {
      console.error('Failed to load journey:', err);
    } finally {
      setLoadingJourney(false);
    }
  };

  const generatedCampaignUrl = (() => {
    try {
      const url = new URL(builderBaseUrl);
      if (builderSource) url.searchParams.set('utm_source', builderSource.trim().toLowerCase());
      if (builderMedium) url.searchParams.set('utm_medium', builderMedium.trim().toLowerCase());
      if (builderCampaign) url.searchParams.set('utm_campaign', builderCampaign.trim());
      if (builderContent) url.searchParams.set('utm_content', builderContent.trim());
      if (builderTerm) url.searchParams.set('utm_term', builderTerm.trim());
      return url.toString();
    } catch (_) {
      return `${builderBaseUrl}?utm_source=${builderSource}&utm_campaign=${builderCampaign}`;
    }
  })();

  const handleCopyLink = () => {
    navigator.clipboard.writeText(generatedCampaignUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Date Filter Bar */}
      <div className="bg-white p-6 rounded-3xl border border-stone-200/80 shadow-xs flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-200">
              Commercial Intelligence
            </span>
            <span className="text-xs text-stone-400 font-medium">SAINTECH Native Engine</span>
          </div>
          <h2 className="text-xl font-bold font-display text-stone-900 mt-1">Marketing Attribution & Analytics</h2>
          <p className="text-xs text-stone-500">
            Real visitor acquisition, campaign tracking, and multi-touch reservation conversion intelligence.
          </p>
        </div>

        {/* Date Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center bg-stone-100 p-1 rounded-2xl border border-stone-200 text-xs">
            {[
              { id: 'all', label: 'All Time' },
              { id: 'today', label: 'Today' },
              { id: 'yesterday', label: 'Yesterday' },
              { id: 'last7days', label: '7 Days' },
              { id: 'last30days', label: '30 Days' },
              { id: 'thisMonth', label: 'This Month' },
              { id: 'custom', label: 'Custom' },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setRange(f.id)}
                className={`px-3 py-1.5 rounded-xl font-semibold transition cursor-pointer ${
                  range === f.id ? 'bg-white text-stone-900 shadow-xs' : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {range === 'custom' && (
            <div className="flex items-center space-x-2 bg-stone-50 p-1 rounded-2xl border border-stone-200 text-xs">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-2 py-1 bg-white border border-stone-200 rounded-lg text-xs"
              />
              <span className="text-stone-400 text-xs">to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-2 py-1 bg-white border border-stone-200 rounded-lg text-xs"
              />
            </div>
          )}

          <button
            onClick={loadDashboard}
            disabled={loading}
            title="Refresh Data"
            className="p-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 transition cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex border-b border-stone-200 space-x-6 text-sm font-semibold overflow-x-auto">
        {[
          { id: 'overview', label: 'Overview & Funnel', icon: TrendingUp },
          { id: 'sources', label: 'Traffic Sources', icon: Users },
          { id: 'campaigns', label: 'Campaign Performance', icon: Target },
          { id: 'ads', label: 'Ad Creatives (utm_content)', icon: Layers },
          { id: 'reservations', label: 'Reservation Attribution', icon: DollarSign },
          { id: 'builder', label: 'Campaign URL Builder', icon: Share2 },
        ].map((tab) => {
          const Icon = tab.icon;
          const active = subView === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setSubView(tab.id as any)}
              className={`pb-3 flex items-center space-x-2 border-b-2 transition whitespace-nowrap cursor-pointer ${
                active ? 'border-amber-600 text-amber-700' : 'border-transparent text-stone-500 hover:text-stone-800'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Loading & Error States */}
      {loading && !data && (
        <div className="py-20 text-center">
          <RefreshCw className="w-8 h-8 text-amber-600 animate-spin mx-auto mb-3" />
          <p className="text-sm font-medium text-stone-600">Loading authoritative analytics intelligence...</p>
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-red-800 text-sm">
          <p className="font-semibold">Unable to load metrics</p>
          <p className="text-xs mt-1">{error}</p>
        </div>
      )}

      {data && (
        <>
          {/* ======================================================== */}
          {/* VIEW 1: OVERVIEW & FUNNEL */}
          {/* ======================================================== */}
          {subView === 'overview' && (
            <div className="space-y-6">
              {/* Primary Metric KPI Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Traffic KPI */}
                <div className="bg-white p-5 rounded-3xl border border-stone-200/80 shadow-xs">
                  <div className="flex items-center justify-between text-stone-500 text-xs font-semibold">
                    <span>Traffic Volume</span>
                    <Users className="w-4 h-4 text-amber-600" />
                  </div>
                  <div className="mt-2 flex items-baseline space-x-2">
                    <span className="text-2xl font-bold font-display text-stone-900">{data.traffic.totalVisitors}</span>
                    <span className="text-xs text-stone-500">unique visitors</span>
                  </div>
                  <div className="mt-3 pt-3 border-t border-stone-100 flex justify-between text-[11px] text-stone-600">
                    <span>{data.traffic.totalSessions} sessions</span>
                    <span>{data.traffic.pageViews} page views</span>
                    <span className="text-amber-700 font-semibold">{data.traffic.newVisitors} new</span>
                  </div>
                </div>

                {/* Engagement KPI */}
                <div className="bg-white p-5 rounded-3xl border border-stone-200/80 shadow-xs">
                  <div className="flex items-center justify-between text-stone-500 text-xs font-semibold">
                    <span>Syntuc AI Engagement</span>
                    <Sparkles className="w-4 h-4 text-purple-600" />
                  </div>
                  <div className="mt-2 flex items-baseline space-x-2">
                    <span className="text-2xl font-bold font-display text-stone-900">{data.engagement.syntucChatOpens}</span>
                    <span className="text-xs text-stone-500">chat sessions</span>
                  </div>
                  <div className="mt-3 pt-3 border-t border-stone-100 flex justify-between text-[11px] text-stone-600">
                    <span>{data.engagement.syntucMessagesSent} messages</span>
                    <span>{data.engagement.tripsCreated} trips</span>
                    <span>{data.engagement.itemsAdded} items</span>
                  </div>
                </div>

                {/* Conversion Volume KPI */}
                <div className="bg-white p-5 rounded-3xl border border-stone-200/80 shadow-xs">
                  <div className="flex items-center justify-between text-stone-500 text-xs font-semibold">
                    <span>Reservation Requests</span>
                    <Compass className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div className="mt-2 flex items-baseline space-x-2">
                    <span className="text-2xl font-bold font-display text-stone-900">{data.conversion.reservationRequests}</span>
                    <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                      {data.conversion.conversionRate} conv.
                    </span>
                  </div>
                  <div className="mt-3 pt-3 border-t border-stone-100 flex justify-between text-[11px] text-stone-600">
                    <span className="font-semibold text-emerald-800">{data.conversion.confirmedReservations} confirmed</span>
                    <span className="text-stone-400">{data.conversion.cancelledReservations} cancelled</span>
                  </div>
                </div>

                {/* Commercial Revenue KPI */}
                <div className="bg-white p-5 rounded-3xl border border-stone-200/80 shadow-xs">
                  <div className="flex items-center justify-between text-stone-500 text-xs font-semibold">
                    <span>Authoritative Revenue</span>
                    <DollarSign className="w-4 h-4 text-amber-600" />
                  </div>
                  <div className="mt-2 flex items-baseline space-x-2">
                    <span className="text-2xl font-bold font-display text-stone-900">${data.conversion.confirmedRevenue}</span>
                    <span className="text-xs text-stone-500">confirmed</span>
                  </div>
                  <div className="mt-3 pt-3 border-t border-stone-100 flex justify-between text-[11px] text-stone-600">
                    <span>Pipeline: ${data.conversion.pipelineRevenue}</span>
                    <span className="text-stone-400">USD Authoritative</span>
                  </div>
                </div>
              </div>

              {/* Conversion Funnel Visualization */}
              <div className="bg-white p-6 rounded-3xl border border-stone-200/80 shadow-xs">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-bold text-sm font-display text-stone-900">Destination Conversion Funnel</h3>
                    <p className="text-xs text-stone-500">
                      Step-by-step visitor progression from marketing acquisition to confirmed partner booking.
                    </p>
                  </div>
                  <span className="text-xs font-semibold text-stone-500 bg-stone-100 px-3 py-1 rounded-xl">
                    Unique Visitors by Milestone
                  </span>
                </div>

                <div className="space-y-3 pt-2">
                  {data.funnel.map((step: any, idx: number) => (
                    <div key={idx} className="relative">
                      <div className="flex items-center justify-between text-xs font-semibold mb-1">
                        <span className="text-stone-800 flex items-center space-x-2">
                          <span className="w-5 h-5 rounded-full bg-stone-100 text-stone-600 flex items-center justify-center text-[10px] font-bold">
                            {idx + 1}
                          </span>
                          <span>{step.name}</span>
                        </span>
                        <div className="flex items-center space-x-3">
                          <span className="text-stone-900 font-bold">{step.count} visitors</span>
                          <span className="text-stone-400 font-mono text-[11px]">({Number(step.pct).toFixed(1)}%)</span>
                        </div>
                      </div>
                      <div className="w-full h-3 bg-stone-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            idx === 0
                              ? 'bg-amber-600'
                              : idx === 5 || idx === 6
                              ? 'bg-emerald-600'
                              : 'bg-amber-500'
                          }`}
                          style={{ width: `${Math.max(2, Math.min(100, step.pct))}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* VIEW 2: TRAFFIC SOURCES */}
          {/* ======================================================== */}
          {subView === 'sources' && (
            <div className="bg-white p-6 rounded-3xl border border-stone-200/80 shadow-xs space-y-4">
              <div>
                <h3 className="font-bold text-sm font-display text-stone-900">Traffic Acquisition Channels</h3>
                <p className="text-xs text-stone-500">
                  Performance breakdown by marketing channel (TikTok, Facebook, Instagram, Google, WhatsApp, Direct).
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-stone-200 text-stone-500 uppercase tracking-wider text-[10px] font-semibold bg-stone-50/50">
                      <th className="py-3 px-4">Channel / Source</th>
                      <th className="py-3 px-4">Unique Visitors</th>
                      <th className="py-3 px-4">Total Sessions</th>
                      <th className="py-3 px-4">Reservations</th>
                      <th className="py-3 px-4">Confirmed</th>
                      <th className="py-3 px-4">Conversion Rate</th>
                      <th className="py-3 px-4 text-right">Confirmed Revenue</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {data.sourcesTable.map((s: any, idx: number) => (
                      <tr key={idx} className="hover:bg-amber-50/30 transition">
                        <td className="py-3.5 px-4 font-bold text-stone-900 capitalize flex items-center space-x-2">
                          <span
                            className={`w-2 h-2 rounded-full ${
                              s.source === 'tiktok'
                                ? 'bg-pink-500'
                                : s.source === 'facebook'
                                ? 'bg-blue-600'
                                : s.source === 'instagram'
                                ? 'bg-purple-600'
                                : s.source === 'google'
                                ? 'bg-emerald-500'
                                : s.source === 'whatsapp'
                                ? 'bg-emerald-600'
                                : 'bg-stone-400'
                            }`}
                          />
                          <span>{s.source}</span>
                        </td>
                        <td className="py-3.5 px-4 font-medium text-stone-700">{s.visitors}</td>
                        <td className="py-3.5 px-4 text-stone-500">{s.sessions}</td>
                        <td className="py-3.5 px-4 font-semibold text-stone-900">{s.reservations}</td>
                        <td className="py-3.5 px-4 font-bold text-emerald-700">{s.confirmed}</td>
                        <td className="py-3.5 px-4 font-mono font-medium text-stone-700">{s.conversionRate}</td>
                        <td className="py-3.5 px-4 text-right font-bold font-mono text-stone-900">${s.revenue}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* VIEW 3: CAMPAIGNS */}
          {/* ======================================================== */}
          {subView === 'campaigns' && (
            <div className="bg-white p-6 rounded-3xl border border-stone-200/80 shadow-xs space-y-4">
              <div>
                <h3 className="font-bold text-sm font-display text-stone-900">Campaign Performance</h3>
                <p className="text-xs text-stone-500">
                  Performance attributed to specific UTM campaigns (e.g. helicopter_launch, remarketing).
                </p>
              </div>

              {data.campaignsTable.length === 0 ? (
                <div className="py-12 text-center text-stone-400 text-xs">
                  No campaign tagged traffic recorded in this time range. Use the Campaign URL Builder to generate UTM links.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-stone-200 text-stone-500 uppercase tracking-wider text-[10px] font-semibold bg-stone-50/50">
                        <th className="py-3 px-4">Campaign Name</th>
                        <th className="py-3 px-4">Source</th>
                        <th className="py-3 px-4">Visitors</th>
                        <th className="py-3 px-4">Sessions</th>
                        <th className="py-3 px-4">Reservations</th>
                        <th className="py-3 px-4">Confirmed</th>
                        <th className="py-3 px-4">Conversion Rate</th>
                        <th className="py-3 px-4 text-right">Revenue</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {data.campaignsTable.map((c: any, idx: number) => (
                        <tr key={idx} className="hover:bg-amber-50/30 transition">
                          <td className="py-3.5 px-4 font-mono font-bold text-stone-900">{c.campaign}</td>
                          <td className="py-3.5 px-4 capitalize text-stone-600">{c.source}</td>
                          <td className="py-3.5 px-4 font-medium text-stone-700">{c.visitors}</td>
                          <td className="py-3.5 px-4 text-stone-500">{c.sessions}</td>
                          <td className="py-3.5 px-4 font-semibold text-stone-900">{c.reservations}</td>
                          <td className="py-3.5 px-4 font-bold text-emerald-700">{c.confirmed}</td>
                          <td className="py-3.5 px-4 font-mono font-medium text-stone-700">{c.conversionRate}</td>
                          <td className="py-3.5 px-4 text-right font-bold font-mono text-stone-900">${c.revenue}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ======================================================== */}
          {/* VIEW 4: AD CREATIVES (utm_content) */}
          {/* ======================================================== */}
          {subView === 'ads' && (
            <div className="bg-white p-6 rounded-3xl border border-stone-200/80 shadow-xs space-y-4">
              <div>
                <h3 className="font-bold text-sm font-display text-stone-900">Exact Ad Creatives & Content Identifiers</h3>
                <p className="text-xs text-stone-500">
                  Granular comparison of individual creatives, ad variations, and content links (utm_content).
                </p>
              </div>

              {data.adCreativesTable.length === 0 ? (
                <div className="py-12 text-center text-stone-400 text-xs">
                  No utm_content parameters recorded yet. Include utm_content=helicopter_ad_01 to distinguish individual ads.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-stone-200 text-stone-500 uppercase tracking-wider text-[10px] font-semibold bg-stone-50/50">
                        <th className="py-3 px-4">Ad / Creative Identifier (utm_content)</th>
                        <th className="py-3 px-4">Campaign</th>
                        <th className="py-3 px-4">Source</th>
                        <th className="py-3 px-4">Visitors</th>
                        <th className="py-3 px-4">Sessions</th>
                        <th className="py-3 px-4">Reservations</th>
                        <th className="py-3 px-4">Confirmed</th>
                        <th className="py-3 px-4">Conversion Rate</th>
                        <th className="py-3 px-4 text-right">Revenue</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {data.adCreativesTable.map((ad: any, idx: number) => (
                        <tr key={idx} className="hover:bg-amber-50/30 transition">
                          <td className="py-3.5 px-4 font-mono font-bold text-amber-800 bg-amber-50/60 rounded-lg">
                            {ad.content}
                          </td>
                          <td className="py-3.5 px-4 font-mono text-stone-600">{ad.campaign}</td>
                          <td className="py-3.5 px-4 capitalize text-stone-600">{ad.source}</td>
                          <td className="py-3.5 px-4 font-medium text-stone-700">{ad.visitors}</td>
                          <td className="py-3.5 px-4 text-stone-500">{ad.sessions}</td>
                          <td className="py-3.5 px-4 font-semibold text-stone-900">{ad.reservations}</td>
                          <td className="py-3.5 px-4 font-bold text-emerald-700">{ad.confirmed}</td>
                          <td className="py-3.5 px-4 font-mono font-medium text-stone-700">{ad.conversionRate}</td>
                          <td className="py-3.5 px-4 text-right font-bold font-mono text-stone-900">${ad.revenue}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ======================================================== */}
          {/* VIEW 5: RESERVATION ATTRIBUTION ("Where did this reservation come from?") */}
          {/* ======================================================== */}
          {subView === 'reservations' && (
            <div className="bg-white p-6 rounded-3xl border border-stone-200/80 shadow-xs space-y-4">
              <div>
                <h3 className="font-bold text-sm font-display text-stone-900">«Where Did This Reservation Come From?»</h3>
                <p className="text-xs text-stone-500">
                  Full First-Touch and Last-Touch marketing snapshots attached to each persistent reservation.
                </p>
              </div>

              {data.recentAttributedReservations.length === 0 ? (
                <div className="py-12 text-center text-stone-400 text-xs">
                  No reservations found in this time range.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-stone-200 text-stone-500 uppercase tracking-wider text-[10px] font-semibold bg-stone-50/50">
                        <th className="py-3 px-4">Reference</th>
                        <th className="py-3 px-4">Date</th>
                        <th className="py-3 px-4">Total</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4">First-Touch Acquisition</th>
                        <th className="py-3 px-4">Last-Touch Acquisition</th>
                        <th className="py-3 px-4">Confidence</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {data.recentAttributedReservations.map((r: any) => (
                        <tr key={r.id} className="hover:bg-amber-50/30 transition">
                          <td className="py-3.5 px-4 font-mono font-bold text-stone-900">{r.referenceNumber}</td>
                          <td className="py-3.5 px-4 text-stone-500">
                            {new Date(r.createdAt).toLocaleDateString()}
                          </td>
                          <td className="py-3.5 px-4 font-mono font-bold text-stone-900">${r.authoritativeTotal}</td>
                          <td className="py-3.5 px-4">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                r.status === 'CONFIRMED'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : r.status === 'CONTACTED'
                                  ? 'bg-blue-100 text-blue-800'
                                  : r.status === 'QUOTED'
                                  ? 'bg-purple-100 text-purple-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {r.status}
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="font-semibold text-stone-900 capitalize flex items-center space-x-1.5">
                              <span>{r.firstTouch.source}</span>
                              {r.firstTouch.campaign && (
                                <span className="text-[10px] text-stone-500 font-mono font-normal">
                                  / {r.firstTouch.campaign}
                                </span>
                              )}
                            </div>
                            {r.firstTouch.content && (
                              <div className="text-[10px] text-amber-700 font-mono">
                                Ad: {r.firstTouch.content}
                              </div>
                            )}
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="font-semibold text-stone-900 capitalize flex items-center space-x-1.5">
                              <span>{r.lastTouch.source}</span>
                              {r.lastTouch.campaign && (
                                <span className="text-[10px] text-stone-500 font-mono font-normal">
                                  / {r.lastTouch.campaign}
                                </span>
                              )}
                            </div>
                            {r.lastTouch.content && (
                              <div className="text-[10px] text-amber-700 font-mono">
                                Ad: {r.lastTouch.content}
                              </div>
                            )}
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="text-[10px] bg-stone-100 px-2 py-0.5 rounded-md font-mono text-stone-600">
                              {r.firstTouch.confidence || 'DIRECT'}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <button
                              onClick={() => handleOpenJourney(r.referenceNumber)}
                              className="px-2.5 py-1 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 text-[11px] font-semibold transition cursor-pointer flex items-center space-x-1 ml-auto"
                            >
                              <Eye className="w-3 h-3 text-amber-600" />
                              <span>Journey</span>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ======================================================== */}
          {/* VIEW 6: CAMPAIGN URL BUILDER */}
          {/* ======================================================== */}
          {subView === 'builder' && (
            <div className="bg-white p-6 rounded-3xl border border-stone-200/80 shadow-xs space-y-6 max-w-3xl">
              <div>
                <h3 className="font-bold text-base font-display text-stone-900">Campaign Link Generator</h3>
                <p className="text-xs text-stone-500">
                  Construct standardized UTM campaign links for TikTok, Facebook, Instagram, Google, and WhatsApp.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">Destination URL</label>
                  <input
                    type="text"
                    value={builderBaseUrl}
                    onChange={(e) => setBuilderBaseUrl(e.target.value)}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">Source (utm_source)</label>
                  <div className="flex items-center space-x-1 mb-1">
                    {['tiktok', 'facebook', 'instagram', 'google', 'whatsapp'].map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setBuilderSource(s)}
                        className={`px-2 py-0.5 rounded-md text-[10px] font-semibold capitalize cursor-pointer ${
                          builderSource === s ? 'bg-amber-600 text-white' : 'bg-stone-100 text-stone-600'
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                  <input
                    type="text"
                    value={builderSource}
                    onChange={(e) => setBuilderSource(e.target.value)}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">Medium (utm_medium)</label>
                  <input
                    type="text"
                    value={builderMedium}
                    onChange={(e) => setBuilderMedium(e.target.value)}
                    placeholder="paid_social, cpc, referral, etc."
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">Campaign Name (utm_campaign)</label>
                  <input
                    type="text"
                    value={builderCampaign}
                    onChange={(e) => setBuilderCampaign(e.target.value)}
                    placeholder="helicopter_launch, victoria_falls_2026, etc."
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Ad / Creative Content (utm_content)
                  </label>
                  <input
                    type="text"
                    value={builderContent}
                    onChange={(e) => setBuilderContent(e.target.value)}
                    placeholder="helicopter_ad_01, sunset_video_02, etc."
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-mono"
                  />
                  <p className="text-[10px] text-stone-400 mt-1">Identifies the exact advertisement creative.</p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">Keyword Term (utm_term - Optional)</label>
                  <input
                    type="text"
                    value={builderTerm}
                    onChange={(e) => setBuilderTerm(e.target.value)}
                    placeholder="falls helicopter tour"
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-mono"
                  />
                </div>
              </div>

              {/* Output Preview */}
              <div className="bg-stone-900 p-4 rounded-2xl text-white space-y-2">
                <div className="flex items-center justify-between text-xs text-stone-400 font-semibold">
                  <span>Authoritative Generated Campaign URL</span>
                  <button
                    onClick={handleCopyLink}
                    className="flex items-center space-x-1.5 px-3 py-1 bg-amber-600 hover:bg-amber-500 rounded-xl text-xs font-bold transition cursor-pointer text-white"
                  >
                    {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedLink ? 'Copied!' : 'Copy Link'}</span>
                  </button>
                </div>
                <div className="font-mono text-xs text-amber-300 break-all bg-black/40 p-3 rounded-xl border border-stone-800">
                  {generatedCampaignUrl}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Guest Journey Modal */}
      {selectedJourneyIdentifier && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden shadow-2xl border border-stone-200 animate-fadeIn">
            <div className="p-5 border-b border-stone-200 flex items-center justify-between bg-stone-900 text-white">
              <div>
                <h3 className="font-bold text-sm font-display flex items-center space-x-2">
                  <Compass className="w-4 h-4 text-amber-400" />
                  <span>Guest Conversion Journey</span>
                </h3>
                <p className="text-xs text-stone-400">Target Identifier: {selectedJourneyIdentifier}</p>
              </div>
              <button
                onClick={() => {
                  setSelectedJourneyIdentifier(null);
                  setJourneyData(null);
                }}
                className="text-stone-400 hover:text-white text-xs font-semibold px-2.5 py-1 rounded-xl bg-stone-800 cursor-pointer"
              >
                Close
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4">
              {loadingJourney ? (
                <div className="py-12 text-center text-xs text-stone-500">Loading chronological journey...</div>
              ) : journeyData ? (
                <div className="space-y-4">
                  {/* Visitor Summary */}
                  {journeyData.visitor && (
                    <div className="bg-stone-50 p-4 rounded-2xl border border-stone-200 text-xs grid grid-cols-2 gap-2">
                      <div>
                        <span className="text-stone-400 block text-[10px]">First Touch Source:</span>
                        <span className="font-bold text-stone-900 capitalize">{journeyData.visitor.firstSource}</span>
                      </div>
                      <div>
                        <span className="text-stone-400 block text-[10px]">First Touch Campaign:</span>
                        <span className="font-mono font-medium text-stone-800">
                          {journeyData.visitor.firstCampaign || 'None'}
                        </span>
                      </div>
                      <div>
                        <span className="text-stone-400 block text-[10px]">First Touch Creative:</span>
                        <span className="font-mono font-medium text-amber-800">
                          {journeyData.visitor.firstContent || 'None'}
                        </span>
                      </div>
                      <div>
                        <span className="text-stone-400 block text-[10px]">Total Recorded Sessions:</span>
                        <span className="font-semibold text-stone-800">{journeyData.sessionsCount}</span>
                      </div>
                    </div>
                  )}

                  {/* Chronological Event Timeline */}
                  <div>
                    <h4 className="text-xs font-bold text-stone-900 uppercase tracking-wider mb-3">
                      Chronological Action Timeline ({journeyData.eventsCount} events)
                    </h4>
                    <div className="border-l-2 border-stone-200 ml-3 space-y-4 pl-4">
                      {journeyData.events.map((evt: any, idx: number) => (
                        <div key={idx} className="relative">
                          <span
                            className={`absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full border-2 border-white ${
                              evt.eventType.includes('RESERVATION')
                                ? 'bg-emerald-600 ring-2 ring-emerald-200'
                                : evt.eventType.includes('SYNTUC')
                                ? 'bg-purple-600'
                                : 'bg-amber-600'
                            }`}
                          />
                          <div className="text-xs">
                            <div className="flex items-center space-x-2">
                              <span className="font-bold text-stone-900">{evt.eventType}</span>
                              <span className="text-[10px] text-stone-400">
                                {new Date(evt.occurredAt).toLocaleTimeString()}
                              </span>
                            </div>
                            {evt.route && <div className="text-[11px] text-stone-500 font-mono">Route: {evt.route}</div>}
                            {evt.productId && (
                              <div className="text-[11px] text-amber-800 font-medium">Product: {evt.productId}</div>
                            )}
                            {evt.metadata && Object.keys(evt.metadata).length > 0 && (
                              <div className="mt-1 p-2 bg-stone-50 rounded-lg text-[10px] text-stone-600 font-mono">
                                {JSON.stringify(evt.metadata)}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="py-8 text-center text-xs text-stone-500">No journey records found for this identifier.</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
