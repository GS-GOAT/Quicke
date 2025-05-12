import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
const { PrismaClient } = require('../../../node_modules/.prisma/client');
const prisma = new PrismaClient();
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

  const { id } = req.query;

  try {
    const fileInfo = await prisma.uploadedFile.findFirst({
      where: {
        id: id,
        userId: session.user.id
      }
    });

    if (!fileInfo) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Check if this is an image file
    const isImage = fileInfo.fileType.startsWith('image/') || fileInfo.documentType === 'image';
    
    if (isImage && fileInfo.content) {
      // For images, return the base64 content with proper image headers
      const imageData = Buffer.from(fileInfo.content, 'base64');
      res.setHeader('Content-Type', fileInfo.fileType);
      res.setHeader('Content-Disposition', `inline; filename="${fileInfo.fileName}"`);
      res.status(200).send(imageData);
    } else {
      // For non-image files, return the content as text
      res.setHeader('Content-Type', 'text/plain');
      res.setHeader('Content-Disposition', `attachment; filename="${fileInfo.fileName}.txt"`);
      res.status(200).send(fileInfo.content || 'No content available');
    }
  } catch (error) {
    console.error('Error retrieving content:', error);
    res.status(500).json({ error: 'Failed to retrieve content' });
  }
}
