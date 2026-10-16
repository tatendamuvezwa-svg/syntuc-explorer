import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { requireCoordinatorAuth, AuthenticatedStaffRequest } from '../middleware/auth.ts';
import { listFeedbackResponses, saveFeedbackResponse } from '../lib/feedbackStore.ts';

const router = Router();
const WINDOW_MS = 10 * 60 * 1000;
const MAX_SUBMISSIONS_PER_WINDOW = 5;
const requestWindows = new Map<string, { startedAt: number; count: number }>();

const RATING_VALUES = new Set(['Excellent', 'Good', 'Fair', 'Poor']);
const RATING_FIELDS = [
  'welcome',
  'boatCleanliness',
  'drinkVariety',
  'snacks',
  'captainInformation',
] as const;

function cleanText(value: unknown, maxLength: number): string {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function validateExperienceDate(value: unknown): string | null {
  const date = cleanText(value, 10);
  if (!date) return null;
  if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(date)) return null;
  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) return null;
  const today = new Date().toISOString().slice(0, 10);
  if (date > today) return null;
  return date;
}

function getRateLimitKey(req: Request): string {
  // Keep the address transient for abuse prevention; never persist it with feedback.
  return req.ip || req.socket.remoteAddress || 'unknown';
}

function isRateLimited(req: Request): boolean {
  const now = Date.now();
  const key = getRateLimitKey(req);
  const current = requestWindows.get(key);

  if (!current || now - current.startedAt >= WINDOW_MS) {
    requestWindows.set(key, { startedAt: now, count: 1 });
  } else {
    current.count += 1;
    if (current.count > MAX_SUBMISSIONS_PER_WINDOW) return true;
  }

  if (requestWindows.size > 2000) {
    for (const [storedKey, window] of requestWindows) {
      if (now - window.startedAt >= WINDOW_MS) requestWindows.delete(storedKey);
    }
  }
  return false;
}

// Public endpoint: accepts a single questionnaire submission without guest login.
router.post('/', async (req: Request, res: Response) => {
  try {
    // Honeypot: quietly accept automated submissions without storing them.
    if (cleanText(req.body?.website, 200)) {
      res.status(202).json({ success: true });
      return;
    }

    if (isRateLimited(req)) {
      res.status(429).json({
        error: 'FEEDBACK_RATE_LIMITED',
        message: 'Too many submissions were received from this connection. Please try again later.',
      });
      return;
    }

    const body = req.body || {};
    const ratings: Record<string, string> = {};
    for (const field of RATING_FIELDS) {
      const rating = cleanText(body.ratings?.[field], 20);
      if (!RATING_VALUES.has(rating)) {
        res.status(400).json({
          error: 'INVALID_FEEDBACK_RATING',
          message: 'Please select a rating for each service question.',
        });
        return;
      }
      ratings[field] = rating;
    }

    const recommendation = cleanText(body.recommendation, 10);
    if (!['Yes', 'No'].includes(recommendation)) {
      res.status(400).json({
        error: 'RECOMMENDATION_REQUIRED',
        message: 'Please answer whether you would recommend this experience.',
      });
      return;
    }

    const overallExperience = cleanText(body.overallExperience, 2000);
    if (!overallExperience) {
      res.status(400).json({
        error: 'OVERALL_EXPERIENCE_REQUIRED',
        message: 'Please share a short comment about your overall experience.',
      });
      return;
    }

    const name = cleanText(body.name, 120);
    const email = cleanText(body.email, 254).toLowerCase();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400).json({ error: 'INVALID_EMAIL', message: 'Please enter a valid email address or leave it blank.' });
      return;
    }

    const id = `hfb_${crypto.randomUUID()}`;
    const response = {
      id,
      tenantId: 'heritage-expedition-pilot',
      experience: 'Sunset Cruise',
      name: name || null,
      email: email || null,
      experienceDate,
      ratings,
      overallExperience,
      recommendation,
      source: 'syntuc-qr-feedback',
      createdAt: new Date().toISOString(),
    };

    await saveFeedbackResponse(id, response);
    res.status(201).json({ success: true, id, message: 'Thank you. Your feedback has been submitted.' });
  } catch (error) {
    console.error('[Feedback API] Failed to save guest feedback:', error);
    res.status(503).json({
      error: 'FEEDBACK_SAVE_FAILED',
      message: 'We could not save your feedback just now. Please try again shortly.',
    });
  }
});

// Staff management endpoint: admin only.
router.get('/responses', requireCoordinatorAuth, async (req: AuthenticatedStaffRequest, res: Response) => {
  if (req.staffUser?.role !== 'admin') {
    res.status(403).json({ error: 'FEEDBACK_ADMIN_REQUIRED', message: 'Administrator access is required to view feedback.' });
    return;
  }

  try {
    const responses = await listFeedbackResponses();
    res.setHeader('Cache-Control', 'no-store');
    res.json(responses.slice(0, 500));
  } catch (error) {
    console.error('[Feedback API] Failed to load feedback responses:', error);
    res.status(503).json({
      error: 'FEEDBACK_READ_FAILED',
      message: 'Feedback records could not be loaded from the data store.',
    });
  }
});

export default router;
