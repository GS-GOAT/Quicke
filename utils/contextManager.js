const MAX_CONTEXT_MESSAGES = 3; // Sliding window size

export function formatContextForModel(messages) {
  if (!messages || messages.length === 0) return [];

  // Take only the last MAX_CONTEXT_MESSAGES messages
  const recentMessages = messages.slice(-MAX_CONTEXT_MESSAGES);

  return recentMessages.map(msg => {
    // For assistant messages, parse the stored JSON content
    if (msg.role === 'assistant') {
      try {
        const parsed = JSON.parse(msg.content);
        return {
          role: 'assistant',
          content: parsed.text,
          model: parsed.model
        };
      } catch (e) {
        return null;
      }
    }

    // For user messages, return as is
    return {
      role: 'user',
      content: msg.content
    };
  }).filter(Boolean); // Remove any null entries
}

export async function getConversationContext(prisma, conversationId, threadId) {
  try {
    if (threadId) {
      // Get the current conversation to determine its timestamp
      const currentConversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
        select: { createdAt: true }
      });

      // Get the last 3 conversations and their messages
      const conversations = await prisma.conversation.findMany({
        where: {
          threadId: threadId,
          ...(currentConversation ? {
            createdAt: { lt: currentConversation.createdAt }
          } : {})
        },
        orderBy: {
          createdAt: 'desc'
        },
        take: 3,
        include: {
          messages: {
            orderBy: { createdAt: 'asc' }
          }
        }
      });

      // Flatten and order messages chronologically
      const contextMessages = conversations
        .reverse() // Reverse to get oldest first
        .flatMap(conv => conv.messages)
        .filter(msg => msg.conversationId !== conversationId); // Exclude current conversation

      return formatContextForModel(contextMessages);
    }

    // If no threadId, get messages from current conversation
    const messages = await prisma.message.findMany({
      where: {
        conversationId: conversationId
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: MAX_CONTEXT_MESSAGES
    });

    return formatContextForModel(messages.reverse()); // Maintain chronological order
  } catch (error) {
    return [];
  }
}
