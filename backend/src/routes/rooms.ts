import { Router } from 'express';
import { prisma } from '../index';
import { verifyToken } from '../utils/jwt';

const router = Router();

// Middleware to protect routes
const authMiddleware = (req: any, res: any, next: any) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  
  const decoded = verifyToken(token);
  if (!decoded) return res.status(401).json({ error: 'Invalid token' });
  
  req.userId = decoded.userId;
  next();
};

router.use(authMiddleware);

// Get all public rooms
router.get('/public', async (req: any, res: any) => {
  try {
    const rooms = await prisma.room.findMany({
      where: { visibility: 'public' },
      include: {
        _count: { select: { members: true } }
      }
    });
    res.json(rooms);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch rooms' });
  }
});

// Create a room
router.post('/', async (req: any, res: any) => {
  const { name, description, visibility } = req.body;
  const userId = req.userId;

  try {
    const room = await prisma.room.create({
      data: {
        name,
        description,
        visibility,
        ownerId: userId,
        members: {
          create: {
            userId,
            role: 'owner'
          }
        }
      }
    });
    res.status(201).json(room);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create room' });
  }
});

// Join a room
router.post('/:roomId/join', async (req: any, res: any) => {
  const { roomId } = req.params;
  const userId = req.userId;

  try {
    // Check if banned
    const ban = await prisma.bannedUser.findUnique({
      where: { roomId_userId: { roomId, userId } }
    });
    if (ban) return res.status(403).json({ error: 'You are banned from this room' });

    const room = await prisma.room.findUnique({ where: { id: roomId } });
    if (!room) return res.status(404).json({ error: 'Room not found' });
    if (room.visibility === 'private') return res.status(403).json({ error: 'Cannot join private room directly' });

    await prisma.roomMember.upsert({
      where: { roomId_userId: { roomId, userId } },
      update: {},
      create: { roomId, userId, role: 'member' }
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to join room' });
  }
});

// Get or create DM room
router.post('/dm/:friendId', async (req: any, res: any) => {
  const { friendId } = req.params;
  const userId = req.userId;

  try {
    // Check if DM room already exists
    const existingRooms = await prisma.room.findMany({
      where: {
        visibility: 'private',
        members: {
          every: {
            userId: { in: [userId, friendId] }
          }
        }
      },
      include: { members: true }
    });

    const dmRoom = existingRooms.find((r: any) => r.members.length === 2);

    if (dmRoom) {
      return res.json(dmRoom);
    }

    // Create new DM room
    const newRoom = await prisma.room.create({
      data: {
        name: `dm-${userId}-${friendId}`,
        visibility: 'private',
        ownerId: userId,
        members: {
          create: [
            { userId, role: 'member' },
            { userId: friendId, role: 'member' }
          ]
        }
      }
    });

    res.json(newRoom);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get or create DM room' });
  }
});

// Kick user from room
router.post('/:roomId/kick', async (req: any, res: any) => {
  const { roomId } = req.params;
  const { targetUserId } = req.body;
  const userId = req.userId;

  try {
    const member = await prisma.roomMember.findUnique({
      where: { roomId_userId: { roomId, userId } }
    });
    if (!member || (member.role !== 'owner' && member.role !== 'admin')) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    await prisma.roomMember.delete({
      where: { roomId_userId: { roomId, userId: targetUserId } }
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to kick user' });
  }
});

// Ban user from room
router.post('/:roomId/ban', async (req: any, res: any) => {
  const { roomId } = req.params;
  const { targetUserId, reason } = req.body;
  const userId = req.userId;

  try {
    const member = await prisma.roomMember.findUnique({
      where: { roomId_userId: { roomId, userId } }
    });
    if (!member || (member.role !== 'owner' && member.role !== 'admin')) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    await prisma.$transaction([
      prisma.roomMember.deleteMany({
        where: { roomId, userId: targetUserId }
      }),
      prisma.bannedUser.upsert({
        where: { roomId_userId: { roomId, userId: targetUserId } },
        update: { reason },
        create: { roomId, userId: targetUserId, reason, bannedById: userId }
      })
    ]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to ban user' });
  }
});

export default router;
