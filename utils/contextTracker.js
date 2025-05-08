/**
 * Manages conversation context across the application
 */
class ContextTracker {
  constructor() {
    this.threads = new Map();
    this.MAX_CONTEXT_CONVS = 3;
  }

  /**
   * Add a user message to the context
   */
  addUserMessage(threadId, conversationId, content) {
    const key = threadId || conversationId;
    if (!key) return;

    // Get or initialize context array for this thread/conversation
    const context = this.contextMap.get(key) || [];
    
    // Add user message
    context.push({
      role: 'user',
      content: content,
      conversationId: conversationId,
      timestamp: Date.now()
    });
    
    // Update the context
    this.contextMap.set(key, context);
  }

  /**
   * Add a model's response to the context
   */
  addModelResponse(threadId, conversationId, modelId, content) {
    const key = threadId || conversationId;
    if (!key) return;

    // Get or initialize context array for this thread/conversation
    const context = this.contextMap.get(key) || [];
    
    // Add assistant message
    context.push({
      role: 'assistant',
      content: content,
      modelId: modelId,
      conversationId: conversationId,
      timestamp: Date.now()
    });
    
    // Prune context if it's too large (keep only the most recent pairs)
    // We want to keep maxPairs * 2 messages (each pair is user + assistant)
    if (context.length > this.maxPairs * 2) {
      // Remove the oldest messages
      context.splice(0, context.length - this.maxPairs * 2);
    }
    
    // Update the context
    this.contextMap.set(key, context);
  }

  /**
   * Get the context for a specific thread or conversation
   */
  getContext(threadId, conversationId) {
    if (!threadId) return [];
    
    const thread = this.threads.get(threadId);
    if (!thread) return [];

    // Get conversations before the current one by timestamp
    const conversations = [...thread.values()]
      .filter(conv => conv.id !== conversationId)
      .sort((a, b) => b.timestamp - a.timestamp);

    // Take only the 3 most recent conversations before current one
    const recentConvs = conversations
      .slice(0, this.MAX_CONTEXT_CONVS)
      .reverse(); // Put in chronological order

    // Flatten messages from conversations
    const messages = recentConvs.flatMap(conv => {
      return conv.messages.map(msg => {
        if (msg.role === 'assistant' && typeof msg.content === 'string') {
          try {
            const parsed = JSON.parse(msg.content);
            return {
              ...msg,
              content: parsed.text || msg.content
            };
          } catch (e) {
            return msg;
          }
        }
        return msg;
      });
    });

    return messages;
  }

  /**
   * Import existing messages into the context
   */
  importMessages(threadId, messages) {
    if (!threadId || !messages.length) return;

    // Group messages by conversation
    const convMap = new Map();
    
    messages.forEach(msg => {
      if (!msg.conversationId) return;
      
      if (!convMap.has(msg.conversationId)) {
        convMap.set(msg.conversationId, {
          id: msg.conversationId,
          timestamp: new Date(msg.createdAt).getTime(),
          messages: []
        });
      }
      
      const conv = convMap.get(msg.conversationId);
      
      // Parse assistant messages
      if (msg.role === 'assistant' && typeof msg.content === 'string') {
        try {
          const parsed = JSON.parse(msg.content);
          conv.messages.push({
            ...msg,
            content: parsed.text || msg.content
          });
        } catch (e) {
          conv.messages.push(msg);
        }
      } else {
        conv.messages.push(msg);
      }
    });

    // Store in thread map
    if (!this.threads.has(threadId)) {
      this.threads.set(threadId, new Map());
    }

    const thread = this.threads.get(threadId);
    convMap.forEach((conv) => {
      thread.set(conv.id, conv);
    });

    // Keep only most recent conversations
    const sortedConvs = [...thread.entries()]
      .sort(([, a], [, b]) => b.timestamp - a.timestamp)
      .slice(0, 10);
    
    thread.clear();
    sortedConvs.forEach(([id, conv]) => thread.set(id, conv));
  }

  /**
   * Format the context for a specific model type
   */
  formatContextForModel(threadId, conversationId, currentPrompt, modelType) {
    // Get the raw context
    const context = this.getContext(threadId, conversationId);
    
    // If we have a current prompt, add it temporarily to the context
    let tempContext = [...context];
    if (currentPrompt) {
      tempContext.push({
        role: 'user',
        content: currentPrompt,
        timestamp: Date.now()
      });
    }
    
    // Format based on model type
    let formattedContext;
    switch (modelType) {
      case 'gemini':
        formattedContext = this.formatForGemini(tempContext);
        break;
      case 'anthropic':
        formattedContext = this.formatForAnthropic(tempContext);
        break;
      case 'openrouter':
        formattedContext = this.formatForOpenRouter(tempContext);
        break;
      default:
        formattedContext = this.formatForOpenAI(tempContext);
    }
    
    return formattedContext;
  }

