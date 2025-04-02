import fs from 'fs';

/**
 * Extract text content from a plain text file
 * @param {string} filePath - Path to the text file
 * @returns {Promise<Object>} - Object containing the extracted text and metadata
 */
export async function extractTextFromTextFile(filePath) {
  try {
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      throw new Error('Text file not found');
    }

    // Read the file content
    const content = await fs.promises.readFile(filePath, 'utf8');
    
    // Get file stats for metadata
    const stats = fs.statSync(filePath);
    
    // Count lines
    const lineCount = content.split('\n').length;
    
    return {
      text: content,
      info: {
        lines: lineCount,
        size: stats.size,
        metadata: {
          lineCount,
          charCount: content.length,
          byteSize: stats.size
        }
      }
    };
  } catch (error) {
    console.error('Error extracting text from text file:', error);
    throw new Error('Failed to extract text from text file');
  }
}

/**
 * Summarize text file content by truncating if needed
 * @param {string} filePath - Path to the text file
 * @param {number} maxLength - Maximum character length
 * @returns {Promise<Object>} - Object containing the extracted text and metadata
 */
export async function summarizeTextFile(filePath, maxLength = 8000) {
  try {
    const { text, info } = await extractTextFromTextFile(filePath);
    
    if (text.length <= maxLength) {
      return { text, info };
    }
    
    const truncated = text.substring(0, maxLength) + 
      `\n\n[Note: Text content truncated (${info.lines} lines, ${text.length} characters)]`;
    
    return { text: truncated, info };
  } catch (error) {
    console.error('Error summarizing text file:', error);
    throw error;
  }
} 