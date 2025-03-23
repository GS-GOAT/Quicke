import pdf from 'pdf-parse';
import fs from 'fs';
import path from 'path';

export async function extractTextFromPDF(filePath) {
  let dataBuffer = null;
  try {
    const fullPath = filePath.startsWith('/') 
      ? path.join(process.cwd(), filePath)
      : filePath;

    if (!fs.existsSync(fullPath)) {
      throw new Error('PDF file not found');
    }

    dataBuffer = await fs.promises.readFile(fullPath);
    const data = await pdf(dataBuffer);
    
    return {
      text: data.text,
      info: {
        pages: data.numpages,
        metadata: data.info
      }
    };
  } catch (error) {
    console.error('Error extracting text from PDF:', error);
    throw new Error('Failed to extract text from PDF');
  } finally {
    // Clean up buffer
    if (dataBuffer) {
      dataBuffer = null;
    }
  }
}

export async function summarizePDF(filePath, maxLength = 8000) {
  try {
    const { text, info } = await extractTextFromPDF(filePath);
    
    if (text.length <= maxLength) {
      return { text, info };
    }
    
    const truncated = text.substring(0, maxLength) + 
      `\n\n[Note: PDF content truncated (${info.pages} pages, ${text.length} characters)]`;
    
    return { text: truncated, info };
  } catch (error) {
    console.error('Error summarizing PDF:', error);
    throw error;
  }
}
