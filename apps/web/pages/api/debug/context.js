import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import contextTracker from '../../../utils/contextTracker';

export default async function handler(req, res) {
  // Ensure the user is authenticated
  const session = await getServerSession(req, res, authOptions);
  if (!session) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  // Get the thread or conversation ID from the query
  const { threadId, conversationId } = req.query;

  if (!threadId && !conversationId) {
    return res.status(400).json({
      error: "Missing ID",
      message: "Please provide either threadId or conversationId"
    });
  }

  try {
    // Get the context from the tracker
    const context = contextTracker.getContext(threadId, conversationId);

    // Return the context data
    return res.status(200).json({
      success: true,
      contextSize: context.length,
      key: threadId || conversationId,
      context: context.map(msg => ({
        role: msg.role,
        content: msg.content.substring(0, 100) + (msg.content.length > 100 ? '...' : ''),
        timestamp: new Date(msg.timestamp).toISOString(),
        conversationId: msg.conversationId
      }))
    });
  } catch (error) {
    console.error('Error retrieving context:', error);
    return res.status(500).json({
      error: "Server Error",
      message: error.message
    });
  }
} 