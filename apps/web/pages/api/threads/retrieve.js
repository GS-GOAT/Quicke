import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
const { PrismaClient } = require('../../../prisma/generated-client');
const prisma = new PrismaClient();

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: "Unauthorized" });

  if (req.method !== 'GET') {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { id, skip } = req.query;
    if (!id) return res.status(400).json({ error: 'Thread ID is required' });

    const skipCount = parseInt(skip) || 0;
    const pageSize = 5;

    // Get thread with conversations
    const thread = await prisma.thread.findUnique({
      where: { 
        id,
        userId: session.user.id // Ensure user owns the thread
      },
      include: {
        conversations: {
          orderBy: {
            createdAt: 'asc' // Ensure chronological order
          },
          skip: skipCount,
          take: pageSize + 1, // Take one extra to check if there are more
          include: {
            messages: {
              orderBy: {
                createdAt: 'asc' // Ensure messages are also in order
              }
            }
          }
        }
      }
    });

    if (!thread) {
      return res.status(404).json({ error: 'Thread not found' });
    }

    // Check if there are more conversations
    const hasMore = thread.conversations.length > pageSize;
    
    // Only process the conversations we want to return
    const conversationsToProcess = hasMore 
      ? thread.conversations.slice(0, pageSize) 
      : thread.conversations;

    // Process conversations to match the expected format in the frontend
    const processedConversations = conversationsToProcess.map(conv => {
      const userMessage = conv.messages.find(msg => msg.role === 'user');
      
      const assistantMessages = conv.messages
        .filter(msg => msg.role === 'assistant' || msg.role === 'summary')
        .map(msg => {
          try {
            const parsed = JSON.parse(msg.content);
            return {
              ...parsed,
              role: msg.role
            };
          } catch (e) {
            console.error('Error parsing message:', msg.content);
            return null;
          }
        })
        .filter(Boolean);

      const responses = {};
      let summaryText = null;

      assistantMessages.forEach(parsed => {
        const { model, timestamp, role, ...responseData } = parsed;
        
        if (role === 'summary') {
          summaryText = responseData.text;
        } else {
          responses[model] = {
            ...responseData,
            loading: false,
            streaming: false
          };
        }
      });

      return {
        id: conv.id,
        prompt: userMessage?.content || "",
        responses,
        activeModels: Object.keys(responses).filter(model => model !== 'summary'),
        timestamp: new Date(conv.createdAt),
        isHistorical: true,
        summary: summaryText
      };
    });

    res.status(200).json({
      thread: {
        id: thread.id,
        title: thread.title,
        createdAt: thread.createdAt,
        updatedAt: thread.updatedAt
      },
      conversations: processedConversations,
      hasMore
    });
  } catch (error) {
    console.error('Error retrieving thread:', error);
    res.status(500).json({ error: 'Failed to retrieve thread' });
  }
} 