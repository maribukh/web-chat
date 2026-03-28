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

// ─── Get all public rooms (catalog) ──────────────────────────────────────────
router.get('/public', async (req: any, res: any) => {
  try {
    const rooms = await prisma.room.findMany({
      where: { visibility: 'public' },
      include: { _count: { select: { members: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json(rooms);
  } catch {
    res.status(500).json({ error: 'Failed to fetch rooms' });
  }
});

// ─── Get my rooms (joined) ────────────────────────────────────────────────────
router.get('/mine', async (req: any, res: any) => {
  try {
    const memberships = await prisma.roomMember.findMany({
      where: { userId: req.userId },
      include: {
        room: {
          include: { _count: { select: { members: true } } }
        }
      },
      orderBy: { joinedAt: 'asc' },
    });
    res.json(memberships.map((m: any) => ({ ...m.room, role: m.role })));
  } catch {
    res.status(500).json({ error: 'Failed to fetch rooms' });
  }
});

// ─── Get room details with members ────────────────────────────────────────────
router.get('/:roomId', async (req: any, res: any) => {
  const { roomId } = req.params;
  try {
    const room = await prisma.room.findUnique({
      where: { id: roomId },
      include: {
        members: {
          include: { user: { select: { id: true, username: true } } }
        },
        _count: { select: { members: true } }
      }
    });
    if (!room) return res.status(404).json({ error: 'Room not found' });

    // Check membership for private rooms
    if (room.visibility === 'private') {
      const member = room.members.find((m: any) => m.userId === req.userId);
      if (!member) return res.status(403).json({ error: 'Not a member of this room' });
    }

    res.json(room);
  } catch {
    res.status(500).json({ error: 'Failed to fetch room' });
  }
});

// ─── Create a room ─────────────────────────────────────────────────────────────
router.post('/', async (req: any, res: any) => {
  const { name, description, visibility = 'public' } = req.body;
  const userId = req.userId;

  if (!name?.trim()) return res.status(400).json({ error: 'Room name is required' });

  try {
    const room = await prisma.room.create({
      data: {
        name: name.trim(),
        description: description?.trim(),
        visibility,
        ownerId: userId,
        members: { create: { userId, role: 'owner' } }
      }
    });
    res.status(201).json(room);
  } catch (error: any) {
    if (error?.code === 'P2002') return res.status(400).json({ error: 'Room name already taken' });
    res.status(500).json({ error: 'Failed to create room' });
  }
});

// ─── Join a room ──────────────────────────────────────────────────────────────
router.post('/:roomId/join', async (req: any, res: any) => {
  const { roomId } = req.params;
  const userId = req.userId;

  try {
    const ban = await prisma.bannedUser.findUnique({ where: { roomId_userId: { roomId, userId } } });
    if (ban) return res.status(403).json({ error: 'You are banned from this room' });

    const room = await prisma.room.findUnique({ where: { id: roomId } });
    if (!room) return res.status(404).json({ error: 'Room not found' });
    if (room.visibility === 'private') return res.status(403).json({ error: 'This is a private room. You need an invitation.' });

    await prisma.roomMember.upsert({
      where: { roomId_userId: { roomId, userId } },
      update: {},
      create: { roomId, userId, role: 'member' }
    });
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Failed to join room' });
  }
});

// ─── Leave a room ─────────────────────────────────────────────────────────────
router.post('/:roomId/leave', async (req: any, res: any) => {
  const { roomId } = req.params;
  const userId = req.userId;

  try {
    const room = await prisma.room.findUnique({ where: { id: roomId } });
    if (!room) return res.status(404).json({ error: 'Room not found' });
    if (room.ownerId === userId) return res.status(400).json({ error: 'Owner cannot leave. Delete the room instead.' });

    await prisma.roomMember.delete({ where: { roomId_userId: { roomId, userId } } });
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Failed to leave room' });
  }
});

// ─── Delete a room (owner only) ────────────────────────────────────────────────
router.delete('/:roomId', async (req: any, res: any) => {
  const { roomId } = req.params;
  const userId = req.userId;

  try {
    const room = await prisma.room.findUnique({ where: { id: roomId } });
    if (!room) return res.status(404).json({ error: 'Room not found' });
    if (room.ownerId !== userId) return res.status(403).json({ error: 'Only the room owner can delete it' });

    await prisma.room.delete({ where: { id: roomId } });
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Failed to delete room' });
  }
});

// ─── Invite user to private room ──────────────────────────────────────────────
router.post('/:roomId/invite', async (req: any, res: any) => {
  const { roomId } = req.params;
  const { username } = req.body;
  const userId = req.userId;

  try {
    const member = await prisma.roomMember.findUnique({ where: { roomId_userId: { roomId, userId } } });
    if (!member) return res.status(403).json({ error: 'Not a member of this room' });

    const targetUser = await prisma.user.findUnique({ where: { username } });
    if (!targetUser) return res.status(404).json({ error: 'User not found' });

    const ban = await prisma.bannedUser.findUnique({ where: { roomId_userId: { roomId, userId: targetUser.id } } });
    if (ban) return res.status(400).json({ error: 'This user is banned from the room' });

    await prisma.roomMember.upsert({
      where: { roomId_userId: { roomId, userId: targetUser.id } },
      update: {},
      create: { roomId, userId: targetUser.id, role: 'member' }
    });
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Failed to invite user' });
  }
});

// ─── Promote to admin ─────────────────────────────────────────────────────────
router.post('/:roomId/promote', async (req: any, res: any) => {
  const { roomId } = req.params;
  const { targetUserId } = req.body;
  const userId = req.userId;

  try {
    const me = await prisma.roomMember.findUnique({ where: { roomId_userId: { roomId, userId } } });
    if (!me || me.role !== 'owner') return res.status(403).json({ error: 'Only owner can promote admins' });

    await prisma.roomMember.update({
      where: { roomId_userId: { roomId, userId: targetUserId } },
      data: { role: 'admin' }
    });
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Failed to promote user' });
  }
});

// ─── Demote from admin ────────────────────────────────────────────────────────
router.post('/:roomId/demote', async (req: any, res: any) => {
  const { roomId } = req.params;
  const { targetUserId } = req.body;
  const userId = req.userId;

  try {
    const me = await prisma.roomMember.findUnique({ where: { roomId_userId: { roomId, userId } } });
    if (!me || (me.role !== 'owner' && me.role !== 'admin')) return res.status(403).json({ error: 'Not authorized' });

    const target = await prisma.roomMember.findUnique({ where: { roomId_userId: { roomId, userId: targetUserId } } });
    if (!target) return res.status(404).json({ error: 'Member not found' });
    if (target.role === 'owner') return res.status(400).json({ error: 'Cannot demote the owner' });

    await prisma.roomMember.update({
      where: { roomId_userId: { roomId, userId: targetUserId } },
      data: { role: 'member' }
    });
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Failed to demote user' });
  }
});

// ─── Kick user ────────────────────────────────────────────────────────────────
router.post('/:roomId/kick', async (req: any, res: any) => {
  const { roomId } = req.params;
  const { targetUserId } = req.body;
  const userId = req.userId;

  try {
    const member = await prisma.roomMember.findUnique({ where: { roomId_userId: { roomId, userId } } });
    if (!member || (member.role !== 'owner' && member.role !== 'admin')) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    await prisma.roomMember.delete({ where: { roomId_userId: { roomId, userId: targetUserId } } });
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Failed to kick user' });
  }
});

// ─── Ban user from room ────────────────────────────────────────────────────────
router.post('/:roomId/ban', async (req: any, res: any) => {
  const { roomId } = req.params;
  const { targetUserId, reason } = req.body;
  const userId = req.userId;

  try {
    const member = await prisma.roomMember.findUnique({ where: { roomId_userId: { roomId, userId } } });
    if (!member || (member.role !== 'owner' && member.role !== 'admin')) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    await prisma.$transaction([
      prisma.roomMember.deleteMany({ where: { roomId, userId: targetUserId } }),
      prisma.bannedUser.upsert({
        where: { roomId_userId: { roomId, userId: targetUserId } },
        update: { reason },
        create: { roomId, userId: targetUserId, reason, bannedById: userId }
      })
    ]);
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Failed to ban user' });
  }
});

// ─── Get banned users ─────────────────────────────────────────────────────────
router.get('/:roomId/banned', async (req: any, res: any) => {
  const { roomId } = req.params;
  const userId = req.userId;

  try {
    const member = await prisma.roomMember.findUnique({ where: { roomId_userId: { roomId, userId } } });
    if (!member || (member.role !== 'owner' && member.role !== 'admin')) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const bans = await prisma.bannedUser.findMany({
      where: { roomId },
      include: {
        user: { select: { id: true, username: true } },
        bannedBy: { select: { id: true, username: true } }
      }
    });
    res.json(bans);
  } catch {
    res.status(500).json({ error: 'Failed to fetch banned users' });
  }
});

// ─── Unban user ───────────────────────────────────────────────────────────────
router.delete('/:roomId/ban/:targetUserId', async (req: any, res: any) => {
  const { roomId, targetUserId } = req.params;
  const userId = req.userId;

  try {
    const member = await prisma.roomMember.findUnique({ where: { roomId_userId: { roomId, userId } } });
    if (!member || (member.role !== 'owner' && member.role !== 'admin')) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    await prisma.bannedUser.delete({ where: { roomId_userId: { roomId, userId: targetUserId } } });
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Failed to unban user' });
  }
});

// ─── Get or create DM room ────────────────────────────────────────────────────
router.post('/dm/:friendId', async (req: any, res: any) => {
  const { friendId } = req.params;
  const userId = req.userId;

  try {
    // Find existing DM
    const existingRooms = await prisma.room.findMany({
      where: { visibility: 'private', members: { every: { userId: { in: [userId, friendId] } } } },
      include: { members: true }
    });
    const dmRoom = existingRooms.find((r: any) => r.members.length === 2);
    if (dmRoom) return res.json(dmRoom);

    // Create new DM
    const newRoom = await prisma.room.create({
      data: {
        name: `dm-${[userId, friendId].sort().join('-')}`,
        visibility: 'private',
        ownerId: userId,
        members: { create: [{ userId, role: 'member' }, { userId: friendId, role: 'member' }] }
      }
    });
    res.json(newRoom);
  } catch {
    res.status(500).json({ error: 'Failed to get or create DM room' });
  }
});

export default router;
