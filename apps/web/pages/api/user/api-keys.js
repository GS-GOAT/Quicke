import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
const { PrismaClient } = require('../../../prisma/generated-client');
const prisma = new PrismaClient();

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: "Unauthorized" });

  const userId = session.user.id;

  if (req.method === 'GET') {
    const apiKeys = await prisma.apiKey.findMany({ 
      where: { userId },
      select: { provider: true, encryptedKey: true }
    });
    res.json(apiKeys);
    
  } else if (req.method === 'POST') {
    const { provider, key } = req.body;
    
    try {
      await prisma.apiKey.upsert({
        where: {
          userId_provider: {
            userId: userId,
            provider: provider
          }
        },
        update: {
          encryptedKey: key
        },
        create: {
          userId,
          provider,
          encryptedKey: key
        }
      });
      
      res.status(200).json({ message: "API key updated successfully" });
    } catch (error) {
      console.error('API key upsert failed:', error);
      res.status(500).json({ error: "Failed to save API key" });
    }
    
  } else if (req.method === 'DELETE') {
    const { provider } = req.body;
    
    try {
      await prisma.apiKey.delete({
        where: {
          userId_provider: {
            userId: userId,
            provider: provider
          }
        }
      });
      res.status(204).end();
    } catch (error) {
      console.error('API key deletion failed:', error);
      res.status(500).json({ error: "Failed to delete API key" });
    }
    
  } else {
    res.status(405).end();
  }
}
