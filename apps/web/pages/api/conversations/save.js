import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
const { PrismaClient } = require('../../../prisma/generated-client');
const prisma = new PrismaClient();

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { id, prompt, responses, threadId, fileId, fileIds, summary } = req.body;

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

      // Also update thread updatedAt if summary is added to an existing conversation
      if (updatedConversation.threadId) {
        await prisma.thread.update({
          where: { id: updatedConversation.threadId },
          data: { updatedAt: new Date() },
        });
      }

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

    // Create new conversation with connection to primary file (for backward compatibility)
    // and metadata for additional files
    const createData = {
      id,
      threadId: thread.id,
      userId: session.user.id,
      messages: {
        create: [
          {
            role: 'user',
            content: prompt
          },
          ...Object.entries(responses)
            .filter(([model, data]) => {
              // Only save if text is non-empty and no error
              return data && typeof data.text === 'string' && data.text.trim() !== '' && !data.error;
            })
            .map(([model, data]) => ({
              role: 'assistant',
              content: JSON.stringify({
                model,
                text: data.text,
                timestamp: data.timestamp
              })
            }))
        ]
      }
    };

    // If we have legacy fileId, use it for the direct relation
    if (fileId) {
      createData.fileId = fileId;
    }

    // metadata for multi-file support
    if (fileIds && fileIds.length > 0) {
      createData.metadata = JSON.stringify({
        fileIds: fileIds
      });
    }

    // Create the conversation
    const conversation = await prisma.conversation.create({
      data: createData
    });

    // Update the thread's updatedAt timestamp, unless it was just created (defaults handle that)
    if (thread) {
      await prisma.thread.update({
        where: { id: thread.id },
        data: { updatedAt: new Date() },
      });
    }

    res.status(200).json({ threadId: thread.id, conversation });
  } catch (error) {
    console.error('Error saving conversation:', error);
    res.status(500).json({ error: 'Failed to save conversation' });
  }
}
