import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import prisma from '../../../lib/prisma';

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
          userId: session.user.id // Ensure user owns the thread
        },
        data: { 
          title: title || "Untitled Thread",
          updatedAt: new Date()
        }
      });
      
      res.status(200).json(thread);
    } else {
      // Create new thread
      const thread = await prisma.thread.create({
        data: {
          userId: session.user.id,
          title: title || "New Thread",
          createdAt: new Date(),
          updatedAt: new Date()
        }
      });
      
      // If user already has 5 threads, delete the oldest one
      const threadCount = await prisma.thread.count({
        where: { userId: session.user.id }
      });
      
      if (threadCount > 5) {
        const oldestThread = await prisma.thread.findFirst({
          where: { userId: session.user.id },
          orderBy: { updatedAt: 'asc' }
        });
        
        if (oldestThread) {
          await prisma.thread.delete({
            where: { id: oldestThread.id }
          });
        }
      }
      
      res.status(201).json(thread);
    }
  } catch (error) {
    console.error('Error managing thread:', error);
    res.status(500).json({ error: 'Failed to manage thread' });
  }
} 