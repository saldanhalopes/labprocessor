import * as pdfjsLib from 'pdfjs-dist';

// Set worker source with multiple fallback options for robustness in different environments
try {
  // Option 1: Vite-compatible local URL
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
  ).toString();
} catch (e) {
  // Option 2: CDN fallback
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
}

/**
 * Extracts the first few pages of a PDF as base64 images.
 * @param file - the PDF file
 * @param maxPages - max pages to process
 * @returns Promise with array of base64 strings
 */
export async function extractPdfImages(file: File, maxPages: number = 3): Promise<string[]> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const numPages = Math.min(pdf.numPages, maxPages);
    const images: string[] = [];

    for (let i = 1; i <= numPages; i++) {
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale: 1.5 }); // Scale for decent quality
      
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      if (!context) continue;

      canvas.height = viewport.height;
      canvas.width = viewport.width;

      await page.render({ canvasContext: context, viewport, canvas: canvas }).promise;
      images.push(canvas.toDataURL('image/png'));
    }

    return images;
  } catch (error) {
    console.error('[pdfImages] Fatal Error extracting images:', error);
    return [];
  }
}
