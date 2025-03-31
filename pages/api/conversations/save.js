import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import prisma from '../../../lib/prisma';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { id, prompt, responses, threadId, fileId, summary } = req.body;

  try {
    // Check if this is an update (summary) or new conversation
    const existingConversation = await prisma.conversation.findUnique({
      where: { id },
      include: { messages: true }
    });

    if (existingConversation && summary) {
      // Update existing conversation with summary
      const updatedConversation = await prisma.conversation.update({
        where: { id },
        data: {
          messages: {
            create: [{
              role: 'summary',
              content: JSON.stringify({
                model: 'summary',
                text: summary,
                timestamp: Date.now()
              })
            }]
          }
        },
        include: { messages: true }
      });

      return res.status(200).json({ 
        threadId: updatedConversation.threadId, 
        conversation: updatedConversation 
      });
    }

    // Create new thread if needed
    let thread = threadId ? await prisma.thread.findUnique({
      where: { id: threadId }
    }) : null;

    if (!thread) {
      thread = await prisma.thread.create({
        data: {
          title: prompt.substring(0, 100),
          userId: session.user.id
        }
      });
    }

    // Create new conversation
    const conversation = await prisma.conversation.create({
      data: {
        id,
        threadId: thread.id,
        userId: session.user.id,
        fileId,
        messages: {
          create: [
            {
              role: 'user',
              content: prompt
            },
            ...Object.entries(responses).map(([model, data]) => ({
              role: 'assistant',
              content: JSON.stringify({
                model,
                text: data.text,
                timestamp: data.timestamp
              })
            }))
          ]
        }
      }
    });

    res.status(200).json({ threadId: thread.id, conversation });
  } catch (error) {
    console.error('Error saving conversation:', error);
    res.status(500).json({ error: 'Failed to save conversation' });
  }
}
