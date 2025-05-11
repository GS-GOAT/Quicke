const formatMessagesWithMedia = (prompt, fileDataArray = [], modelId) => {
  const isGemini = modelId && modelId.startsWith('gemini');
  prompt = prompt || ""; // Ensure prompt is at least an empty string

  if (isGemini) {
    const parts = [];
    let combinedTextContent = prompt.trim();

    // Handle array of file data
    if (Array.isArray(fileDataArray)) {
      fileDataArray.forEach(fileData => {
        if (!fileData) return;

        if (fileData.isImage && fileData.content) {
          parts.push({
            inlineData: {
              mimeType: fileData.fileType || fileData.type || 'application/octet-stream',
              data: fileData.content 
            }
          });
        } else if ((fileData.isPdf || fileData.isText || fileData.isPpt) && fileData.content) {
          combinedTextContent += `\n\n--- Document: ${fileData.fileName || 'Unnamed File'} ---\n${fileData.content}`;
        }
      });
    }
    // Handle single file data object (backward compatibility)
    else if (fileDataArray && typeof fileDataArray === 'object') {
      const fileData = fileDataArray;
      if (fileData.isImage && fileData.content) {
        parts.push({
          inlineData: {
            mimeType: fileData.fileType || fileData.type || 'application/octet-stream',
            data: fileData.content
          }
        });
      } else if ((fileData.isPdf || fileData.isText || fileData.isPpt) && fileData.content) {
        combinedTextContent += `\n\n--- Document: ${fileData.fileName || 'Unnamed File'} ---\n${fileData.content}`;
      }
    }

    // Add text part first if we have text content
    if (combinedTextContent.trim() !== "") {
      parts.unshift({ text: combinedTextContent.trim() });
    }

    // Ensure we have at least one part
    if (parts.length === 0) {
      parts.push({ text: prompt || " " });
    }

    return [{ role: "user", parts }];
  }

  // For non-Gemini models
  const messages = [{ role: "user" }];
  let currentMessage = messages[0];

  if (Array.isArray(fileDataArray) && fileDataArray.length > 0) {
    currentMessage.content = [];
    if (prompt.trim()) {
      currentMessage.content.push({ type: "text", text: prompt.trim() });
    }

    fileDataArray.forEach(fileData => {
      if (!fileData) return;

      if (fileData.isImage && fileData.content) {
        currentMessage.content.push({
          type: "image_url",
          image_url: {
            url: `data:${fileData.fileType || fileData.type || 'application/octet-stream'};base64,${fileData.content}`,
            detail: "high"
          }
        });
      } else if ((fileData.isPdf || fileData.isText || fileData.isPpt) && fileData.content) {
        const existingText = currentMessage.content.find(c => c.type === "text");
        const fileText = `\n\n--- Document: ${fileData.fileName || 'Unnamed File'} ---\n${fileData.content}`;
        
        if (existingText) {
          existingText.text += fileText;
        } else {
          currentMessage.content.push({ type: "text", text: fileText.trim() });
        }
      }
    });
  } else {
    currentMessage.content = prompt;
  }

  return messages;
};

module.exports = {
  formatMessagesWithMedia
};
