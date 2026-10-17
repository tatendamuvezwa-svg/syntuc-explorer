import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { setDocById } from '../lib/firestore.ts';

const router = Router();

function isValidRating(val: unknown): val is number {
  return typeof val === 'number' && Number.isInteger(val) && val >= 1 && val <= 5;
}

// POST /api/reviews - Guest submission of boat cruise review
router.post('/', async (req: Request, res: Response) => {
  try {
    const {
      welcomeRating,
      cleanlinessRating,
      drinksRating,
      snacksRating,
      captainInfoRating,
      recommend,
      overallComments,
      guestName,
      guestEmail,
      productId,
      productName,
    } = req.body;

    const errors: string[] = [];

    // Validate 5 ratings
    if (!isValidRating(welcomeRating)) {
      errors.push('welcomeRating must be an integer between 1 and 5');
    }
    if (!isValidRating(cleanlinessRating)) {
      errors.push('cleanlinessRating must be an integer between 1 and 5');
    }
    if (!isValidRating(drinksRating)) {
      errors.push('drinksRating must be an integer between 1 and 5');
    }
    if (!isValidRating(snacksRating)) {
      errors.push('snacksRating must be an integer between 1 and 5');
    }
    if (!isValidRating(captainInfoRating)) {
      errors.push('captainInfoRating must be an integer between 1 and 5');
    }

    // Validate recommendation
    if (recommend !== 'yes' && recommend !== 'no') {
      errors.push('recommend must be either "yes" or "no"');
    }

    // Validate optional email if provided
    if (guestEmail && typeof guestEmail === 'string' && guestEmail.trim() !== '') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(guestEmail.trim())) {
        errors.push('guestEmail is not a valid email address');
      }
    }

    if (errors.length > 0) {
      res.status(400).json({
        error: 'VALIDATION_FAILED',
        message: 'Invalid review payload',
        details: errors,
      });
      return;
    }

    // Resolve stable product identifier
    const resolvedProductId = typeof productId === 'string' && productId.trim() !== ''
      ? productId.trim().slice(0, 100)
      : 'heritage-standard-sunset-cruise';

    const resolvedProductName = typeof productName === 'string' && productName.trim() !== ''
      ? productName.trim().slice(0, 150)
      : resolvedProductId === 'heritage-standard-sunset-cruise'
        ? 'Heritage Standard Sunset Cruise'
        : 'Heritage Expedition Sunset Cruise';

    // Build trusted, server-authoritative review record
    const reviewId = 'rev_cruise_' + crypto.randomBytes(12).toString('hex');
    const nowIso = new Date().toISOString();

    const reviewRecord = {
      id: reviewId,
      productId: resolvedProductId,
      productName: resolvedProductName,
      projectName: 'Heritage Expedition Boat Cruise Review',
      experienceName: resolvedProductName,
      welcomeRating,
      cleanlinessRating,
      drinksRating,
      snacksRating,
      captainInfoRating,
      recommend,
      overallComments: typeof overallComments === 'string' ? overallComments.trim().slice(0, 2000) : null,
      guestName: typeof guestName === 'string' ? guestName.trim().slice(0, 120) : null,
      guestEmail: typeof guestEmail === 'string' ? guestEmail.trim().slice(0, 120) : null,
      submittedAt: nowIso,
      createdAt: nowIso,
    };

    // Save persistently to Cloud Firestore
    await setDocById('boat_cruise_reviews', reviewId, reviewRecord, false);

    res.status(201).json({
      success: true,
      id: reviewId,
      productId: resolvedProductId,
      productName: resolvedProductName,
      message: 'Review successfully saved.',
      submittedAt: nowIso,
    });
  } catch (err: any) {
    console.error('[Reviews API] Failed to persist review:', err);
    res.status(500).json({
      error: 'PERSISTENCE_FAILED',
      message: 'Unable to save review to the persistent store. Please try again.',
      diagnosticCode: err?.code || 'FIRESTORE_WRITE_FAILED',
    });
  }
});

export default router;