  /**
   * Format context for OpenAI models
   */
  formatForOpenAI(context) {
    const messages = [
      { role: 'system', content: 'Role and Purpose\n\nYou are an helpful AI assistant engineered to deliver helpful, accurate, and relevant assistance across diverse topics and tasks. Your primary mission is to support users by:\n\nAnswering questions with precision and depth.\nProviding clear explanations and insights.\nGenerating creative ideas and solutions.\nAssisting with problem-solving and task planning.\n\n**Always properly format the responses for nice rendering and give horizontal rule seperating different sections for clarity and readability.**\n\nPowered by advanced language models, you are equipped to process and respond to complex, nuanced queries, making you a versatile tool for both practical and imaginative pursuits.\nfeel free to reach conclusions but be thoughful about it.\n**ALWAYS KEEP IN MIND THE PREVIOUS CONVERSATIONS AS USERS MAY SOMETIME REFER TO IT IN AMBIGUOUS QUERIES**' }
    ];
    
    context.forEach(msg => {
      messages.push({
        role: msg.role,
        content: msg.content
      });
    });
    
    return messages;
  }

  /**
   * Format context for Gemini models
   */
  formatForGemini(context) {
    // Gemini needs special formatting - it uses 'user' and 'model' roles
    const messages = [];
    
    // First add system instruction as user message if we have context
    if (context.length > 0) {
      messages.push({
        role: 'user',
        parts: [{ text: '**SYSTEM PROMPT:**\n\nRole and Purpose\n\nYou are an helpful AI assistant engineered to deliver helpful, accurate, and relevant assistance across diverse topics and tasks. Your primary mission is to support users by:\n\nAnswering questions with precision and depth.\nProviding clear explanations and insights.\nGenerating creative ideas and solutions.\nAssisting with problem-solving and task planning.\n\n**Always properly format the responses for nice rendering and give horizontal rule seperating different sections for clarity and readability. keep inline math expressions inside $ and math expressions in $$ **\n\nPowered by advanced language models, you are equipped to process and respond to complex, nuanced queries, making you a versatile tool for both practical and imaginative pursuits.\nfeel free to reach conclusions but be thoughful about it.\n**ALWAYS KEEP IN MIND THE PREVIOUS CONVERSATIONS AS USERS MAY SOMETIME REFER TO IT IN AMBIGUOUS QUERIES**' }]
      });
      
      // Add model acknowledgment
    //   messages.push({
    //     role: 'model',
    //     parts: [{ text: 'Aye Aye Captain!\nI\'ll help you with your query. while considering our conversation history for context.' }]
    //   });
    }
    
    // Convert each context message to Gemini format
    context.forEach(msg => {
      // Skip messages that have JSON objects as content
      if (!msg.content) return;
      
      // Try to detect serialized JSON content
      let content = msg.content;
      
      if (typeof content === 'string' && (content.startsWith('{') || content.includes('":"'))) {
        try {
          // Try to parse it to see if it's JSON
          const parsed = JSON.parse(content);
          
          // If it has a text field, use that instead
          if (parsed.text) {
            content = parsed.text;
          } else {
            return;
          }
        } catch (e) {
          // Not valid JSON or couldn't parse, keep original content
        }
      }
      
      // Map 'assistant' role to 'model' for Gemini
      const geminiRole = msg.role === 'user' ? 'user' : 'model';
      
      messages.push({
        role: geminiRole,
        parts: [{ text: content }]
      });
    });
    
    return messages;
  }

  /**
   * Format context for Anthropic models
   */
  formatForAnthropic(context) {
    // Anthropic uses same format as OpenAI
    return this.formatForOpenAI(context);
  }

  /**
   * Format context for OpenRouter models
   */
  formatForOpenRouter(context) {
    // OpenRouter uses same basic format as OpenAI but with a different system message
    const messages = [
      { role: 'system', content: 'Role and Purpose\n\nYou are an helpful AI assistant engineered to deliver helpful, accurate, and relevant assistance across diverse topics and tasks. Your primary mission is to support users by:\n\nAnswering questions with precision and depth.\nProviding clear explanations and insights.\nGenerating creative ideas and solutions.\nAssisting with problem-solving and task planning.\n\n**Always properly format the responses for nice rendering and give horizontal rule seperating different sections for clarity and readability.**\n\nPowered by advanced language models, you are equipped to process and respond to complex, nuanced queries, making you a versatile tool for both practical and imaginative pursuits.\nfeel free to reach conclusions but be thoughful about it.\n**ALWAYS KEEP IN MIND THE PREVIOUS CONVERSATIONS AS USERS MAY SOMETIME REFER TO IT IN AMBIGUOUS QUERIES**' }
    ];
    
    context.forEach(msg => {
      messages.push({
        role: msg.role,
        content: msg.content
      });
    });
    
    return messages;
  }

  /**
   * Clear context for a specific thread or conversation
   */
  clearContext(threadId, conversationId) {
    const key = threadId || conversationId;
    if (key) {
      this.contextMap.delete(key);
    }
  }
}

// Create a singleton instance
const contextTracker = new ContextTracker();

// Export the singleton
export default contextTracker;