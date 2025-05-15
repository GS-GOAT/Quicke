const express = require('express');
const formidable = require('formidable');
const fs = require('fs');
const { PrismaClient } = require('../../node_modules/.prisma/client');
const prisma = new PrismaClient();
const { 
  extractTextFromPDF,
  extractTextFromTextFile,
  extractTextFromPPT,
  processImage
} = require('@quicke/utils');

const router = express.Router();

// Main upload handler
router.post('/', async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // User ID is already available from auth middleware
    const userId = req.user.id;
    
    // Create formidable form instance
    const form = new formidable.IncomingForm({
      keepExtensions: true,
      maxFileSize: 25 * 1024 * 1024, // 25MB limit
      multiples: true, // Enable multiple file uploads
    });

    // Parse the form
    form.parse(req, async (err, fields, files) => {
      if (err) {
        console.error('Form parse error:', err);
        return res.status(500).json({ error: 'Upload failed' });
      }

      try {
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
          return res.status(400).json({ error: 'No files uploaded' });
        }

        // Calculate total size to enforce the 25MB limit
        const totalSize = allFiles.reduce((sum, [_, fileArray]) => {
          return sum + (Array.isArray(fileArray) ? fileArray[0]?.size || 0 : fileArray?.size || 0);
        }, 0);

        if (totalSize > 25 * 1024 * 1024) {
          return res.status(400).json({ error: 'Total file size exceeds 25MB limit' });
        }

        // Process each file
        const processedFiles = [];
        
        for (const [_, fileEntry] of allFiles) {
          // Handle both array format and single file format (depends on formidable version)
          const file = Array.isArray(fileEntry) ? fileEntry[0] : fileEntry;
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
              userId,
              fileName: file.originalFilename,
              fileType: file.mimetype,
              fileSize: file.size,
              filePath: null,
              content: content || '',
              threadId: fields.threadId ? (Array.isArray(fields.threadId) ? fields.threadId[0] : fields.threadId) : null,
              conversationId: fields.conversationId ? (Array.isArray(fields.conversationId) ? fields.conversationId[0] : fields.conversationId) : null,
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
          return res.status(400).json({ error: 'No valid files were uploaded' });
        }

        // For backward compatibility, provide both file and files in the response
        return res.status(200).json({ 
          success: true, 
          files: processedFiles,
          file: processedFiles[0] // Include the first file for backward compatibility
        });

      } catch (error) {
        console.error('Upload error:', error);
        return res.status(500).json({ error: 'Upload failed' });
      }
    });
  } catch (error) {
    console.error('Server error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Get user files route
router.get('/files', async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get files from database
    const files = await prisma.uploadedFile.findMany({
      where: { 
        userId 
      },
      orderBy: {
        createdAt: 'desc'
      },
      select: {
        id: true,
        fileName: true,
        fileType: true,
        documentType: true,
        createdAt: true
      }
    });
    
    return res.status(200).json({ files });
  } catch (error) {
    console.error('Error fetching user files:', error);
    return res.status(500).json({ error: 'Failed to fetch files' });
  }
});

// Delete file route
router.delete('/files/:id', async (req, res) => {
  try {
    const userId = req.user.id;
    const fileId = req.params.id;
    
    // Check if file exists and belongs to user
    const file = await prisma.uploadedFile.findFirst({
      where: {
        id: fileId,
        userId
      }
    });
    
    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    // Delete from database
    await prisma.uploadedFile.delete({
      where: {
        id: fileId
      }
    });
    
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error deleting file:', error);
    return res.status(500).json({ error: 'Failed to delete file' });
  }
});

module.exports = router; 