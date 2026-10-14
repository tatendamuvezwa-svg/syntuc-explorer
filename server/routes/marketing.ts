import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { GoogleGenAI } from '@google/genai';
import { requireCoordinatorAuth, AuthenticatedStaffRequest } from '../middleware/auth.ts';
import { getDocById, setDocById, updateDocById, getCollectionDocs } from '../lib/firestore.ts';

const router = Router();
const now = () => new Date().toISOString();
const PUBLIC_APP_URL = process.env.PUBLIC_APP_URL || 'https://syntuc.com/';
const PUBLIC_APP_ORIGIN = new URL(PUBLIC_APP_URL).origin;
const safeText = (value: unknown, max = 2000) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const staffId = (req: AuthenticatedStaffRequest) => req.staffUser?.id || 'unknown';

async function resolveGeminiKey(): Promise<string | undefined> {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;
  try {
    const path = '/app/.dev.env.json';
    if (fs.existsSync(path)) return JSON.parse(fs.readFileSync(path, 'utf8')).GEMINI_API_KEY;
  } catch {}
  return undefined;
}

// Coordinator-only campaign workspace. Public click redirects are intentionally isolated below.
router.get('/campaigns', requireCoordinatorAuth, async (_req: AuthenticatedStaffRequest, res: Response) => {
  try {
    const campaigns = await getCollectionDocs<any>('marketing_campaigns');
    const clicks = await getCollectionDocs<any>('marketing_clicks');
    const clickCounts = new Map<string, number>();
    clicks.forEach((click) => clickCounts.set(click.campaignId, (clickCounts.get(click.campaignId) || 0) + 1));
    const enriched = campaigns.map((campaign) => ({ ...campaign, clickCount: clickCounts.get(campaign.id) || 0 }));
    enriched.sort((a, b) => String(b.updatedAt || b.createdAt).localeCompare(String(a.updatedAt || a.createdAt)));
    res.json({ campaigns: enriched });
  } catch (error) {
    console.error('[Marketing] Campaign load failed:', error);
    res.status(500).json({ error: 'CAMPAIGNS_LOAD_FAILED' });
  }
});

router.post('/generate', requireCoordinatorAuth, async (req: AuthenticatedStaffRequest, res: Response) => {
  try {
    const topic = safeText(req.body?.topic, 500);
    const audience = safeText(req.body?.audience, 300) || 'travellers planning a Victoria Falls visit';
    const tone = safeText(req.body?.tone, 100) || 'helpful, vivid, credible';
    if (!topic) { res.status(400).json({ error: 'TOPIC_REQUIRED' }); return; }
    const apiKey = await resolveGeminiKey();
    if (!apiKey || apiKey.startsWith('MY_GEMINI_')) {
      res.status(503).json({ error: 'AI_NOT_CONFIGURED', message: 'AI copy generation is unavailable because the server AI key is not configured. You can still draft and save a campaign manually.' });
      return;
    }
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite',
      contents: `Create one original TikTok marketing draft for Syntuc Explorer, a Victoria Falls trip-planning and reservation-request service. Topic: ${topic}. Audience: ${audience}. Tone: ${tone}. Do not invent prices, availability, endorsements, or confirmed bookings. Avoid promises of instant booking. CTA should invite people to explore verified experiences or send a reservation request. Return JSON only with keys hook, caption, hashtags (array of 4-8 strings), and callToAction. Caption should be natural and concise for TikTok.`,
      config: { responseMimeType: 'application/json', temperature: 0.7 },
    });
    const text = response.text || '';
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('AI returned an invalid draft format');
    const draft = JSON.parse(match[0]);
    res.json({
      hook: safeText(draft.hook, 200),
      caption: safeText(draft.caption, 1800),
      hashtags: Array.isArray(draft.hashtags) ? draft.hashtags.map((v: unknown) => safeText(v, 80)).filter(Boolean).slice(0, 10) : [],
      callToAction: safeText(draft.callToAction, 250),
    });
  } catch (error: any) {
    console.error('[Marketing] AI draft generation failed:', error);
    res.status(502).json({ error: 'AI_GENERATION_FAILED', message: 'The AI draft could not be generated. Please retry or continue editing manually.' });
  }
});

