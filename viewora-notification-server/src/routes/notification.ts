import { Router, Request, Response } from 'express';
import { notificationService } from '../services/notificationService';
import { exhibitionService } from '../services/exhibitionService';
import { groupService } from '../services/groupService';

const router = Router();

// 1. Token Kaydetme
router.post('/save-token', async (req: Request, res: Response) => {
  const { userId, token } = req.body;
  if (!userId || !token) {
    return res.status(400).json({ success: false, error: "Missing userId or token" });
  }

  try {
    notificationService.saveToken(userId, token);
    res.json({ success: true, message: "Token saved successfully" });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to save token" });
  }
});

router.get('/debug/tokens', (req, res) => {
  const tokens = notificationService.getAllTokens();
  // Set is a bit tricky for JSON.stringify, convert to arrays
  const formatted: any = {};
  for (const [userId, tokenSet] of Object.entries(tokens)) {
    formatted[userId] = Array.from(tokenSet);
  }
  res.json(formatted);
});

// 2. Belirli Konuya Abone Olma
router.post('/subscribe', async (req: Request, res: Response) => {
  const { userId, token, topic } = req.body;
  if (!token || !topic) {
    return res.status(400).json({ success: false, error: "Missing token or topic" });
  }

  try {
    await notificationService.subscribeToTopic(token, topic);
    res.json({ success: true, message: `Subscribed to topic: ${topic}` });
  } catch (error) {
    res.status(500).json({ success: false, error: "Subscription failed" });
  }
});

// 3. Genel Duyuru (Manual Broadcast)
router.post('/broadcast', async (req: Request, res: Response) => {
  const { title, body } = req.body;
  if (!title || !body) {
    return res.status(400).json({ success: false, error: "Missing title or body" });
  }

  try {
    await notificationService.sendToTopic('all_users', title, body);
    res.json({ success: true, message: "Broadcast initiated" });
  } catch (error) {
    res.status(500).json({ success: false, error: "Broadcast failed" });
  }
});

// 4. Test Endpointleri (Event Trigger Simülasyonu)
router.post('/test/approve-photo', async (req: Request, res: Response) => {
    const { userId, photoId } = req.body;
    await exhibitionService.approvePhoto(userId, photoId);
    res.json({ success: true, message: "Exhibition Event triggered" });
});

router.post('/test/new-competition', async (req: Request, res: Response) => {
    await exhibitionService.startNewCompetition();
    res.json({ success: true, message: "Competition Event triggered" });
});

export default router;
