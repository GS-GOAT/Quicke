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
          messages: {
            orderBy: {
              createdAt: 'asc'
            }
          }
        },
        orderBy: { 
          createdAt: 'asc'  // Changed to ascending to get oldest first
        },
        take: -5,  // Take last 5 conversations
      });

      res.status(200).json(conversations);
    } catch (error) {
      console.error('Error retrieving conversations:', error);
      res.status(500).json({ error: 'Failed to retrieve conversations' });
    }
  } else {
    res.status(405).end();
  }
}
