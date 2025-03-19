import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import prisma from '../../../lib/prisma';

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: "Unauthorized" });

  if (req.method !== 'DELETE') {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'Thread ID is required' });

    // Delete thread and all associated conversations (cascade will handle)
    await prisma.thread.delete({
      where: { 
        id,
        userId: session.user.id // Ensure user owns the thread
      }
    });

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error deleting thread:', error);
    res.status(500).json({ error: 'Failed to delete thread' });
  }
} 