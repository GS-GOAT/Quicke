import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
const { PrismaClient } = require('../../../prisma/generated-client');
const prisma = new PrismaClient();

export default async function handler(req, res) {
  // Ensure the user is authenticated
  const session = await getServerSession(req, res, authOptions);
  if (!session) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    // Get thread stats
    const threadCount = await prisma.thread.count({
      where: { userId: session.user.id }
    });
    
    // Get latest threads
    const latestThreads = await prisma.thread.findMany({
      where: { userId: session.user.id },
      orderBy: { updatedAt: 'desc' },
      take: 5,
      include: {
        _count: {
          select: { conversations: true }
        }
      }
    });
    
    // Get latest conversation
    const latestConversation = await prisma.conversation.findFirst({
      where: { userId: session.user.id },
      orderBy: { createdAt: 'desc' },
      include: {
        messages: true
      }
    });
    
    // Return the stats data
    return res.status(200).json({
      success: true,
      stats: {
        threadCount,
        latestThreads: latestThreads.map(t => ({
          id: t.id,
          title: t.title,
          updatedAt: t.updatedAt,
          conversationCount: t._count.conversations
        })),
        latestConversation: latestConversation ? {
          id: latestConversation.id,
          threadId: latestConversation.threadId,
          messageCount: latestConversation.messages.length,
          userMessage: latestConversation.messages.find(m => m.role === 'user')?.content,
          modelResponses: latestConversation.messages
            .filter(m => m.role === 'assistant')
            .map(m => ({
              modelId: m.modelId,
              contentPreview: m.content.substring(0, 50) + (m.content.length > 50 ? '...' : '')
            }))
        } : null
      }
    });
  } catch (error) {
    console.error('Error retrieving context stats:', error);
    return res.status(500).json({
      error: "Server Error",
      message: error.message
    });
  }
} 