import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth/[...nextauth]";
const { PrismaClient } = require('../../prisma/generated-client');
const prisma = new PrismaClient();

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { fileId, summarize } = req.query;

  try {
    const fileInfo = await prisma.uploadedFile.findFirst({
      where: {
        id: fileId,
        userId: session.user.id
      }
    });

    if (!fileInfo) {
      return res.status(404).json({ error: 'File not found' });
    }

    if (fileInfo.content) {
      return res.status(200).json({
        text: fileInfo.content,
        info: { pages: 0 } // Default info if not available
      });
    } else {
      return res.status(404).json({ error: 'No content available for this file' });
    }
  } catch (error) {
    console.error('PDF extraction failed:', error);
    res.status(500).json({ error: 'Failed to process PDF' });
  }
}
