import { IncomingForm } from 'formidable';
import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth/[...nextauth]";
import prisma from '../../lib/prisma';
import { extractTextFromPDF } from '../../utils/pdfProcessor';
import { extractTextFromTextFile } from '../../utils/textProcessor';
import { extractTextFromPPT } from '../../utils/pptProcessor';
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

  try {
    // Get session - with improved error handling
    const session = await getServerSession(req, res, authOptions);
    
    // Continue processing the form regardless of session status
    // We'll check for session within the form handler
    const form = new IncomingForm({
      keepExtensions: true,
      maxFileSize: 25 * 1024 * 1024, // 25MB limit
      multiples: true, // Enable multiple file uploads
    });

    return new Promise((resolve) => {
      form.parse(req, async (err, fields, files) => {
        if (err) {
          console.error('Form parse error:', err);
          res.status(500).json({ error: 'Upload failed' });
          return resolve();
        }

        try {
          // Check for session after parsing the form
          if (!session || !session.user) {
            console.error('Unauthorized upload attempt');
            res.status(401).json({ error: 'You must be logged in to upload files' });
            return resolve();
          }

          // Support both single file uploads with 'file' key and multiple files with 'file-N' indexed keys
          let allFiles = [];

          // Check for traditional single file upload
          if (files.file) {
            allFiles.push(['file', files.file]);
          }

          // Add any indexed files (file-0, file-1, etc.)
          const fileEntries = Object.entries(files).filter(([key]) => key.startsWith('file-'));
          allFiles = [...allFiles, ...fileEntries];
          
          if (allFiles.length === 0) {
            res.status(400).json({ error: 'No files uploaded' });
            return resolve();
          }

          // Calculate total size to enforce the 25MB limit
          const totalSize = allFiles.reduce((sum, [_, fileArray]) => {
            return sum + (fileArray[0]?.size || 0);
          }, 0);

          if (totalSize > 25 * 1024 * 1024) {
            res.status(400).json({ error: 'Total file size exceeds 25MB limit' });
            return resolve();
          }

          // Process each file
          const processedFiles = [];
          
          for (const [_, fileArray] of allFiles) {
            const file = fileArray[0];
            if (!file) continue;

            const isImage = file.mimetype.startsWith('image/');
            const isPdf = file.mimetype === 'application/pdf';
            const isText = file.mimetype === 'text/plain';
            const isPpt = file.mimetype === 'application/vnd.ms-powerpoint' || 
                          file.mimetype === 'application/vnd.openxmlformats-officedocument.presentationml.presentation';

            if (!isImage && !isPdf && !isText && !isPpt) {
              continue; // Skip invalid file types
            }

            // Process file content based on type
            let content;
            let fileType = '';
            try {
              if (isImage) {
                const base64Content = await processImage(file.filepath);
                content = base64Content; // Store base64 string directly
                fileType = 'image';
              } else if (isPdf) {
                const pdfData = await extractTextFromPDF(file.filepath);
                content = typeof pdfData.text === 'string' ? pdfData.text : JSON.stringify(pdfData.text);
                fileType = 'pdf';
              } else if (isText) {
                const textData = await extractTextFromTextFile(file.filepath);
                content = textData.text;
                fileType = 'text';
              } else if (isPpt) {
                const pptData = await extractTextFromPPT(file.filepath);
                content = pptData.text;
                fileType = 'ppt';
              }

              if (!content) {
                throw new Error('Failed to process file content');
              }
            } catch (processError) {
              console.error('File processing error:', processError);
              continue; // Skip files that fail processing
            }

            // Save to database with proper content handling
            const uploadedFile = await prisma.uploadedFile.create({
              data: {
                userId: session.user.id,
                fileName: file.originalFilename,
                fileType: file.mimetype,
                fileSize: file.size,
                filePath: null,
                content: content || '',
                threadId: fields.threadId?.[0] || null,
                conversationId: fields.conversationId?.[0] || null,
                documentType: fileType,
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

            // Add to processed files
            processedFiles.push({
              id: uploadedFile.id,
              type: file.mimetype,
              name: file.originalFilename,
              content: isImage ? content : undefined, // Only send back image content
              isImage,
              isPdf,
              isText,
              isPpt,
              documentType: fileType
            });
          }

          if (processedFiles.length === 0) {
            res.status(400).json({ error: 'No valid files were uploaded' });
            return resolve();
          }

          // For backward compatibility, provide both file and files in the response
          res.status(200).json({ 
            success: true, 
            files: processedFiles,
            file: processedFiles[0] // Include the first file for backward compatibility
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
