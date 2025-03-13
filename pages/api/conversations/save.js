import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import prisma from '../../../lib/prisma';

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: "Unauthorized" });

  if (req.method === 'POST') {
    try {
      const { prompt, responses } = req.body;

      // Only proceed if there are valid responses to save
      if (Object.keys(responses).length === 0) {
        return res.status(400).json({ error: 'No valid responses to save' });
      }

      const conversation = await prisma.conversation.create({
        data: {
          userId: session.user.id,
          createdAt: new Date(),
          messages: {
            create: [
              {
                role: 'user',
                content: prompt,
                createdAt: new Date()
              },
              // Only save responses that don't have errors
              ...Object.entries(responses)
                .filter(([_, response]) => !response.error)
                .map(([model, response]) => ({
                  role: 'assistant',
                  content: JSON.stringify({ 
                    model, 
                    ...response,
                    timestamp: Date.now()
                  }),
                  createdAt: new Date()
                })),
            ],
          },
        },
        include: { 
          messages: {
            orderBy: {
              createdAt: 'asc'
            }
          }
        },
      });

      res.status(201).json(conversation);
    } catch (error) {
      console.error('Error saving conversation:', error);
      res.status(500).json({ error: 'Failed to save conversation' });
    }
  } else {
    res.status(405).end();
  }
}
