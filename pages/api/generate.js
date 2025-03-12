import { OpenAI } from 'openai';
import { Anthropic } from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth/[...nextauth]";

// Initialize API clients
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Basic request verification
  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: "Unauthorized" });

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
          console.error('OpenAI API error:', error);
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
          console.error('Anthropic API error:', error);
          results['claude'] = { error: error.message, model: 'Claude 3 Sonnet' };
        })
      );
    }

    if (models.includes('gemini')) {
      try {
        // Try different model name formats based on the API documentation
        // The format should be like 'gemini-1.0-pro' or similar
        const geminiModelOptions = [
          'gemini-2.0-flash',
        ];
        
        let geminiError = null;
        let modelUsed = '';
        
        // Try each model name until one works
        for (const modelName of geminiModelOptions) {
          try {
            console.log(`Attempting to use Gemini model: ${modelName}`);
            const geminiModel = genAI.getGenerativeModel({ model: modelName });
            
            const geminiResponse = await geminiModel.generateContent(prompt);
            results['gemini'] = {
              text: geminiResponse.response.text(),
              model: `Gemini (${modelName})`
            };
            
            // If we got here, the model worked
            modelUsed = modelName;
            geminiError = null;
            break;
          } catch (err) {
            console.error(`Error with model ${modelName}:`, err);
            geminiError = err;
          }
        }
        
        // If all model attempts failed
        if (!modelUsed && geminiError) {
          console.error('All Gemini model attempts failed, last error:', geminiError);
          results['gemini'] = { 
            error: `Failed to use any Gemini model: ${geminiError.message}. Please check your API key and available models.`,
            model: 'Gemini' 
          };
        }
      } catch (error) {
        console.error('Gemini initialization error:', error);
        results['gemini'] = { 
          error: `Failed to initialize Gemini: ${error.message}`,
          model: 'Gemini'
        };
      }
    }
    
    // Handle all OpenRouter models including DeepSeek
    const openRouterModels = Object.keys(models).filter(modelId => 
      openRouterModels[modelId] && models.includes(modelId)
    );

    if (openRouterModels.length > 0) {
      openRouterModels.forEach(modelId => {
        requests.push(
          fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              model: openRouterModels[modelId].id,
              messages: [{ role: 'user', content: prompt }]
            })
          }).then(async (response) => {
            const data = await response.json();
            results[modelId] = {
              text: data.choices[0].message.content,
              model: openRouterModels[modelId].name
            };
          }).catch(error => {
            console.error(`OpenRouter (${modelId}) API error:`, error);
            results[modelId] = { 
              error: error.message, 
              model: openRouterModels[modelId].name 
            };
          })
        );
      });
    }

    // Wait for all requests to complete
    await Promise.all(requests);
    res.status(200).json(results);
  } catch (error) {
    console.error('Error processing requests:', error);
    res.status(500).json({ error: 'Failed to process requests' });
  }
}