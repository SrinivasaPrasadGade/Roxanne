const fs = require('fs');
const { PDFDocument, degrees } = require('pdf-lib');

async function run() {
  try {
    const inputPath = '/tmp/outputs/40ffdcea-5cae-4a7e-a6df-fac6a20fc3b1.pdf';
    if (!fs.existsSync(inputPath)) {
      console.log('File does not exist: ', inputPath);
      return;
    }
    const pdfBytes = fs.readFileSync(inputPath);
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const pages = pdfDoc.getPages();
    console.log('Total pages:', pages.length);
    const page = pages[0];
    const rotBefore = page.getRotation();
    console.log('Rotation before:', rotBefore);
    
    // Set rotation
    page.setRotation(degrees(rotBefore.angle + 90));
    
    const rotAfter = page.getRotation();
    console.log('Rotation after set:', rotAfter);
    
    const savedBytes = await pdfDoc.save();
    console.log('Saved bytes length:', savedBytes.length);
    
    // Reload and check rotation
    const pdfDoc2 = await PDFDocument.load(savedBytes);
    const page2 = pdfDoc2.getPages()[0];
    console.log('Rotation after reload:', page2.getRotation());
  } catch (err) {
    console.error(err);
  }
}

run();
