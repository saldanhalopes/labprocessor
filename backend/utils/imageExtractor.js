import * as pdf from 'pdf-img-convert';
import fs from 'fs';
import path from 'path';

/**
 * Extracts images from a PDF base64 and saves them to a local directory.
 * @param {string} base64Data - PDF data in base64.
 * @param {string} fileId - Unique ID for the document.
 * @param {string} outputDir - Directory to save images.
 * @returns {Promise<string[]>} - List of saved image filenames.
 */
export async function extractImagesFromPdf(base64Data, fileId, outputDir = 'data/images') {
  try {
    const pdfBuffer = Buffer.from(base64Data, 'base64');
    
    // Ensure output directory exists
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    console.log(`[ImageExtractor] Extracting images from PDF for fileId: ${fileId}`);
    
    // Convert PDF to images (only first few pages for performance/storage)
    const images = await pdf.convert(pdfBuffer, {
      width: 1024,
      page_numbers: [1, 2, 3] // Limit to first 3 pages to avoid excessive storage
    });

    const savedFiles = [];
    for (let i = 0; i < images.length; i++) {
        const filename = `${fileId}_page_${i + 1}.png`;
        const filepath = path.join(outputDir, filename);
        fs.writeFileSync(filepath, images[i]);
        savedFiles.push(filename);
        console.log(`[ImageExtractor] Saved: ${filename}`);
    }

    return savedFiles;
  } catch (error) {
    console.error('[ImageExtractor] Error extracting images:', error);
    return [];
  }
}
