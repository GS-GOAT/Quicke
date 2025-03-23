import { IncomingForm } from 'formidable';
import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth/[...nextauth]";
import prisma from '../../lib/prisma';
import path from 'path';
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

  const session = await getServerSession(req, res, authOptions);
  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Create base uploads directory with proper permissions
  const baseUploadDir = path.join(process.cwd(), 'uploads');
  const pdfUploadDir = path.join(baseUploadDir, 'pdfs');
  
  try {
    if (!fs.existsSync(baseUploadDir)) {
      fs.mkdirSync(baseUploadDir, { recursive: true, mode: 0o755 });
    }
    if (!fs.existsSync(pdfUploadDir)) {
      fs.mkdirSync(pdfUploadDir, { recursive: true, mode: 0o755 }); 
    }
  } catch (err) {
    console.error('Error creating upload directories:', err);
    return res.status(500).json({ error: 'Failed to initialize upload directory' });
  }

  const form = new IncomingForm({
    uploadDir: pdfUploadDir,
    keepExtensions: true,
    maxFileSize: 10 * 1024 * 1024, // 10MB limit
  });

  return new Promise((resolve, reject) => {
    form.parse(req, async (err, fields, files) => {
      if (err) {
        console.error('Form parse error:', err);
        res.status(500).json({ error: 'Upload failed' });
        return resolve();
      }

      try {
        const fileField = files.file;
        if (!fileField || (Array.isArray(fileField) && fileField.length === 0)) {
          res.status(400).json({ error: 'No file uploaded' });
          return resolve();
        }
        
        const file = Array.isArray(fileField) ? fileField[0] : fileField;
        
        if (file.mimetype !== 'application/pdf') {
          if (file.filepath && fs.existsSync(file.filepath)) {
            fs.unlinkSync(file.filepath);
          }
          res.status(400).json({ error: 'Only PDF files are allowed' });
          return resolve();
        }

        const newFileName = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}.pdf`;
        const newFilePath = path.join(pdfUploadDir, newFileName);

        try {
          // Move uploaded file to final location
          await fs.promises.rename(file.filepath, newFilePath);
          
          // Save file info to database
          const uploadedFile = await prisma.uploadedFile.create({
            data: {
              userId: session.user.id,
              fileName: file.originalFilename,
              fileType: file.mimetype,
              fileSize: file.size,
              filePath: `/uploads/pdfs/${newFileName}`,
              threadId: fields.threadId?.[0] || null,
              conversationId: fields.conversationId?.[0] || null,
            }
          });

          // Set up auto-cleanup after 24 hours
          setTimeout(() => {
            try {
              if (fs.existsSync(newFilePath)) {
                fs.unlinkSync(newFilePath);
              }
              // Also remove from database
              prisma.uploadedFile.delete({
                where: { id: uploadedFile.id }
              });
            } catch (err) {
              console.error('Error cleaning up file:', err);
            }
          }, 24 * 60 * 60 * 1000);

          res.status(200).json({ 
            success: true, 
            file: {
              id: uploadedFile.id,
              name: file.originalFilename,
              type: file.mimetype,
              size: file.size
            }
          });
        } catch (err) {
          console.error('Error processing upload:', err);
          if (fs.existsSync(file.filepath)) {
            fs.unlinkSync(file.filepath);
          }
          throw err;
        }

      } catch (error) {
        console.error('Error saving file:', error);
        res.status(500).json({ error: 'Failed to process upload' });
      }
      return resolve();
    });
  });
}
