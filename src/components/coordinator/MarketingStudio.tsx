import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../../services/api.ts';
import { Check, Copy, ExternalLink, LoaderCircle, Megaphone, Plus, RefreshCw, Sparkles, Upload, Video } from 'lucide-react';

type Campaign = {
  id: string; title: string; platform: string; status: string; destination: string;
  caption: string; hook?: string; callToAction?: string; hashtags?: string[]; creativeName?: string | null; creativeSize?: number | null;
  utmCampaign?: string; clickCount?: number; publishedUrl?: string | null; postId?: string | null;
  publishedAt?: string | null; createdAt?: string;
};

const PUBLIC_ORIGIN = 'https://syntuc.com';
const emptyDraft: { title: string; topic: string; audience: string; tone: string; hook: string; caption: string; hashtags: string[]; callToAction: string; destination: string; creativeName: string; creativeSize: number | null } = { title: '', topic: '', audience: 'Travellers planning a Victoria Falls visit', tone: 'Helpful, vivid and credible', hook: '', caption: '', hashtags: [], callToAction: '', destination: PUBLIC_ORIGIN + '/', creativeName: '', creativeSize: null };

export const MarketingStudio: React.FC = () => {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [draft, setDraft] = useState(emptyDraft);
  const [activeId, setActiveId] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [publishedUrl, setPublishedUrl] = useState('');
  const [postId, setPostId] = useState('');
  const [showPublishForm, setShowPublishForm] = useState(false);

  const activeCampaign = campaigns.find(c => c.id === activeId) || null;
  const trackedUrl = useMemo(() => activeId ? `${window.location.origin}/api/marketing/c/${activeId}` : '', [activeId, campaigns]);

  const load = async () => {
    setLoading(true); setError('');
    try {
      const campaignResult = await api.getMarketingCampaigns();
      setCampaigns(campaignResult.campaigns || []);
    } catch (e: any) { setError(e.message || 'Could not load marketing workspace.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);

  const updateDraft = (patch: Partial<typeof draft>) => setDraft(prev => ({ ...prev, ...patch }));

  const generate = async () => {
    setBusy(true); setError(''); setNotice('');
    try {
      const result = await api.generateMarketingDraft({ topic: draft.topic, audience: draft.audience, tone: draft.tone });
      setDraft(prev => ({ ...prev, hook: result.hook || '', caption: result.caption || '', hashtags: result.hashtags || [], callToAction: result.callToAction || '' }));
      setNotice('AI draft generated. Review every claim before publishing.');
    } catch (e: any) { setError(e.message || 'AI generation failed. You can still write the draft manually.'); }
    finally { setBusy(false); }
  };


  const saveCampaign = async () => {
    if (!draft.title.trim() || !draft.caption.trim() || !draft.destination.trim()) {
      setError('Enter a campaign name, caption and destination URL.'); return;
    }
    setBusy(true); setError(''); setNotice('');
    try {
      const result = await api.saveMarketingCampaign({
        id: activeId || undefined, title: draft.title, destination: draft.destination,
        caption: draft.caption.trim(),
        hook: draft.hook, callToAction: draft.callToAction, hashtags: draft.hashtags, creativeName: draft.creativeName || null, creativeSize: draft.creativeSize,
        utmCampaign: draft.title.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 100),
      });
      setActiveId(result.campaign.id);
      setCampaigns(prev => [result.campaign, ...prev.filter(c => c.id !== result.campaign.id)]);
      setNotice('Campaign draft saved in Firestore. Copy its tracked link before publishing.');
    } catch (e: any) { setError(e.message || 'Could not save campaign.'); }
    finally { setBusy(false); }
  };

  const selectCampaign = (campaign: Campaign) => {
    setActiveId(campaign.id);
    setVideoFile(null);
    setDraft({ ...emptyDraft, title: campaign.title, topic: campaign.hook || campaign.title, hook: campaign.hook || '', callToAction: campaign.callToAction || '', caption: campaign.caption, hashtags: campaign.hashtags || [], destination: campaign.destination, creativeName: campaign.creativeName || '', creativeSize: campaign.creativeSize || null });
    setPublishedUrl(campaign.publishedUrl || ''); setPostId(campaign.postId || ''); setShowPublishForm(false);
    setNotice('Campaign loaded for editing.');
  };

  const markPublished = async () => {
    if (!activeId) { setError('Save the campaign before recording publication.'); return; }
    setBusy(true); setError(''); setNotice('');
    try {
      await api.recordMarketingPublished(activeId, { publishedUrl, postId });
      setNotice('Publication details recorded. This status is based on your confirmation, not an automatic TikTok check.');
      setShowPublishForm(false); await load();
    } catch (e: any) { setError(e.message || 'Could not record publication details.'); }
    finally { setBusy(false); }
  };

  const copy = async (text: string) => {
    try { await navigator.clipboard.writeText(text); setNotice('Copied to clipboard.'); }
    catch { setError('Clipboard access was blocked. Select and copy the text manually.'); }
  };
  const openTikTok = () => window.open('https://www.tiktok.com/upload', '_blank', 'noopener,noreferrer');

  return <div className="space-y-6">
    <div className="rounded-3xl border border-stone-200 bg-white p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div><div className="text-xs font-bold uppercase tracking-wider text-amber-700">SAINTECH · Syntuc Explorer</div><h3 className="mt-1 text-xl font-bold text-stone-900">TikTok Marketing Studio</h3><p className="mt-1 text-sm text-stone-500">Create content, select local videos for manual TikTok upload and measure tracked traffic.</p></div>
        <button onClick={() => { setActiveId(''); setDraft(emptyDraft); setPublishedUrl(''); setPostId(''); setShowPublishForm(false); }} className="inline-flex items-center justify-center gap-2 rounded-xl border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-700 hover:bg-stone-50"><Plus size={16}/> New campaign</button>
      </div>
      {notice && <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</div>}
      {error && <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}
    </div>

    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(280px,1fr)]">
      <div className="space-y-5 rounded-3xl border border-stone-200 bg-white p-5 md:p-6">
        <div className="flex items-center gap-2"><Sparkles className="text-amber-700" size={18}/><h4 className="font-bold text-stone-900">AI Content Studio</h4></div>
        <label className="block text-xs font-semibold text-stone-600">Campaign name<input value={draft.title} onChange={e=>updateDraft({title:e.target.value})} placeholder="e.g. Flight of Angels — October" className="mt-1 w-full rounded-xl border border-stone-300 px-3 py-2.5 text-sm text-stone-900 outline-none focus:border-amber-600"/></label>
        <label className="block text-xs font-semibold text-stone-600">Video / post topic<input value={draft.topic} onChange={e=>updateDraft({topic:e.target.value})} placeholder="Describe the experience and angle" className="mt-1 w-full rounded-xl border border-stone-300 px-3 py-2.5 text-sm text-stone-900 outline-none focus:border-amber-600"/></label>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <label className="block text-xs font-semibold text-stone-600">Target audience<input value={draft.audience} onChange={e=>updateDraft({audience:e.target.value})} className="mt-1 w-full rounded-xl border border-stone-300 px-3 py-2.5 text-sm font-normal"/></label>
          <label className="block text-xs font-semibold text-stone-600">Tone<input value={draft.tone} onChange={e=>updateDraft({tone:e.target.value})} className="mt-1 w-full rounded-xl border border-stone-300 px-3 py-2.5 text-sm font-normal"/></label>
        </div>
        <button disabled={busy} onClick={generate} className="inline-flex items-center justify-center gap-2 rounded-xl bg-stone-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"><Sparkles size={16}/>{busy ? 'Working…' : 'Generate TikTok copy'}</button>
        <label className="block text-xs font-semibold text-stone-600">Hook / opening line<textarea value={draft.hook} onChange={e=>updateDraft({hook:e.target.value})} rows={2} className="mt-1 w-full rounded-xl border border-stone-300 px-3 py-2.5 text-sm font-normal"/></label>
        <label className="block text-xs font-semibold text-stone-600">Caption<textarea value={draft.caption} onChange={e=>updateDraft({caption:e.target.value})} rows={5} placeholder="Edit the AI draft or write your own caption." className="mt-1 w-full rounded-xl border border-stone-300 px-3 py-2.5 text-sm font-normal"/></label>
        <label className="block text-xs font-semibold text-stone-600">Call to action<input value={draft.callToAction} onChange={e=>updateDraft({callToAction:e.target.value})} placeholder="Explore verified experiences" className="mt-1 w-full rounded-xl border border-stone-300 px-3 py-2.5 text-sm font-normal"/></label>
        <label className="block text-xs font-semibold text-stone-600">Hashtags (space separated)<input value={draft.hashtags.join(' ')} onChange={e=>updateDraft({hashtags:e.target.value.split(/\s+/).filter(Boolean).slice(0,10)})} placeholder="#VictoriaFalls #ZimbabweTravel" className="mt-1 w-full rounded-xl border border-stone-300 px-3 py-2.5 text-sm font-normal"/></label>
        <label className="block text-xs font-semibold text-stone-600">Destination URL<input value={draft.destination} onChange={e=>updateDraft({destination:e.target.value})} className="mt-1 w-full rounded-xl border border-stone-300 px-3 py-2.5 text-sm font-normal"/></label>
        <div className="rounded-xl border border-stone-200 bg-stone-50 p-3"><div className="text-xs font-semibold text-stone-700">Selected video</div><div className="mt-1 text-xs text-stone-500">{draft.creativeName ? `${draft.creativeName}${draft.creativeSize ? ` · ${(draft.creativeSize/1024/1024).toFixed(2)} MB` : ''}` : 'No video selected for this campaign.'}</div></div>
        <button disabled={busy} onClick={saveCampaign} className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-700 px-4 py-3 text-sm font-bold text-white hover:bg-amber-800 disabled:opacity-50"><Check size={16}/>{busy ? 'Saving…' : 'Save campaign draft'}</button>
      </div>

      <div className="space-y-5">
        <div className="rounded-3xl border border-stone-200 bg-white p-5">
          <div className="flex items-center gap-2"><Video className="text-amber-700" size={18}/><h4 className="font-bold text-stone-900">Video & Creative Library</h4></div>
          <p className="mt-2 text-xs leading-5 text-stone-500">Choose an MP4, WebM or MOV video up to 8 MB from this device. The video itself is not uploaded to Syntuc Explorer or stored in Firestore. Open TikTok below and select the same local file there. Saved campaigns retain only the filename and size; reselect the file after refreshing or returning later.</p>
          <input type="file" accept="video/mp4,video/webm,video/quicktime" onChange={e=>{ const file=e.target.files?.[0] || null; setVideoFile(file); if(file){ if(file.size > 8*1024*1024){setError('Choose a video smaller than 8 MB for this manual workflow.'); setVideoFile(null); return;} setError(''); updateDraft({creativeName:file.name, creativeSize:file.size}); } }} className="mt-4 block w-full text-xs text-stone-600 file:mr-3 file:rounded-lg file:border-0 file:bg-stone-100 file:px-3 file:py-2 file:font-semibold"/>
          {videoFile && <p className="mt-2 text-xs text-stone-600">Selected locally: {videoFile.name} · {(videoFile.size/1024/1024).toFixed(2)} MB</p>}
          <p className="mt-3 text-xs leading-5 text-stone-500">This is a local file selection, not a server upload. Browser security prevents this screen from attaching the file to TikTok automatically.</p>
        </div>

        <div className="rounded-3xl border border-stone-200 bg-white p-5">
          <div className="flex items-center gap-2"><Megaphone className="text-amber-700" size={18}/><h4 className="font-bold text-stone-900">Publishing Desk</h4></div>
          <p className="mt-2 text-xs leading-5 text-stone-500">TikTok direct publishing is not connected here. Open TikTok, upload the selected video, paste your caption and include the tracked link where TikTok permits. Then record the published post.</p>
          <button onClick={()=>copy([draft.hook,draft.caption,draft.callToAction,draft.hashtags.join(' ')].filter(Boolean).join('\n\n'))} className="mt-4 inline-flex items-center gap-2 rounded-xl border border-stone-300 px-3 py-2 text-sm font-semibold"><Copy size={15}/> Copy caption</button>
          <button onClick={()=>copy(trackedUrl || 'Save the campaign first to generate a tracked link.')} disabled={!activeId} className="ml-2 mt-4 inline-flex items-center gap-2 rounded-xl border border-stone-300 px-3 py-2 text-sm font-semibold disabled:opacity-40"><Copy size={15}/> Copy tracked link</button>
          <button onClick={openTikTok} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-stone-900 px-4 py-3 text-sm font-bold text-white">Open TikTok upload <ExternalLink size={15}/></button>
          {activeId && <div className="mt-3 break-all rounded-xl bg-stone-50 p-3 text-xs text-stone-700"><div className="mb-1 font-bold">Tracked campaign URL</div>{trackedUrl}</div>}
          {activeCampaign && <div className="mt-4 border-t border-stone-200 pt-4"><div className="flex items-center justify-between"><span className="text-xs font-bold text-stone-800">Status: {activeCampaign.status}</span><span className="text-xs text-stone-500">{activeCampaign.clickCount || 0} tracked clicks</span></div><button onClick={()=>{setPublishedUrl(activeCampaign.publishedUrl || '');setPostId(activeCampaign.postId || '');setShowPublishForm(v=>!v)}} className="mt-3 rounded-xl border border-stone-300 px-3 py-2 text-sm font-semibold">Record published post</button>{showPublishForm && <div className="mt-3 space-y-3"><label className="block text-xs font-semibold text-stone-600">TikTok post URL (optional)<input value={publishedUrl} onChange={e=>setPublishedUrl(e.target.value)} placeholder="https://www.tiktok.com/@.../video/..." className="mt-1 w-full rounded-xl border border-stone-300 px-3 py-2 text-sm font-normal"/></label><label className="block text-xs font-semibold text-stone-600">TikTok post ID (optional)<input value={postId} onChange={e=>setPostId(e.target.value)} className="mt-1 w-full rounded-xl border border-stone-300 px-3 py-2 text-sm font-normal"/></label><button disabled={busy} onClick={markPublished} className="rounded-xl bg-emerald-700 px-3 py-2 text-sm font-bold text-white disabled:opacity-50">Confirm published</button></div>}</div>}
        </div>
      </div>
    </div>

    <div className="rounded-3xl border border-stone-200 bg-white p-5">
      <div className="flex items-center justify-between gap-3"><div><h4 className="font-bold text-stone-900">Saved Campaigns</h4><p className="mt-1 text-xs text-stone-500">Click a campaign to load it into the editor. Click counts reflect visits to tracked campaign links.</p></div><button onClick={load} className="rounded-xl border border-stone-300 p-2" title="Refresh campaigns"><RefreshCw size={16}/></button></div>
      {loading ? <div className="flex items-center gap-2 py-8 text-sm text-stone-500"><LoaderCircle className="animate-spin" size={16}/>Loading saved campaigns…</div> : campaigns.length === 0 ? <div className="py-8 text-center text-sm text-stone-500">No campaigns yet. Create your first TikTok draft above.</div> : <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">{campaigns.map(c=><button key={c.id} onClick={()=>selectCampaign(c)} className={`rounded-2xl border p-4 text-left transition hover:border-amber-500 ${activeId===c.id?'border-amber-600 bg-amber-50/50':'border-stone-200 bg-white'}`}><div className="flex items-start justify-between gap-3"><span className="text-sm font-bold text-stone-900">{c.title}</span><span className="rounded-full bg-stone-100 px-2 py-1 text-[10px] font-bold uppercase text-stone-600">{c.status}</span></div><div className="mt-2 line-clamp-2 text-xs text-stone-500">{c.caption}</div><div className="mt-3 flex items-center justify-between text-[11px] text-stone-500"><span>{c.clickCount || 0} clicks</span><span>{c.publishedAt ? new Date(c.publishedAt).toLocaleDateString() : 'Not recorded as published'}</span></div></button>)}</div>}
    </div>
    <p className="text-xs leading-5 text-stone-500">Measurement note: tracked-link clicks are recorded separately from visitor/session analytics. UTM-based visitor and reservation attribution still depends on the guest arriving at the public Explorer domain and analytics initializing successfully. TikTok does not reliably make clickable URLs available in every organic post format.</p>
  </div>;
};
