export const formatMessagesWithMedia = (prompt, fileData, modelId) => {
  if (!fileData) return [{ role: "user", content: prompt }];

  const isImage = fileData.fileType?.startsWith('image/');
  const isPdf = fileData.fileType === 'application/pdf';

  // Handle image inputs
  if (isImage) {
    // For Gemini models
    if (modelId.startsWith('gemini')) {
      return [{
        role: "user",
        parts: [
          {
            inlineData: {
              mimeType: fileData.fileType,
              data: fileData.content
            }
          },
          { text: prompt }
        ]
      }];
    }
    
    // For OpenAI and other providers
    return [{
      role: "user",
      content: [
        {
          type: "text",
          text: prompt
        },
        {
          type: "image_url",
          image_url: {
            url: `data:${fileData.fileType};base64,${fileData.content}`,
            detail: "high"
          }
        }
      ]
    }];
  }

  // Handle PDF inputs (existing code)
  if (isPdf) {
    return [{ 
      role: "user", 
      content: `${prompt}\n\nDocument content: ${fileData.content}` 
    }];
  }

  return [{ role: "user", content: prompt }];
};
