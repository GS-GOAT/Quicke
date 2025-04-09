import { GoogleGenerativeAI } from '@google/generative-ai';
import { getServerSession } from 'next-auth';
import { authOptions } from './auth/[...nextauth]';
import prisma from '../../lib/prisma';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const { responses } = req.body;

    // Get API key for Google
    const apiKey = await prisma.apiKey.findFirst({
      where: { 
        userId: session.user.id,
        provider: 'google'
      },
      select: { encryptedKey: true }
    });

    if (!apiKey) {
      return res.status(400).json({ error: 'Google API key required' });
    }

    const genAI = new GoogleGenerativeAI(apiKey.encryptedKey);
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-2.0-flash',
      tools: [{ 'google_search': {} }],
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.8,
        maxOutputTokens: 2000,
      },
    });

    // Format responses for summary
    const formattedResponses = Object.entries(responses)
      .map(([model, response]) => `${model}:\n${response.text}\n`)
      .join('\n---\n');

    const prompt = `Take these AI responses and provide a concise overall best answer :

${formattedResponses}

Format your answer as:
- Common Points: Key agreements between responses
- Differences: Notable variations in approaches
- Conclusion: Take all response into account and provide the best overall answer to the prompt
`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    return res.status(200).json({ text });
  } catch (error) {
    console.error('Summary generation failed:', error);
    return res.status(500).json({ error: 'Failed to generate summary' });
  }
}
