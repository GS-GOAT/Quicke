import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import prisma from '../../../lib/prisma';
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

    // Instead of serving the file, return the content as text
    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Content-Disposition', `attachment; filename="${fileInfo.fileName}.txt"`);
    res.status(200).send(fileInfo.content || 'No content available');
  } catch (error) {
    console.error('Error retrieving content:', error);
    res.status(500).json({ error: 'Failed to retrieve content' });
  }
}
