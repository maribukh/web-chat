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

// Get messages for a room
router.get('/room/:roomId', async (req: any, res: any) => {
  const { roomId } = req.params;
  const { cursor, limit = 50 } = req.query;
  const userId = req.userId;

  try {
    // Check if user is member
    const room = await prisma.room.findUnique({ where: { id: roomId } });
    if (!room) return res.status(404).json({ error: 'Room not found' });

    const member = await prisma.roomMember.findUnique({
      where: { roomId_userId: { roomId, userId } },
    });

    if (!member && room.visibility !== 'public') {
      return res.status(403).json({ error: 'Not a member of this room' });
    }

    const messages = await prisma.message.findMany({
      where: { roomId },
      take: Number(limit),
      ...(cursor ? { skip: 1, cursor: { id: String(cursor) } } : {}),
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, username: true } },
        attachments: true,
      },
    });

    res.json(messages.reverse());
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// Delete message
router.delete('/:messageId', async (req: any, res: any) => {
  const { messageId } = req.params;
  const userId = req.userId;

  try {
    const message = await prisma.message.findUnique({
      where: { id: messageId },
      include: { room: { include: { members: true } } },
    });

    if (!message) return res.status(404).json({ error: 'Message not found' });

    const member = message.room?.members.find((m: any) => m.userId === userId);
    const isOwner = message.userId === userId;
    const isAdmin =
      member && (member.role === 'owner' || member.role === 'admin');

    if (!isOwner && !isAdmin) {
      return res
        .status(403)
        .json({ error: 'Not authorized to delete this message' });
    }

    await prisma.message.delete({ where: { id: messageId } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete message' });
  }
});

export default router;
