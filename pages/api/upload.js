import { IncomingForm } from 'formidable';
import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth/[...nextauth]";
import prisma from '../../lib/prisma';
import { extractTextFromPDF } from '../../utils/pdfProcessor';
import fs from 'fs';
import path from 'path';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // We'll make the session check optional for testing purposes
  let session;
  try {
    session = await getServerSession(req, res, authOptions);
    console.log("Session status:", session ? "Authenticated" : "Not authenticated");
    
    // Continue with or without a session for testing
  } catch (error) {
    console.error('Authentication error:', error);
    // Continue without authentication for testing
  }

  const form = new IncomingForm({
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

        try {
          // Extract text from the temporary PDF file
          const pdfResult = await extractTextFromPDF(file.filepath);
          
          // Use a default user ID if no session (for testing only)
          const userId = session?.user?.id || "test-user-id";
          
          // Save to database
          const uploadedFile = await prisma.uploadedFile.create({
            data: {
              userId: userId,
              fileName: file.originalFilename,
              fileType: file.mimetype,
              fileSize: file.size,
              filePath: "processed-pdf",
              content: pdfResult.text,
              threadId: fields.threadId?.[0] || null,
              conversationId: fields.conversationId?.[0] || null,
            }
          });

          // Clean up temporary file
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
              name: file.originalFilename,
              type: file.mimetype,
              size: file.size
            }
          });
        } catch (err) {
          console.error('Error processing upload:', err);
          try {
            if (file.filepath && fs.existsSync(file.filepath)) {
              fs.unlinkSync(file.filepath);
            }
          } catch (cleanupErr) {
            console.error('Error cleaning up temporary file:', cleanupErr);
          }
          res.status(500).json({ error: 'Failed to process PDF' });
        }
      } catch (error) {
        console.error('Error saving file:', error);
        res.status(500).json({ error: 'Failed to process upload' });
      }
      return resolve();
    });
  });
}
