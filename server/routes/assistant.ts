import { Router, Request, Response } from 'express';
import { processAssistantMessage } from '../services/gemini.ts';
import { db } from '../db/index.ts';
import * as schema from '../db/schema.ts';
import { eq } from 'drizzle-orm';

const router = Router();

// POST /api/assistant/chat - Conversational digital guide
router.post('/chat', async (req: Request, res: Response) => {
  try {
    const { message, history, tripContext } = req.body;

    if (!message || typeof message !== 'string') {
      res.status(400).json({ error: 'MESSAGE_REQUIRED' });
      return;
    }

    const assistantResponse = await processAssistantMessage(message, history || [], tripContext);
    res.json(assistantResponse);
  } catch (error) {
    console.error('Assistant route error:', error);
    res.status(500).json({
      replyText: 'I am here to help you discover Victoria Falls. Please let me know which experiences interest you.',
      action: null,
      requiresCoordinator: false,
    });
  }
});

export default router;
