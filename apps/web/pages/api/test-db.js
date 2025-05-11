import { PrismaClient } from '@prisma/client';
const prisma = require('@quicke/db'); ;

export default async function handler(req, res) {
  try {
    const users = await prisma.user.findMany();
    res.status(200).json('Database connection successful');
  } catch (error) {
    res.status(500).json({ error: 'Database connection failed' });
  }
}
