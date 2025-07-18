import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { PrismaClient } from "../../../prisma/generated-client";
import { getConversationContext } from "@quicke/utils";

const prisma = new PrismaClient();

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { threadId, conversationId } = req.query;

  if (!threadId && !conversationId) {
    return res.status(400).json({
      error: "Missing ID",
      message: "Please provide either threadId or conversationId"
    });
  }

  try {
    const context = await getConversationContext(prisma, conversationId, threadId);

    return res.status(200).json({
      success: true,
      contextSize: context.length,
      key: threadId || conversationId,
      context: context.map(msg => ({
        role: msg.role,
        content: typeof msg.content === 'string' 
          ? msg.content.substring(0, 100) + (msg.content.length > 100 ? '...' : '')
          : '[Complex content]',
        model: msg.model || 'unknown'
      }))
    });
  } catch (error) {
    console.error('Context retrieval failed:', error);
    return res.status(500).json({
      error: "Server Error",
      message: error.message
    });
  }
} 