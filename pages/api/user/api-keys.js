import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { PrismaClient } from "@prisma/client";
import prisma from '../../../lib/prisma';

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  
  if (!session) return res.status(401).json({ error: "Unauthorized" });

  const userId = session.user.id;

  if (req.method === 'GET') {
    const apiKeys = await prisma.apiKey.findMany({ where: { userId } });
    res.json(apiKeys);
    
  } else if (req.method === 'POST') {
    const { provider, key } = req.body;
    await prisma.apiKey.create({
      data: { provider, encryptedKey: key, userId },
    });
    res.status(201).end();
    
  } else if (req.method === 'DELETE') {
    const { id } = req.body;
    await prisma.apiKey.delete({ where: { id } });
    res.status(204).end();
    
  } else {
    res.status(405).end();
  }
}
