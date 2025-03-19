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
    const { prompt, responses, threadId } = req.body;
    
    // Only proceed if there are valid responses to save
    if (Object.keys(responses).length === 0) {
      return res.status(400).json({ error: 'No valid responses to save' });
    }

    // If no threadId is provided, create a new thread
    let actualThreadId = threadId;
    
    if (!actualThreadId) {
      // Create a title from the first line or first few words of the prompt
      let title = prompt.split('\n')[0].trim();
      if (title.length > 50) {
        title = title.substring(0, 47) + "...";
      }
      
      const thread = await prisma.thread.create({
        data: {
          userId: session.user.id,
          title,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      });
      actualThreadId = thread.id;
      
      // Check thread count and remove oldest if > 5
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
    } else {
      // Update thread's updatedAt time
      await prisma.thread.update({
        where: { id: actualThreadId },
        data: { updatedAt: new Date() }
      });
    }

    const conversation = await prisma.conversation.create({
      data: {
        userId: session.user.id,
        threadId: actualThreadId,
        createdAt: new Date(),
        messages: {
          create: [
            {
              role: 'user',
              content: prompt,
              createdAt: new Date()
            },
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

    res.status(201).json({ 
      conversation,
      threadId: actualThreadId
    });
  } catch (error) {
    console.error('Error saving conversation:', error);
    res.status(500).json({ error: 'Failed to save conversation' });
  }
}
