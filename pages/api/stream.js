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
  defaultQuery: {
    transforms: ['middle']  // Ensures consistent response format
  },
  defaultHeaders: {
    'HTTP-Referer': process.env.NEXT_PUBLIC_URL || 'http://localhost:3000',
    'X-Title': 'Quicke - LLM Response Comparison'
  }
});

// Map of OpenRouter model IDs and their display names
const openRouterModels = {
  'mistral-medium': {
    id: 'mistralai/mistral-medium',
    name: 'Mistral Medium'
  },
  'mixtral': {
    id: 'mistralai/mixtral-8x7b',
    name: 'Mixtral 8x7B'
  },
  'llama2-70b': {
    id: 'meta-llama/llama-2-70b-chat',
    name: 'Llama-2 70B'
  },
  'solar': {
    id: 'upstage/solar-0-70b-16bit',
    name: 'Solar 70B'
  },
  'phi2': {
    id: 'microsoft/phi-2',
    name: 'Phi-2'
  },
  'qwen': {
    id: 'qwen/qwen1.5-72b',
    name: 'Qwen 72B'
  },
  'openchat': {
    id: 'openchat/openchat-3.5-0106',
    name: 'OpenChat 3.5'
  }
};

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!verifyRequest(req)) {
    return res.status(403).json({ error: 'Unauthorized request' });
  }

  const { prompt, models } = req.query;
  const modelArray = models ? models.split(',') : [];

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const sendEvent = (data) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  try {
    const modelPromises = [];

    // Handle standard API models
    if (modelArray.includes('gpt-4')) {
      modelPromises.push(handleOpenAIStream('gpt-4', prompt, sendEvent));
    }

    if (modelArray.includes('claude')) {
      modelPromises.push(handleClaudeStream(prompt, sendEvent));
    }

    if (modelArray.includes('gemini')) {
      modelPromises.push(handleGeminiStream(prompt, sendEvent));
    }

    // Handle OpenRouter models
    const openRouterPromises = modelArray
      .filter(modelId => openRouterModels[modelId])
      .map(modelId => handleOpenRouterStream(modelId, prompt, sendEvent));

    modelPromises.push(...openRouterPromises);

    await Promise.all(modelPromises);
    sendEvent({ done: true });
    res.end();
  } catch (error) {
    console.error('Streaming error:', error);
    sendEvent({ error: 'Failed to process streaming requests' });
    res.end();
  }
}

async function handleOpenAIStream(model, prompt, sendEvent) {
  try {
    const stream = await openai.chat.completions.create({
      model,
      messages: [{ role: 'user', content: prompt }],
      stream: true,
    });

    let text = '';
    for await (const chunk of stream) {
      if (chunk.choices[0]?.delta?.content) {
        text += chunk.choices[0].delta.content;
        sendEvent({ model, text });
      }
    }
    sendEvent({ model, text, done: true });
  } catch (error) {
    console.error('OpenAI streaming error:', error);
    sendEvent({ model, error: error.message });
  }
}

async function handleClaudeStream(prompt, sendEvent) {
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
}

async function handleGeminiStream(prompt, sendEvent) {
  try {
    // First send an explicit loading state
    sendEvent({ model: 'gemini', loading: true, text: '' });
    
    const modelOptions = ['gemini-pro', 'gemini-1.0-pro', 'gemini-1.5-pro', 'gemini-1.5-flash'];
    let success = false;

    for (const modelName of modelOptions) {
      try {
        console.log(`Attempting to use Gemini model: ${modelName}`);
        const geminiModel = genAI.getGenerativeModel({ 
          model: modelName,
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 1024,
          }
        });
        
        try {
          // Try the streaming method first
          console.log(`Starting stream for Gemini model: ${modelName}`);
          const result = await geminiModel.generateContentStream(prompt);
          
          let text = '';
          let firstChunk = true;
          
          for await (const chunk of result.stream) {
            const chunkText = chunk.text();
            
            // Log the first chunk to debug
            if (firstChunk) {
              console.log(`First chunk received from ${modelName}:`, chunkText !== undefined ? 'has content' : 'undefined content');
              firstChunk = false;
            }
            
            if (chunkText !== undefined) {
              text += chunkText;
              // Send the updated text with each chunk
              sendEvent({ model: 'gemini', text, loading: true });
            }
          }
          
          // Final update with done flag
          if (text.length > 0) {
            console.log(`Gemini model ${modelName} succeeded with ${text.length} characters`);
            sendEvent({ model: 'gemini', text, loading: false, done: true });
            success = true;
            break;
          } else {
            console.log(`Gemini model ${modelName} returned empty response`);
          }
        } catch (streamError) {
          console.error(`Streaming error with Gemini model ${modelName}:`, streamError);
          
          // Fallback to non-streaming method if streaming fails
          try {
            console.log(`Trying non-streaming fallback for ${modelName}`);
            const response = await geminiModel.generateContent(prompt);
            const text = response.response.text();
            
            if (text && text.length > 0) {
              // For non-streaming, send one update
              sendEvent({ model: 'gemini', text, loading: false, done: true });
              console.log(`Gemini model ${modelName} succeeded with non-streaming API`);
              success = true;
              break;
            } else {
              console.log(`Gemini model ${modelName} returned empty response with non-streaming API`);
            }
          } catch (nonStreamError) {
            console.error(`Non-streaming error with Gemini model ${modelName}:`, nonStreamError);
          }
        }
      } catch (modelError) {
        console.error(`Error initializing Gemini model ${modelName}:`, modelError);
      }
    }

    if (!success) {
      console.error('All Gemini model attempts failed');
      sendEvent({ 
        model: 'gemini', 
        error: 'Failed to generate content with Gemini models. Please check your API key and quota limits.',
        loading: false,
        done: true
      });
    }
  } catch (error) {
    console.error('Gemini streaming error:', error);
    sendEvent({ 
      model: 'gemini', 
      error: `${error.message} - Please check your API key and model access.`,
      loading: false,
      done: true
    });
  }
}

async function handleOpenRouterStream(modelId, prompt, sendEvent) {
  try {
    const stream = await openRouter.chat.completions.create({
      model: openRouterModels[modelId].id,
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
} 