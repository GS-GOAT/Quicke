const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { PrismaClient } = require('../../node_modules/.prisma/client');
const prisma = new PrismaClient();

const router = express.Router();

// Main route handler
router.post('/', async (req, res) => {
  try {
    const userId = req.user ? req.user.id : null;
    const { responses } = req.body;

    if (!responses) {
      return res.status(400).json({ error: 'Responses are required' });
    }

    // Get API key for Google
    let googleApiKey = null;

    if (userId) {
      // Logged-in user: fetch their specific key
      const apiKey = await prisma.apiKey.findFirst({
        where: {
          userId,
          provider: 'google'
        },
        select: { encryptedKey: true }
      });
      if (apiKey) {
        googleApiKey = apiKey.encryptedKey;
      }
    } else {
      // Guest user: use the system-wide guest key
      googleApiKey = process.env.SYSTEM_GEMINI_API_KEY; 
      if (!googleApiKey) {
         console.error('Guest Summarization Error: SYSTEM_GEMINI_API_KEY is not set in environment.');
         return res.status(500).json({ error: 'System configuration error prevents guest summarization.' });
      }
    }

    if (!googleApiKey) {
      return res.status(400).json({ error: 'Google API key required for summarization.' });
    }

    const genAI = new GoogleGenerativeAI(googleApiKey);
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-2.0-flash',
      tools: [{ 'google_search': {} }],
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.8,
        maxOutputTokens: 8000,
      },
    });

    // Format responses for summary
    const formattedResponses = Object.entries(responses)
      .map(([model, response]) => `${model}:\n${response.text}\n`)
      .join('\n---\n');

    const prompt = `Take these AI responses and provide a overall best answer with proper formatting and markdown :

${formattedResponses}

Format your answer as (seperated by horizontal lines):
 Common Points: <Key agreements between responses>
 Differences: <Notable variations in approaches>
 Final Answer: <Take all response into account and provide the best final answer to the prompt nicely formatted for clarity and readability>
`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    return res.status(200).json({ text });
  } catch (error) {
    console.error('Summary generation failed:', error);
    return res.status(500).json({ error: 'Failed to generate summary' });
  }
});

module.exports = router; 