// This file will no longer be needed since we'll use Next.js API routes.
// The functionality will be moved to /pages/api/generate.js
// Keep this file only for reference until the Next.js conversion is complete.

const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { OpenAI } = require('openai');
const { Anthropic } = require('@anthropic-ai/sdk');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Load environment variables
dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Initialize API clients
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

// Endpoint to handle LLM requests
app.post('/api/generate', async (req, res) => {
  const { prompt, models } = req.body;
  const results = {};

  try {
    // Process requests in parallel
    const requests = [];

    if (models.includes('gpt-4')) {
      requests.push(
        openai.chat.completions.create({
          model: 'gpt-4',
          messages: [{ role: 'user', content: prompt }],
        }).then(response => {
          results['gpt-4'] = {
            text: response.choices[0].message.content,
            model: 'GPT-4'
          };
        }).catch(error => {
          results['gpt-4'] = { error: error.message, model: 'GPT-4' };
        })
      );
    }

    if (models.includes('claude')) {
      requests.push(
        anthropic.messages.create({
          model: 'claude-3-sonnet-20240229',
          max_tokens: 1000,
          messages: [{ role: 'user', content: prompt }],
        }).then(response => {
          results['claude'] = {
            text: response.content[0].text,
            model: 'Claude 3 Sonnet'
          };
        }).catch(error => {
          results['claude'] = { error: error.message, model: 'Claude 3 Sonnet' };
        })
      );
    }

    if (models.includes('gemini')) {
      const geminiModel = genAI.getGenerativeModel({ model: 'gemini-pro' });
      requests.push(
        geminiModel.generateContent(prompt).then(response => {
          results['gemini'] = {
            text: response.response.text(),
            model: 'Gemini Pro'
          };
        }).catch(error => {
          results['gemini'] = { error: error.message, model: 'Gemini Pro' };
        })
      );
    }

    // Wait for all requests to complete
    await Promise.all(requests);
    res.json(results);
  } catch (error) {
    console.error('Error processing requests:', error);
    res.status(500).json({ error: 'Failed to process requests' });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 