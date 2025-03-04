import { OpenAI } from 'openai';
import { Anthropic } from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { verifyRequest } from './auth/verifyRequest';

// Initialize API clients
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

// Initialize OpenRouter client
const openRouter = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY,
  defaultHeaders: {
    'HTTP-Referer': process.env.NEXT_PUBLIC_URL || 'http://localhost:3000',
    'X-Title': 'Quicke - LLM Response Comparison'
  }
});

// Map of OpenRouter model IDs
const openRouterModels = {
  'mistral-medium': 'mistralai/mistral-medium',
  'mixtral': 'mistralai/mixtral-8x7b',
  'llama2-70b': 'meta-llama/llama-2-70b-chat',
  'solar': 'upstage/solar-0-70b-16bit',
  'phi2': 'microsoft/phi-2',
  'qwen': 'qwen/qwen1.5-72b',
  'openchat': 'openchat/openchat-3.5-0106',
};

export default async function handler(req, res) {
  // Only allow GET requests for SSE
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Basic request verification
  if (!verifyRequest(req)) {
    return res.status(403).json({ error: 'Unauthorized request' });
  }

  const { prompt, models } = req.query;
  const modelArray = models ? models.split(',') : [];

  // Setup Server-Sent Events
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  // Helper function to send SSE
  const sendEvent = (data) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  try {
    // Start processing each model
    const modelPromises = [];

    // Process standard API models
    if (modelArray.includes('gpt-4')) {
      const openaiStream = async () => {
        try {
          const stream = await openai.chat.completions.create({
            model: 'gpt-4',
            messages: [{ role: 'user', content: prompt }],
            stream: true,
          });

          let text = '';
          
          for await (const chunk of stream) {
            if (chunk.choices[0]?.delta?.content) {
              text += chunk.choices[0].delta.content;
              sendEvent({ model: 'gpt-4', text });
            }
          }
          
          sendEvent({ model: 'gpt-4', text, done: true });
        } catch (error) {
          console.error('OpenAI streaming error:', error);
          sendEvent({ model: 'gpt-4', error: error.message });
        }
      };
      
      modelPromises.push(openaiStream());
    }

    if (modelArray.includes('claude')) {
      const claudeStream = async () => {
        try {
          const stream = await anthropic.messages.create({
            model: 'claude-3-sonnet-20240229',
            max_tokens: 1000,
            messages: [{ role: 'user', content: prompt }],
            stream: true,
          });

          let text = '';
          
          for await (const chunk of stream) {
            if (chunk.type === 'content_block_delta' && chunk.delta.text) {
              text += chunk.delta.text;
              sendEvent({ model: 'claude', text });
            }
          }
          
          sendEvent({ model: 'claude', text, done: true });
        } catch (error) {
          console.error('Claude streaming error:', error);
          sendEvent({ model: 'claude', error: error.message });
        }
      };
      
      modelPromises.push(claudeStream());
    }

    // Process OpenRouter models
    for (const modelId of modelArray) {
      if (openRouterModels[modelId]) {
        const openRouterStream = async () => {
          try {
            const stream = await openRouter.chat.completions.create({
              model: openRouterModels[modelId],
              messages: [{ role: 'user', content: prompt }],
              stream: true,
              temperature: 0.7,
            });

            let text = '';
            
            for await (const chunk of stream) {
              if (chunk.choices[0]?.delta?.content) {
                text += chunk.choices[0].delta.content;
                sendEvent({ model: modelId, text });
              }
            }
            
            sendEvent({ model: modelId, text, done: true });
          } catch (error) {
            console.error(`OpenRouter (${modelId}) streaming error:`, error);
            sendEvent({ model: modelId, error: error.message });
          }
        };
        
        modelPromises.push(openRouterStream());
      }
    }

    if (modelArray.includes('gemini')) {
      const geminiStream = async () => {
        try {
          const modelOptions = ['gemini-1.0-pro', 'gemini-pro', 'gemini-1.5-pro', 'gemini-1.5-flash'];
          let success = false;
          
          for (const modelName of modelOptions) {
            try {
              console.log(`Attempting to use Gemini model: ${modelName}`);
              const geminiModel = genAI.getGenerativeModel({ model: modelName });
              
              const generateConfig = {
                stream: true,
              };
              
              const result = await geminiModel.generateContentStream(prompt, generateConfig);
              
              let text = '';
              for await (const chunk of result.stream) {
                const chunkText = chunk.text();
                if (chunkText) {
                  text += chunkText;
                  sendEvent({ model: 'gemini', text });
                }
              }
              
              sendEvent({ model: 'gemini', text, done: true });
              success = true;
              break;
            } catch (err) {
              console.error(`Error with Gemini model ${modelName}:`, err);
            }
          }
          
          if (!success) {
            throw new Error('All Gemini model attempts failed');
          }
        } catch (error) {
          console.error('Gemini streaming error:', error);
          sendEvent({ model: 'gemini', error: `${error.message} - Please check your API key and model access.` });
        }
      };
      
      modelPromises.push(geminiStream());
    }

    // Wait for all streams to complete
    await Promise.all(modelPromises);
    
    // Send final done event
    sendEvent({ done: true });
    res.end();
  } catch (error) {
    console.error('Streaming error:', error);
    sendEvent({ error: 'Failed to process streaming requests' });
    res.end();
  }
} 