const fs = require('fs');
const sharp = require('sharp');

const processImage = async (filePath) => {
  try {
    const image = sharp(filePath);
    const metadata = await image.metadata();
    
    // Resize if image is too large while maintaining aspect ratio
    if (metadata.width > 2048 || metadata.height > 2048) {
      image.resize(2048, 2048, {
        fit: 'inside',
        withoutEnlargement: true
      });
    }
    
    // Get optimized buffer
    const buffer = await image.toBuffer();
    
    // Convert to base64
    const base64Data = buffer.toString('base64');
    return base64Data;
  } catch (error) {
    console.error('Image processing error:', error);
    throw error;
  }
};

module.exports = {
  processImage
};
