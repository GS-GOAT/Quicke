import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import prisma from '../../../lib/prisma';

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: "Unauthorized" });

  if (req.method === 'GET') {
    try {
      const conversations = await prisma.conversation.findMany({
        where: { userId: session.user.id },
        include: { 
          messages: true
        },
        orderBy: { 
          createdAt: 'desc'  // Get newest first
        },
        take: 5  // Take last 5 conversations
      });

      // Sort messages within each conversation
      const sortedConversations = conversations.map(conv => ({
        ...conv,
        messages: conv.messages.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
      }));

      // Reverse the array to get oldest first
      res.status(200).json(sortedConversations.reverse());
    } catch (error) {
      console.error('Error retrieving conversations:', error);
      res.status(500).json({ error: 'Failed to retrieve conversations' });
    }
  } else {
    res.status(405).end();
  }
}
