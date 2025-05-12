import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
const { PrismaClient } = require('../../../node_modules/.prisma/client');
const prisma = new PrismaClient();

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: "Unauthorized" });

  if (req.method === 'GET') {
    try {
      const page = parseInt(req.query.page) || 1;
      const pageSize = 5;
      const skip = (page - 1) * pageSize;

      // Get conversations with pagination
      const conversations = await prisma.conversation.findMany({
        where: { userId: session.user.id },
        include: { messages: true },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize + 1  // Take one extra to check if there are more
      });

      // Check if there are more conversations
      const hasMore = conversations.length > pageSize;
      const conversationsToSend = hasMore ? conversations.slice(0, -1) : conversations;

      // Sort messages within each conversation
      const sortedConversations = conversationsToSend.map(conv => ({
        ...conv,
        messages: conv.messages.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
      }));

      res.status(200).json({
        conversations: sortedConversations.reverse(),
        hasMore
      });
    } catch (error) {
      console.error('Error retrieving conversations:', error);
      res.status(500).json({ error: 'Failed to retrieve conversations' });
    }
  } else {
    res.status(405).end();
  }
}
