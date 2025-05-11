import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
const prisma = require('@quicke/db');;

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: "Unauthorized" });

  if (req.method !== 'GET') {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Find last 10 threads with conversation count & last message for preview
    const threads = await prisma.thread.findMany({
      where: { userId: session.user.id },
      orderBy: { updatedAt: 'desc' },
      take: 10, // Limit to 10 threads per user
      include: {
        conversations: {
          take: 1,
          orderBy: { createdAt: 'desc' },
          include: {
            messages: {
              take: 1,
              orderBy: { createdAt: 'asc' },
              where: { role: 'user' }
            }
          }
        },
        _count: {
          select: { conversations: true }
        }
      }
    });

    // Format the response
    const formattedThreads = threads.map(thread => ({
      id: thread.id,
      title: thread.title,
      createdAt: thread.createdAt,
      updatedAt: thread.updatedAt,
      conversationCount: thread._count.conversations,
      preview: thread.conversations[0]?.messages[0]?.content.substring(0, 100) + 
              (thread.conversations[0]?.messages[0]?.content.length > 100 ? "..." : "") || ""
    }));

    res.status(200).json({ threads: formattedThreads });
  } catch (error) {
    console.error('Error retrieving threads:', error);
    res.status(500).json({ error: 'Failed to retrieve threads' });
  }
} 