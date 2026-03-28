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

// Get friends
router.get('/', async (req: any, res: any) => {
  const userId = req.userId;
  try {
    const friends = await prisma.friend.findMany({
      where: { userId },
      include: { friend: { select: { id: true, username: true } } }
    });
    res.json(friends.map((f: any) => f.friend));
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch friends' });
  }
});

// Send friend request
router.post('/request', async (req: any, res: any) => {
  const { username, message } = req.body;
  const fromUserId = req.userId;

  try {
    const toUser = await prisma.user.findUnique({ where: { username } });
    if (!toUser) return res.status(404).json({ error: 'User not found' });
    if (toUser.id === fromUserId) return res.status(400).json({ error: 'Cannot add yourself' });

    const existingReq = await prisma.friendRequest.findFirst({
      where: { fromUserId, toUserId: toUser.id, status: 'pending' }
    });
    if (existingReq) return res.status(400).json({ error: 'Request already sent' });

    const request = await prisma.friendRequest.create({
      data: { fromUserId, toUserId: toUser.id, message, status: 'pending' }
    });
    res.json(request);
  } catch (error) {
    res.status(500).json({ error: 'Failed to send request' });
  }
});

// Get pending requests
router.get('/requests', async (req: any, res: any) => {
  const userId = req.userId;
  try {
    const requests = await prisma.friendRequest.findMany({
      where: { toUserId: userId, status: 'pending' },
      include: { fromUser: { select: { id: true, username: true } } }
    });
    res.json(requests);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch requests' });
  }
});

// Accept/Reject request
router.post('/request/:id/respond', async (req: any, res: any) => {
  const { id } = req.params;
  const { accept } = req.body;
  const userId = req.userId;

  try {
    const request = await prisma.friendRequest.findUnique({ where: { id } });
    if (!request || request.toUserId !== userId) return res.status(404).json({ error: 'Request not found' });

    if (accept) {
      await prisma.$transaction([
        prisma.friendRequest.update({ where: { id }, data: { status: 'accepted' } }),
        prisma.friend.create({ data: { userId: request.fromUserId, friendId: request.toUserId } }),
        prisma.friend.create({ data: { userId: request.toUserId, friendId: request.fromUserId } })
      ]);
    } else {
      await prisma.friendRequest.update({ where: { id }, data: { status: 'rejected' } });
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to respond to request' });
  }
});

export default router;
