import { PDFDocument, rgb, StandardFonts, degrees } from 'pdf-lib';

export type WatermarkStatus = 'Approved' | 'Declined';

interface WatermarkOptions {
  status: WatermarkStatus;
  opacity?: number;
  fontSize?: number;
  rotation?: number;
}

export async function addWatermarkToPdf(
  pdfBytes: ArrayBuffer,
  options: WatermarkOptions
): Promise<ArrayBuffer> {
  const {
    status,
    opacity = 0.3,
    fontSize = 48,
    rotation = -45
  } = options;

  try {
    // Load the existing PDF
    const pdfDoc = await PDFDocument.load(pdfBytes);
    
    // Get the font
    const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    
    // Get all pages
    const pages = pdfDoc.getPages();
    
    // Define watermark properties based on status
    const watermarkText = status.toUpperCase();
    const color = status === 'Approved' 
      ? rgb(0.2, 0.7, 0.2)  // Green for approved
      : rgb(0.8, 0.2, 0.2); // Red for declined
    
    // Add watermark to each page
    pages.forEach((page) => {
      const { width, height } = page.getSize();
      
      // Calculate text dimensions
      const textWidth = font.widthOfTextAtSize(watermarkText, fontSize);
      const textHeight = font.heightAtSize(fontSize);
      
      // Position watermark in the center
      const x = (width - textWidth) / 2;
      const y = (height - textHeight) / 2;
      
      // Add the watermark text
      page.drawText(watermarkText, {
        x,
        y,
        size: fontSize,
        font,
        color,
        opacity,
        rotate: degrees(rotation),
      });
      
      // Add a second diagonal watermark for better coverage
      page.drawText(watermarkText, {
        x: x + 100,
        y: y + 100,
        size: fontSize * 0.8,
        font,
        color,
        opacity: opacity * 0.7,
        rotate: degrees(rotation),
      });
      
      // Add a third watermark
      page.drawText(watermarkText, {
        x: x - 100,
        y: y - 100,
        size: fontSize * 0.8,
        font,
        color,
        opacity: opacity * 0.7,
        rotate: degrees(rotation),
      });
    });
    
    // Serialize the PDF
    const watermarkedPdfBytes = await pdfDoc.save();
    return new Uint8Array(watermarkedPdfBytes).buffer;
    
  } catch (error) {
    console.error('Error adding watermark to PDF:', error);
    throw new Error('Failed to add watermark to PDF');
  }
}

export async function downloadWatermarkedPdf(
  pdfBytes: ArrayBuffer,
  status: WatermarkStatus,
  filename: string
): Promise<void> {
  try {
    const watermarkedBytes = await addWatermarkToPdf(pdfBytes, { status });
    
    // Create blob and download
    const blob = new Blob([watermarkedBytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `${status.toLowerCase()}_${filename}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Clean up
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Error downloading watermarked PDF:', error);
    throw error;
  }
}

export async function previewWatermarkedPdf(
  pdfBytes: ArrayBuffer,
  status: WatermarkStatus
): Promise<string> {
  try {
    const watermarkedBytes = await addWatermarkToPdf(pdfBytes, { status });
    const blob = new Blob([watermarkedBytes], { type: 'application/pdf' });
    return URL.createObjectURL(blob);
  } catch (error) {
    console.error('Error creating watermarked PDF preview:', error);
    throw error;
  }
}