router.post('/campaigns', requireCoordinatorAuth, async (req: AuthenticatedStaffRequest, res: Response) => {
  try {
    const id = safeText(req.body?.id, 100) || 'cmp_' + crypto.randomBytes(10).toString('hex');
    const existing = await getDocById<any>('marketing_campaigns', id);
    const title = safeText(req.body?.title, 120);
    const destination = safeText(req.body?.destination, 1000);
    const caption = safeText(req.body?.caption, 2200);
    const hook = safeText(req.body?.hook, 250);
    const callToAction = safeText(req.body?.callToAction, 250);
    const creativeName = safeText(req.body?.creativeName, 160) || null;
    const creativeSize = Number.isFinite(Number(req.body?.creativeSize)) && Number(req.body?.creativeSize) > 0 ? Math.min(Number(req.body.creativeSize), 8 * 1024 * 1024) : null;
    const hashtags = Array.isArray(req.body?.hashtags) ? req.body.hashtags.map((v: unknown) => safeText(v, 80)).filter(Boolean).slice(0, 10) : [];
    if (!title || !destination || !caption) { res.status(400).json({ error: 'TITLE_DESTINATION_CAPTION_REQUIRED' }); return; }
    let target: URL;
    try { target = new URL(destination); } catch { res.status(400).json({ error: 'INVALID_DESTINATION_URL' }); return; }
    if (target.protocol !== 'https:' || target.origin !== PUBLIC_APP_ORIGIN) {
      res.status(400).json({ error: 'DESTINATION_NOT_ALLOWED', message: 'Use the verified Syntuc Explorer public URL only.' }); return;
    }
    const utmCampaign = safeText(req.body?.utmCampaign, 100) || id;
    const record = {
      ...(existing || {}),
      id, title, platform: 'tiktok', campaignType: 'organic', status: existing?.status || 'DRAFT',
      destination: target.toString(), caption, hook, callToAction, hashtags, creativeName, creativeSize,
      utmCampaign, clickCount: Number(existing?.clickCount) || 0,
      createdAt: existing?.createdAt || now(), updatedAt: now(),
      createdBy: existing?.createdBy || staffId(req), updatedBy: staffId(req),
      publishedUrl: existing?.publishedUrl || null, publishedAt: existing?.publishedAt || null,
      postId: existing?.postId || null,
    };
    await setDocById('marketing_campaigns', id, record);
    res.json({ campaign: record });
  } catch (error) {
    console.error('[Marketing] Campaign save failed:', error);
    res.status(500).json({ error: 'CAMPAIGN_SAVE_FAILED' });
  }
});

router.post('/campaigns/:id/published', requireCoordinatorAuth, async (req: AuthenticatedStaffRequest, res: Response) => {
  try {
    const id = safeText(req.params.id, 100);
    const campaign = await getDocById<any>('marketing_campaigns', id);
    if (!campaign) { res.status(404).json({ error: 'CAMPAIGN_NOT_FOUND' }); return; }
    const publishedUrl = safeText(req.body?.publishedUrl, 1000);
    const postId = safeText(req.body?.postId, 200);
    if (publishedUrl) {
      try {
        const u = new URL(publishedUrl);
        if (u.protocol !== 'https:' || !/(^|\.)tiktok\.com$/i.test(u.hostname)) throw new Error('invalid');
      } catch { res.status(400).json({ error: 'INVALID_TIKTOK_URL' }); return; }
    }
    const record = { status: 'PUBLISHED', publishedUrl: publishedUrl || null, postId: postId || null, publishedAt: now(), updatedAt: now(), updatedBy: staffId(req) };
    await updateDocById('marketing_campaigns', id, record);
    res.json({ success: true, ...record });
  } catch (error) {
    console.error('[Marketing] Publish record failed:', error);
    res.status(500).json({ error: 'PUBLISH_RECORD_FAILED' });
  }
});

// Tracked campaign redirect: public endpoint; destination is revalidated against a fixed canonical origin.
router.get('/c/:id', async (req: Request, res: Response) => {
  try {
    const id = safeText(req.params.id, 100);
    const campaign = await getDocById<any>('marketing_campaigns', id);
    if (!campaign || !['DRAFT', 'READY', 'PUBLISHED'].includes(campaign.status)) { res.status(404).send('Campaign link unavailable'); return; }
    const target = new URL(campaign.destination);
    if (target.protocol !== 'https:' || target.origin !== PUBLIC_APP_ORIGIN) { res.status(400).send('Invalid campaign destination'); return; }
    const source = 'tiktok';
    target.searchParams.set('utm_source', source);
    target.searchParams.set('utm_medium', campaign.campaignType === 'paid' ? 'paid_social' : 'organic_social');
    target.searchParams.set('utm_campaign', campaign.utmCampaign || campaign.id);
    target.searchParams.set('utm_content', campaign.creativeId || campaign.creativeName || campaign.id);
    const clickId = 'clk_' + crypto.randomBytes(12).toString('hex');
    await setDocById('marketing_clicks', clickId, { id: clickId, campaignId: id, occurredAt: now(), referrer: safeText(req.get('referer'), 500), userAgent: safeText(req.get('user-agent'), 300) });
    await updateDocById('marketing_campaigns', id, { clickCount: (Number(campaign.clickCount) || 0) + 1, lastClickAt: now() });
    res.redirect(302, target.toString());
  } catch (error) {
    console.error('[Marketing] Campaign redirect failed:', error);
    res.status(500).send('Unable to open this campaign link');
  }
});

export default router;
