import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import prisma from '../../../lib/prisma';

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: "Unauthorized" });

  const { prompt, responses } = req.body;

  if (req.method === 'POST') {
    try {
      const conversation = await prisma.conversation.create({
        data: {
          userId: session.user.id,
          messages: {
            create: [
              { role: 'user', content: prompt },
              ...Object.entries(responses).map(([model, response]) => ({
                role: 'assistant',
                content: JSON.stringify({ model, ...response })
              })),
            ],
          },
        },
        include: { messages: true },
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
