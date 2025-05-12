import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
const { PrismaClient } = require('../../../node_modules/.prisma/client');
const prisma = new PrismaClient();

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: "Unauthorized" });

  if (req.method !== 'DELETE') {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Find the oldest thread by updatedAt timestamp
    const oldestThread = await prisma.thread.findFirst({
      where: { userId: session.user.id },
      orderBy: { updatedAt: 'asc' },
      include: {
        conversations: true
      }
    });

    if (!oldestThread) {
      return res.status(404).json({ 
        success: false,
        error: 'No threads found to delete' 
      });
    }

    // Delete all conversations in the thread (and their messages via cascade)
    await prisma.conversation.deleteMany({
      where: { threadId: oldestThread.id }
    });

    // Now delete the thread itself
    await prisma.thread.delete({
      where: { id: oldestThread.id }
    });

    res.status(200).json({ 
      success: true,
      message: 'Oldest thread and all its conversations deleted successfully',
      deletedThreadId: oldestThread.id
    });
  } catch (error) {
    console.error('Error deleting oldest thread:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to delete oldest thread'
    });
  }
} 