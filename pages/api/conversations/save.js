import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import prisma from '../../../lib/prisma';

export default async function handler(req, res) {
  // Get the session at the start
  const session = await getServerSession(req, res, authOptions);
  
  // Add detailed logging
  console.log('Save conversation request received');
  console.log('Session:', session ? 'exists' : 'missing');

  if (!session) {
    console.log('Unauthorized: No valid session');
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (req.method === 'POST') {
    try {
      const { prompt, responses } = req.body;

      // Validate input
      if (!prompt || !responses || Object.keys(responses).length === 0) {
        return res.status(400).json({ error: 'Invalid request data' });
      }

      // Create conversation with validation
      const conversation = await prisma.conversation.create({
        data: {
          userId: session.user.id,
          messages: {
            create: [
              {
                role: 'user',
                content: prompt,
              },
              ...Object.entries(responses)
                .filter(([_, response]) => response && !response.error && response.text)
                .map(([model, response]) => ({
                  role: 'assistant',
                  content: JSON.stringify({
                    model,
                    text: response.text,
                    timestamp: Date.now(),
                    duration: response.duration // Add duration to saved data
                  })
                }))
            ]
          }
        },
        include: {
          messages: true
        }
      });

      console.log('Conversation saved successfully');
      res.status(201).json(conversation);
    } catch (error) {
      console.error('Error saving conversation:', error);
      res.status(500).json({ error: 'Failed to save conversation' });
    }
  } else {
    res.status(405).end();
  }
}
