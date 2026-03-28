import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { prisma, io } from '../index';
import { verifyToken } from '../utils/jwt';

const router = Router();

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB limit
});

const authMiddleware = (req: any, res: any, next: any) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  const decoded = verifyToken(token);
  if (!decoded) return res.status(401).json({ error: 'Invalid token' });

  req.userId = decoded.userId;
  next();
};

router.use(authMiddleware);

router.post('/', upload.single('file'), async (req: any, res: any) => {
  const { roomId, comment } = req.body;
  const userId = req.userId;
  const file = req.file;

  if (!file || !roomId) {
    return res.status(400).json({ error: 'File and roomId are required' });
  }

  try {
    // Check membership
    const room = await prisma.room.findUnique({ where: { id: roomId } });
    if (!room) return res.status(404).json({ error: 'Room not found' });

    if (room.visibility !== 'public') {
      const member = await prisma.roomMember.findUnique({
        where: { roomId_userId: { roomId, userId } },
      });
      if (!member) return res.status(403).json({ error: 'Not a member' });
    }

    const message = await prisma.message.create({
      data: {
        roomId,
        userId,
        content: comment || '',
        attachments: {
          create: {
            filename: file.originalname,
            filePath: file.path.replace(/\\/g, '/'),
            fileType: file.mimetype,
            fileSize: file.size,
          },
        },
      },
      include: {
        user: { select: { id: true, username: true } },
        attachments: true,
      },
    });

    io.to(roomId).emit('new_message', message);
    res.json(message);
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Failed to process upload' });
  }
});

export default router;
