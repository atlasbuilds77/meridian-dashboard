import { generateShareCard, type UserStats } from './lib/share-card-generator';
import fs from 'fs/promises';
import path from 'path';

async function testWithModifiedTemplate() {
  console.log('Testing with modified template (generic fonts)...');
  
  // First, let's read and modify a template to use generic fonts
  const templatePath = path.join(process.cwd(), 'lib', 'templates', 'black-edition.html');
  let template = await fs.readFile(templatePath, 'utf-8');
  
  // Replace SF Pro Display with a more generic font stack
  const modifiedTemplate = template.replace(
    "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif",
    "'Segoe UI', 'Roboto', 'Helvetica Neue', Arial, sans-serif"
  );
  
  // Write modified template to temp file
  const tempTemplatePath = path.join(process.cwd(), 'temp-black-edition.html');
  await fs.writeFile(tempTemplatePath, modifiedTemplate);
  
  // Create a modified version of the generateShareCard function that uses our temp template
  const { calculateEdition } = await import('./lib/share-card-generator');
  
  const mockStats: UserStats = {
    username: 'Test Trader',
    avatarUrl: 'https://cdn.discordapp.com/avatars/123456789012345678/abcdefghijklmnop.png',
    totalProfit: 12847,
    returnPercent: 247,
    winRate: 94,
    totalTrades: 158,
    bestTrade: 1142,
    profitFactor: 4.8,
  };
  
  const edition = calculateEdition(mockStats.totalTrades, mockStats.winRate);
  
  try {
    // Monkey-patch the loadTemplate function temporarily
    const originalLoadTemplate = require('./lib/share-card-generator').loadTemplate;
    
    // Create a simple test that uses the modified template
    const puppeteer = require('puppeteer');
    
    // Launch Puppeteer
    const browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ],
    });
    
    try {
      const page = await browser.newPage();
      
      // Set viewport
      await page.setViewport({
        width: 600,
        height: 800,
        deviceScaleFactor: 2,
      });
      
      // Load modified HTML
      await page.setContent(modifiedTemplate, {
        waitUntil: 'networkidle0',
      });
      
      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Take screenshot
      const screenshot = await page.screenshot({
        type: 'png',
        encoding: 'base64',
      });
      
      // Save to file
      const outputPath = path.join(process.cwd(), 'test-generic-font.png');
      const buffer = Buffer.from(screenshot, 'base64');
      await fs.writeFile(outputPath, buffer);
      
      console.log(`Image with generic fonts saved to: ${outputPath}`);
      console.log(`Image size: ${buffer.length} bytes`);
      
      return true;
    } finally {
      await browser.close();
      // Clean up temp file
      await fs.unlink(tempTemplatePath).catch(() => {});
    }
  } catch (error: any) {
    console.error('Error testing with modified template:', error);
    console.error('Stack trace:', error.stack);
    
    // Clean up temp file
    await fs.unlink(tempTemplatePath).catch(() => {});
    
    return false;
  }
}

// Also test with system fonts to see what happens
async function testSystemFontFallback() {
  console.log('\nTesting system font fallback...');
  
  const puppeteer = require('puppeteer');
  
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
    ],
  });
  
  try {
    const page = await browser.newPage();
    
    // Create a simple test page with the font stack
    const testHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body {
            font-family: 'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif;
            font-size: 24px;
            padding: 20px;
          }
          .test1 { font-family: 'SF Pro Display', sans-serif; }
          .test2 { font-family: -apple-system, BlinkMacSystemFont, sans-serif; }
          .test3 { font-family: Arial, sans-serif; }
        </style>
      </head>
      <body>
        <div class="test1">Test with 'SF Pro Display' (may fall back)</div>
        <div class="test2">Test with -apple-system (system UI font)</div>
        <div class="test3">Test with Arial (always available)</div>
      </body>
      </html>
    `;
    
    await page.setContent(testHtml);
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const screenshot = await page.screenshot({
      type: 'png',
      encoding: 'base64',
    });
    
    const outputPath = path.join(process.cwd(), 'test-font-fallback.png');
    const buffer = Buffer.from(screenshot, 'base64');
    await fs.writeFile(outputPath, buffer);
    
    console.log(`Font fallback test saved to: ${outputPath}`);
    
    return true;
  } finally {
    await browser.close();
  }
}

// Run tests
async function runTests() {
  console.log('Running font tests...\n');
  
  const test1 = await testWithModifiedTemplate();
  const test2 = await testSystemFontFallback();
  
  if (test1 && test2) {
    console.log('\n✅ All font tests completed successfully!');
  } else {
    console.log('\n❌ Some font tests failed!');
    process.exit(1);
  }
}

runTests().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});