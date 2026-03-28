import { Router } from 'express';
import { prisma } from '../index';
import { verifyToken } from '../utils/jwt';
import bcrypt from 'bcrypt';

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

// Get user profile
router.get('/me', async (req: any, res: any) => {
  const userId = req.userId;
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, username: true, email: true, createdAt: true }
    });
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// Change password
router.post('/change-password', async (req: any, res: any) => {
  const { currentPassword, newPassword } = req.body;
  const userId = req.userId;

  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) return res.status(401).json({ error: 'Invalid current password' });

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash }
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to change password' });
  }
});

// Delete account
router.delete('/me', async (req: any, res: any) => {
  const userId = req.userId;
  try {
    await prisma.user.delete({ where: { id: userId } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete account' });
  }
});

// Get active sessions
router.get('/sessions', async (req: any, res: any) => {
  const userId = req.userId;
  try {
    const sessions = await prisma.session.findMany({
      where: { userId },
      orderBy: { lastActivity: 'desc' }
    });
    res.json(sessions);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch sessions' });
  }
});

// Logout specific session
router.delete('/sessions/:id', async (req: any, res: any) => {
  const { id } = req.params;
  const userId = req.userId;
  try {
    await prisma.session.deleteMany({
      where: { id, userId }
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to logout session' });
  }
});

export default router;
