import { IncomingForm } from 'formidable';
import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth/[...nextauth]";
import prisma from '../../lib/prisma';
import { extractTextFromPDF } from '../../utils/pdfProcessor';
import { processImage } from '../../utils/imageProcessor';
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

  let session;
  try {
    session = await getServerSession(req, res, authOptions);
    if (!session) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const form = new IncomingForm({
      keepExtensions: true,
      maxFileSize: 10 * 1024 * 1024, // 10MB limit
    });

    return new Promise((resolve) => {
      form.parse(req, async (err, fields, files) => {
        if (err) {
          console.error('Form parse error:', err);
          res.status(500).json({ error: 'Upload failed' });
          return resolve();
        }

        try {
          const file = files.file?.[0];
          if (!file) {
            res.status(400).json({ error: 'No file uploaded' });
            return resolve();
          }

          const isImage = file.mimetype.startsWith('image/');
          const isPdf = file.mimetype === 'application/pdf';

          if (!isImage && !isPdf) {
            res.status(400).json({ 
              error: 'Invalid file type. Only images and PDFs are supported.' 
            });
            return resolve();
          }

          // Process file content based on type
          let content;
          try {
            if (isImage) {
              const base64Content = await processImage(file.filepath);
              content = base64Content; // Store base64 string directly
            } else if (isPdf) {
              const pdfText = await extractTextFromPDF(file.filepath);
              content = typeof pdfText === 'string' ? pdfText : JSON.stringify(pdfText);
            }

            if (!content) {
              throw new Error('Failed to process file content');
            }
          } catch (processError) {
            console.error('File processing error:', processError);
            throw new Error('Failed to process file content');
          }

          // Save to database with proper content handling
          const uploadedFile = await prisma.uploadedFile.create({
            data: {
              userId: session.user.id,
              fileName: file.originalFilename,
              fileType: file.mimetype,
              fileSize: file.size,
              filePath: null,        // Add this line with null value since we don't store files
              content: content || '',
              threadId: fields.threadId?.[0] || null,
              conversationId: fields.conversationId?.[0] || null,
            }
          });

          // Clean up temp file
          try {
            if (file.filepath && fs.existsSync(file.filepath)) {
              fs.unlinkSync(file.filepath);
            }
          } catch (cleanupErr) {
            console.error('Error cleaning up temporary file:', cleanupErr);
          }

          res.status(200).json({ 
            success: true, 
            file: {
              id: uploadedFile.id,
              type: file.mimetype,
              name: file.originalFilename,
              content: isImage ? content : undefined, // Only send back image content
              isImage,
              isPdf 
            }
          });
        } catch (error) {
          console.error('Upload error:', error);
          res.status(500).json({ error: 'Upload failed' });
        }
        return resolve();
      });
    });
  } catch (error) {
    console.error('Server error:', error);
    res.status(500).json({ error: 'Server error' });
  }
}
