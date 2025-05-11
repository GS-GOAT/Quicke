import { IncomingForm } from 'formidable';
import { extractTextFromPDF } from '../../utils/pdfProcessor';
import fs from 'fs';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const form = new IncomingForm({
    keepExtensions: true,
    maxFileSize: 25 * 1024 * 1024,
  });

  form.parse(req, async (err, fields, files) => {
    if (err) {
      console.error('Parse error:', err);
      return res.status(500).json({ error: 'Upload failed' });
    }

    try {
      const file = Array.isArray(files.file) ? files.file[0] : files.file;
      if (!file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      try {
        // Just test the extraction
        const result = await extractTextFromPDF(file.filepath);
        console.log('Extracted text length:', result.text.length);
        
        // Clean up
        if (fs.existsSync(file.filepath)) {
          fs.unlinkSync(file.filepath);
        }
        
        return res.status(200).json({ 
          success: true,
          textLength: result.text.length
        });
      } catch (err) {
        console.error('Processing error:', err);
        return res.status(500).json({ error: 'PDF processing failed' });
      }
    } catch (error) {
      console.error('General error:', error);
      return res.status(500).json({ error: 'Server error' });
    }
  });
} 