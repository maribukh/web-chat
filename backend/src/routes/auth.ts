import { Router } from 'express';
import bcrypt from 'bcrypt';
import { prisma } from '../index';
import { generateToken, verifyToken } from '../utils/jwt';
import { z } from 'zod';

const router = Router();

const authMiddleware = (req: any, res: any, next: any) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  const decoded = verifyToken(token);
  if (!decoded) return res.status(401).json({ error: 'Invalid token' });
  req.userId = decoded.userId;
  req.token = token;
  next();
};

// ─── Register ────────────────────────────────────────────────────────────────
const registerSchema = z.object({
  email: z.string().email(),
  username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_]+$/, 'Only letters, numbers and underscores'),
  password: z.string().min(6),
});

router.post('/register', async (req, res) => {
  try {
    const { email, username, password } = registerSchema.parse(req.body);

    const existingUser = await prisma.user.findFirst({
      where: { OR: [{ email }, { username }] }
    });
    if (existingUser) {
      return res.status(400).json({
        error: existingUser.email === email ? 'Email already in use' : 'Username already taken'
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({ data: { email, username, passwordHash } });
    const token = generateToken(user.id);

    await prisma.session.create({
      data: { userId: user.id, token, ipAddress: req.ip, userAgent: req.headers['user-agent'] }
    });

    res.status(201).json({ token, user: { id: user.id, username: user.username, email: user.email } });
  } catch (error: any) {
    if (error?.name === 'ZodError') {
      return res.status(400).json({ error: error.errors[0]?.message || 'Invalid input' });
    }
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Server error during registration' });
  }
});

// ─── Login ────────────────────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(401).json({ error: 'Invalid email or password' });

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return res.status(401).json({ error: 'Invalid email or password' });

    const token = generateToken(user.id);
    await prisma.session.create({
      data: { userId: user.id, token, ipAddress: req.ip, userAgent: req.headers['user-agent'] }
    });

    res.json({ token, user: { id: user.id, username: user.username, email: user.email } });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── Logout (current session) ─────────────────────────────────────────────────
router.post('/logout', authMiddleware, async (req: any, res: any) => {
  try {
    await prisma.session.deleteMany({ where: { token: req.token } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Logout failed' });
  }
});

// ─── Get active sessions ──────────────────────────────────────────────────────
router.get('/sessions', authMiddleware, async (req: any, res: any) => {
  try {
    const sessions = await prisma.session.findMany({
      where: { userId: req.userId },
      orderBy: { lastActivity: 'desc' }
    });
    const result = sessions.map((s: any) => ({
      id: s.id,
      ipAddress: s.ipAddress,
      userAgent: s.userAgent,
      lastActivity: s.lastActivity,
      createdAt: s.createdAt,
      isCurrent: s.token === req.token,
    }));
    res.json(result);
  } catch {
    res.status(500).json({ error: 'Failed to fetch sessions' });
  }
});

// ─── Logout specific session ──────────────────────────────────────────────────
router.delete('/sessions/:id', authMiddleware, async (req: any, res: any) => {
  try {
    await prisma.session.deleteMany({
      where: { id: req.params.id, userId: req.userId }
    });
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Failed to delete session' });
  }
});

// ─── Change password ──────────────────────────────────────────────────────────
router.post('/change-password', authMiddleware, async (req: any, res: any) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: 'Invalid input. New password must be at least 6 characters.' });
    }

    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) return res.status(401).json({ error: 'Current password is incorrect' });

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({ where: { id: req.userId }, data: { passwordHash } });

    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Failed to change password' });
  }
});

// ─── Delete account ────────────────────────────────────────────────────────────
router.delete('/account', authMiddleware, async (req: any, res: any) => {
  try {
    const userId = req.userId;

    // Delete rooms owned by this user (cascade deletes messages & attachments via Prisma schema)
    const ownedRooms = await prisma.room.findMany({ where: { ownerId: userId }, select: { id: true } });
    for (const room of ownedRooms) {
      await prisma.room.delete({ where: { id: room.id } });
    }

    // Delete user (sessions, friendships, etc cascade via schema)
    await prisma.user.delete({ where: { id: userId } });

    res.json({ success: true });
  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({ error: 'Failed to delete account' });
  }
});

export default router;
