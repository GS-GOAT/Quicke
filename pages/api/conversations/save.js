import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import prisma from '../../../lib/prisma';
  
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const session = await getServerSession(req, res, authOptions);
    if (!session) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { id, prompt, responses, threadId, fileId } = req.body;

    if (!id) {
      return res.status(400).json({ error: 'Conversation ID is required' });
    }

    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    console.log(`API: Saving conversation ${id} with ${Object.keys(responses || {}).length} responses`);
    console.log(`Thread ID: ${threadId || 'none'}`);
    
    // Check if a threadId was provided
    let targetThreadId = threadId;
    
    // If no threadId was provided, create a new thread
    if (!targetThreadId) {
      console.log('No thread ID provided, creating a new thread');
      const newThread = await prisma.thread.create({
        data: {
          title: prompt.substring(0, 100) || 'New Conversation',
          userId: session.user.id
        }
      });
      targetThreadId = newThread.id;
      console.log(`Created new thread with ID ${targetThreadId}`);
    } else {
      // Verify the thread exists and belongs to the user
      const existingThread = await prisma.thread.findUnique({
        where: {
          id: targetThreadId,
          userId: session.user.id
        }
      });
      
      if (!existingThread) {
        console.log(`Thread ${targetThreadId} not found or not owned by user ${session.user.id}, creating new thread`);
        const newThread = await prisma.thread.create({
          data: {
            title: prompt.substring(0, 100) || 'New Conversation',
            userId: session.user.id
          }
        });
        targetThreadId = newThread.id;
      }
    }

    // Create or update the conversation
    const conversation = await prisma.conversation.upsert({
      where: { id },
      update: {
        threadId: targetThreadId,
        messages: {
          upsert: {
            where: { 
              id: `${id}-user`
            },
            update: {
              content: prompt,
              role: 'user'
            },
            create: {
              id: `${id}-user`,
              content: prompt,
              role: 'user'
            }
          }
        }
      },
      create: {
        id,
        threadId: targetThreadId,
        userId: session.user.id,
        messages: {
          create: {
            id: `${id}-user`,
            content: prompt,
            role: 'user'
          }
        },
        ...(fileId && { fileId })
      }
    });
    
    console.log(`Conversation ${id} created/updated in thread ${targetThreadId}`);
    
    // Process and save each model response separately
    if (responses) {
      console.log(`Processing ${Object.keys(responses).length} model responses`);
      
      for (const [modelId, response] of Object.entries(responses)) {
        if (!response || !response.text) {
          console.log(`Skipping empty response for model ${modelId}`);
          continue;
        }
        
        // Create a message with model info embedded in content
        const messageContent = JSON.stringify({
          model: modelId,
          text: response.text,
          timestamp: Date.now()
        });
        
        // For model responses, create a unique ID
        const messageId = `${id}-${modelId}`;
        
        try {
          // Save to database without modelId field
          await prisma.message.upsert({
            where: { 
              id: messageId
            },
            update: {
              content: messageContent
            },
            create: {
              id: messageId,
              conversationId: id,
              role: 'assistant',
              content: messageContent
            }
          });
          
          console.log(`Saved response for model ${modelId}`);
        } catch (error) {
          console.error(`Error saving message for model ${modelId}:`, error);
          continue; // Continue with other messages even if one fails
        }
      }
    }

    // Update the thread title if this is a new thread
    if (targetThreadId) {
      await prisma.thread.update({
        where: { id: targetThreadId },
        data: { 
          title: prompt.substring(0, 100),
          updatedAt: new Date()
        }
      });
    }

    console.log(`Successfully saved conversation ${id} to thread ${targetThreadId}`);

    // Log response details:
    for (const [modelId, response] of Object.entries(responses || {})) {
      if (response && response.text) {
        const preview = response.text.substring(0, 50) + (response.text.length > 50 ? '...' : '');
        console.log(`Saved ${modelId} response: ${preview}`);
      }
    }

    return res.status(201).json({
      id: conversation.id,
      threadId: targetThreadId
    });
  } catch (error) {
    console.error('Error saving conversation:', error);
    return res.status(500).json({ error: 'Failed to save conversation', details: error.message });
  }
}
