import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import prisma from "../../../lib/prisma";

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: "Unauthorized" });

  if (req.method !== 'POST') {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { id, title } = req.body;

    if (id) {
      // Update existing thread
      const thread = await prisma.thread.update({
        where: {
          id,
          userId: session.user.id
        },
        data: {
          title: title || "Untitled Thread",
          updatedAt: new Date()
        }
      });
      res.status(200).json(thread);
    } else {
      // Check user's thread count
      const threadCount = await prisma.thread.count({
        where: { userId: session.user.id }
      });

      // Define max threads per user
      const MAX_THREADS_PER_USER = 10;

      // If user has reached limit, delete oldest thread
      if (threadCount >= MAX_THREADS_PER_USER) {
        const oldestThread = await prisma.thread.findFirst({
          where: { userId: session.user.id },
          orderBy: { updatedAt: 'asc' }
        });

        if (oldestThread) {
          // Delete oldest thread and its conversations
          await prisma.thread.delete({
            where: { id: oldestThread.id }
          });
        }
      }

      // Create new thread
      const thread = await prisma.thread.create({
        data: {
          userId: session.user.id,
          title: title || "New Chat",
          createdAt: new Date(),
          updatedAt: new Date()
        }
      });
      res.status(201).json(thread);
    }
  } catch (error) {
    console.error('Error managing thread:', error);
    if (error.code === 'P2002' && error.meta?.target?.includes('title')) {
      return res.status(409).json({ error: 'A thread with this title already exists.' });
    }
    res.status(500).json({ error: 'Failed to manage thread' });
  }
}