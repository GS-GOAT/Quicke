import fs from 'fs';
import AdmZip from 'adm-zip';
import { parseStringPromise } from 'xml2js';
import path from 'path';
// We'll use a simple file reading approach since pptx-parser doesn't work server-side
// For production use, you'd want to use a more robust library like pptx-extractor or officegen

/**
 * Extract text content from a PowerPoint file
 * @param {string} filePath - Path to the PPT/PPTX file
 * @returns {Promise<Object>} - Object containing the extracted text and metadata
 */
export async function extractTextFromPPT(filePath) {
  try {
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      throw new Error('PowerPoint file not found');
    }

    // For PPTX files, we'll use the XML-based approach
    if (filePath.toLowerCase().endsWith('.pptx')) {
      return extractTextFromPPTX(filePath);
    }

    // For older PPT files, we'll retain the basic info approach
    // In a production app, you might want to use a more robust solution
    const fileStats = fs.statSync(filePath);
    const fileName = path.basename(filePath);
    
    return {
      text: `This is a legacy PowerPoint file (.ppt) that can't be parsed directly. Consider converting to PPTX format for better results.\n\nFile: ${fileName}\nSize: ${Math.round(fileStats.size / 1024)} KB`,
      info: {
        slides: 'unknown',
        metadata: {
          fileName: fileName,
          fileSize: fileStats.size,
          created: fileStats.birthtime,
          modified: fileStats.mtime
        }
      }
    };
  } catch (error) {
    console.error('Error extracting text from PowerPoint:', error);
    throw new Error('Failed to extract text from PowerPoint file');
  }
}

/**
 * Extract text from PPTX file (XML-based format)
 * @param {string} filePath - Path to the PPTX file
 * @returns {Promise<Object>} - Extracted text and metadata
 */
async function extractTextFromPPTX(filePath) {
  try {
    // PPTX files are ZIP archives containing XML files
    const zip = new AdmZip(filePath);
    
    // Get slide files
    const slideEntries = zip.getEntries().filter(entry => 
      entry.entryName.startsWith('ppt/slides/slide') && 
      entry.entryName.endsWith('.xml')
    );
    
    // Sort slides by number
    slideEntries.sort((a, b) => {
      const numA = parseInt(a.entryName.match(/slide(\d+)\.xml/)[1]);
      const numB = parseInt(b.entryName.match(/slide(\d+)\.xml/)[1]);
      return numA - numB;
    });
    
    // Get presentation props for metadata
    const corePropsEntry = zip.getEntry('docProps/core.xml');
    const appPropsEntry = zip.getEntry('docProps/app.xml');
    
    let title = '';
    let author = '';
    let slidesCount = slideEntries.length;
    
    // Extract metadata if available
    if (corePropsEntry) {
      const corePropsXml = corePropsEntry.getData().toString('utf8');
      const coreProps = await parseStringPromise(corePropsXml);
      
      title = coreProps?.['cp:coreProperties']?.['dc:title']?.[0] || '';
      author = coreProps?.['cp:coreProperties']?.['dc:creator']?.[0] || '';
    }
    
    if (appPropsEntry) {
      const appPropsXml = appPropsEntry.getData().toString('utf8');
      const appProps = await parseStringPromise(appPropsXml);
      
      slidesCount = parseInt(appProps?.['Properties']?.['Slides']?.[0]) || slideEntries.length;
    }
    
    // Extract text from each slide
    let extractedText = '';
    
    if (title) {
      extractedText += `Title: ${title}\n`;
    }
    
    if (author) {
      extractedText += `Author: ${author}\n`;
    }
    
    extractedText += `\n${slidesCount} slides found\n\n`;
    
    // Process each slide
    for (let i = 0; i < slideEntries.length; i++) {
      const slideXml = slideEntries[i].getData().toString('utf8');
      const slideObj = await parseStringPromise(slideXml);
      
      // Extract slide title if available
      extractedText += `=== Slide ${i + 1} ===\n`;
      
      // Extract text from all text elements
      const textElements = extractTextElements(slideObj);
      if (textElements.length > 0) {
        extractedText += textElements.join('\n') + '\n\n';
      } else {
        extractedText += '[No text content]\n\n';
      }
    }
    
    // Basic file stats
    const fileStats = fs.statSync(filePath);
    const fileName = path.basename(filePath);
    
    return {
      text: extractedText,
      info: {
        slides: slidesCount,
        metadata: {
          fileName,
          title,
          author,
          fileSize: fileStats.size,
          created: fileStats.birthtime,
          modified: fileStats.mtime
        }
      }
    };
  } catch (error) {
    console.error('Error extracting PPTX content:', error);
    throw error;
  }
}

/**
 * Recursively extract text elements from slide XML object
 * @param {Object} obj - Parsed XML object
 * @returns {Array<string>} - Array of text strings
 */
function extractTextElements(obj) {
  const textElements = [];
  
  // Recursively search for text in the XML structure
  function searchForText(o) {
    if (!o) return;
    
    // Handle 'a:t' elements which contain text
    if (o['a:t']) {
      const texts = Array.isArray(o['a:t']) ? o['a:t'] : [o['a:t']];
      texts.forEach(text => {
        if (typeof text === 'string') {
          textElements.push(text);
        } else if (text && text._) {
          textElements.push(text._);
        }
      });
    }
    
    // Recursively search in all object properties
    for (const key in o) {
      if (typeof o[key] === 'object') {
        searchForText(o[key]);
      }
    }
  }
  
  searchForText(obj);
  return textElements;
}

/**
 * Summarize PowerPoint content by truncating if needed
 * @param {string} filePath - Path to the PowerPoint file
 * @param {number} maxLength - Maximum character length
 * @returns {Promise<Object>} - Object containing the extracted text and metadata
 */
export async function summarizePPT(filePath, maxLength = 8000) {
  try {
    const { text, info } = await extractTextFromPPT(filePath);
    
    if (text.length <= maxLength) {
      return { text, info };
    }
    
    const truncated = text.substring(0, maxLength) + 
      `\n\n[Note: PowerPoint content truncated (${info.slides} slides)]`;
    
    return { text: truncated, info };
  } catch (error) {
    console.error('Error summarizing PowerPoint:', error);
    throw error;
  }
} 