import { Router } from 'express';
import { prisma } from '../index';
import { verifyToken } from '../utils/jwt';

const router = Router();

const authMiddleware = (req: any, res: any, next: any) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  const decoded = verifyToken(token);
  if (!decoded) return res.status(401).json({ error: 'Invalid token' });
  req.userId = decoded.userId;
  next();
};

router.use(authMiddleware);

// ─── Get my profile ─────────────────────────────────────────────────────────
router.get('/me', async (req: any, res: any) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { id: true, username: true, email: true, createdAt: true }
    });
    res.json(user);
  } catch {
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// ─── Search users by username ────────────────────────────────────────────────
router.get('/search', async (req: any, res: any) => {
  const { q } = req.query;
  if (!q || typeof q !== 'string' || q.trim().length < 2) {
    return res.status(400).json({ error: 'Query must be at least 2 characters' });
  }
  try {
    const users = await prisma.user.findMany({
      where: {
        username: { contains: q.trim(), mode: 'insensitive' },
        id: { not: req.userId }
      },
      select: { id: true, username: true },
      take: 20,
    });
    res.json(users);
  } catch {
    res.status(500).json({ error: 'Search failed' });
  }
});

// ─── Ban a user (user-to-user) ──────────────────────────────────────────────
router.post('/ban/:targetUserId', async (req: any, res: any) => {
  const { targetUserId } = req.params;
  const userId = req.userId;

  if (targetUserId === userId) return res.status(400).json({ error: 'Cannot ban yourself' });

  try {
    await prisma.userBan.upsert({
      where: { userId_bannedUserId: { userId, bannedUserId: targetUserId } },
      update: {},
      create: { userId, bannedUserId: targetUserId }
    });

    // Remove friendship both ways
    await prisma.friend.deleteMany({
      where: { OR: [{ userId, friendId: targetUserId }, { userId: targetUserId, friendId: userId }] }
    });

    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Failed to ban user' });
  }
});

// ─── Unban a user ────────────────────────────────────────────────────────────
router.delete('/ban/:targetUserId', async (req: any, res: any) => {
  const { targetUserId } = req.params;
  const userId = req.userId;
  try {
    await prisma.userBan.deleteMany({
      where: { userId, bannedUserId: targetUserId }
    });
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Failed to unban user' });
  }
});

// ─── Get user's ban list ─────────────────────────────────────────────────────
router.get('/bans', async (req: any, res: any) => {
  try {
    const bans = await prisma.userBan.findMany({
      where: { userId: req.userId },
      include: { bannedUser: { select: { id: true, username: true } } }
    });
    res.json(bans.map((b: any) => b.bannedUser));
  } catch {
    res.status(500).json({ error: 'Failed to fetch bans' });
  }
});

export default router;
