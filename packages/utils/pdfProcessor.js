const pdf = require('pdf-parse');
const fs = require('fs');

async function extractTextFromPDF(filePath) {
  let dataBuffer = null;
  try {
    // Read directly from the temporary file path provided by formidable
    if (!fs.existsSync(filePath)) {
      throw new Error('PDF file not found');
    }

    dataBuffer = await fs.promises.readFile(filePath);
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

async function summarizePDF(filePath, maxLength = 8000) {
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

module.exports = {
  extractTextFromPDF,
  summarizePDF
};
