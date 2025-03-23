import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth/[...nextauth]";
import prisma from '../../lib/prisma';
import { extractTextFromPDF, summarizePDF } from '../../utils/pdfProcessor';
import path from 'path';
import fs from 'fs';

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

    // If content already exists, return it
    if (fileInfo.content) {
      return res.status(200).json({
        text: fileInfo.content,
        info: { pages: 0 } // Default info if not available
      });
    }

    // Otherwise extract content
    const fullPath = path.join(process.cwd(), fileInfo.filePath);
    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ error: 'Physical file not found' });
    }

    let result;
    try {
      if (summarize === 'true') {
        result = await summarizePDF(fullPath);
      } else {
        result = await extractTextFromPDF(fullPath);
      }

      // Save the extracted content
      await prisma.uploadedFile.update({
        where: { id: fileId },
        data: { 
          content: result.text,
          // Don't delete filePath until content is confirmed saved
          // filePath: null  // Remove this line
        }
      });

      res.status(200).json(result);
    } catch (extractError) {
      console.error('PDF extraction error:', extractError);
      res.status(500).json({ error: 'Failed to extract PDF content' });
    }
  } catch (error) {
    console.error('Error processing request:', error);
    res.status(500).json({ error: 'Failed to process PDF' });
  }
}
