/**
 * Share Card Generator
 * 
 * Generates shareable P&L cards using Puppeteer
 * Supports 5 edition tiers: Black, Ruby, Emerald, Sapphire, Diamond
 */

import fs from 'fs/promises';
import path from 'path';
import puppeteer from 'puppeteer';

export type Edition = 'black' | 'ruby' | 'emerald' | 'sapphire' | 'diamond';

export interface UserStats {
  username: string;
  avatarUrl?: string;
  totalProfit: number;
  returnPercent: number;
  winRate: number;
  totalTrades: number;
  bestTrade: number;
  profitFactor: number;
}

export interface ShareCardOptions {
  edition: Edition;
  stats: UserStats;
}

/**
 * Calculate edition tier based on user stats
 */
export function calculateEdition(totalTrades: number, winRate: number): Edition {
  if (totalTrades >= 100 && winRate >= 90) return 'diamond';
  if (totalTrades >= 75 || winRate >= 80) return 'sapphire';
  if (totalTrades >= 50) return 'emerald';
  if (totalTrades >= 26) return 'ruby';
  return 'black';
}

/**
 * Get edition metadata
 */
function getEditionMeta(edition: Edition): { name: string; number: string; subtitle: string } {
  const meta = {
    black: { name: 'Limited Edition', number: '0042', subtitle: 'Elite Options Trader' },
    ruby: { name: 'Ruby Edition', number: '26', subtitle: 'Rising Star Trader' },
    emerald: { name: 'Emerald Edition', number: '50', subtitle: 'Veteran Trader' },
    sapphire: { name: 'Sapphire Edition', number: '75', subtitle: 'Master Trader' },
    diamond: { name: 'Diamond Edition', number: '100', subtitle: 'Legendary Trader' },
  };
  return meta[edition];
}

/**
 * Format number as currency
 */
function formatCurrency(amount: number): string {
  const sign = amount >= 0 ? '+' : '-';
  const abs = Math.abs(amount);
  
  if (abs >= 1000000) {
    return `${sign}$${(abs / 1000000).toFixed(2)}M`;
  } else if (abs >= 1000) {
    return `${sign}$${(abs / 1000).toFixed(1)}k`;
  } else {
    return `${sign}$${abs.toFixed(0)}`;
  }
}

/**
 * Escape special regex characters
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Load and populate HTML template
 */
async function loadTemplate(edition: Edition, stats: UserStats): Promise<string> {
  const templatePath = path.join(process.cwd(), 'lib', 'templates', `${edition}-edition.html`);
  
  try {
    let html = await fs.readFile(templatePath, 'utf-8');
    
    // FIX: Replace Apple-specific font with generic font stack for production compatibility
    // More robust replacement that handles different formatting
    html = html.replace(
      /font-family\s*:\s*['"]?SF Pro Display['"]?\s*,\s*['"]?-apple-system['"]?\s*,\s*['"]?BlinkMacSystemFont['"]?\s*,\s*['"]?sans-serif['"]?\s*;/gi,
      "font-family: 'Segoe UI', 'Roboto', 'Helvetica Neue', Arial, sans-serif;"
    );
    
    // Also replace any standalone 'SF Pro Display' references
    html = html.replace(
      /['"]SF Pro Display['"]/gi,
      "'Segoe UI'"
    );
    
    const meta = getEditionMeta(edition);
    
    // Replace placeholders
    const replacements: Record<string, string> = {
      'Hunter Manes': stats.username,
      'Elite Options Trader': meta.subtitle,
      'Limited Edition #0042': `${meta.name} #${meta.number}`,
      
      // P&L values
      '$12,847': formatCurrency(stats.totalProfit),
      '+247% Return': `+${stats.returnPercent}% Return`,
      
      // Metrics
      '94%': `${stats.winRate}%`,
      '158': stats.totalTrades.toString(),
      '$1,142': formatCurrency(stats.bestTrade),
      '4.8x': `${stats.profitFactor.toFixed(1)}x`,
    };
    
    // Apply replacements
    for (const [find, replace] of Object.entries(replacements)) {
      html = html.replace(new RegExp(escapeRegex(find), 'g'), replace);
    }
    
    // Avatar URL handling
    if (stats.avatarUrl) {
      // Replace avatar placeholder with actual image
      html = html.replace(
        /<div class="avatar"><\/div>/g,
        `<div class="avatar" style="background-image: url('${stats.avatarUrl}'); background-size: cover; background-position: center;"></div>`
      );
    }
    
    return html;
  } catch (error: any) {
    console.error(`Failed to load template for edition ${edition}:`, error.message);
    throw new Error(`Template file not found or cannot be read: ${templatePath}`);
  }
}

/**
 * Generate share card PNG
 * 
 * @param options - Card generation options
 * @returns Base64-encoded PNG image
 */
export async function generateShareCard(options: ShareCardOptions): Promise<string> {
  const { edition, stats } = options;
  
  console.log(`Generating share card for ${stats.username}, edition: ${edition}`);
  
  // Load and populate template
  const html = await loadTemplate(edition, stats);
  
  // Launch Puppeteer with production-friendly configuration
  const browser = await puppeteer.launch({
    headless: true, // Use new headless mode for better compatibility
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--single-process', // Helps with memory issues on servers
      '--no-zygote',
      '--disable-web-security', // Allow external images (avatars)
      '--disable-features=site-per-process', // Disable site isolation for better compatibility
      '--disable-accelerated-2d-canvas',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-breakpad',
      '--disable-component-extensions-with-background-pages',
      '--disable-extensions',
      '--disable-features=TranslateUI',
      '--disable-ipc-flooding-protection',
      '--disable-renderer-backgrounding',
      '--disable-software-rasterizer',
      '--force-color-profile=srgb',
      '--hide-scrollbars',
      '--metrics-recording-only',
      '--mute-audio',
      '--no-first-run',
      '--no-default-browser-check',
    ],
    defaultViewport: null,
  });
  
  try {
    const page = await browser.newPage();
    
    // Set viewport for Retina quality (2x)
    await page.setViewport({
      width: 600,
      height: 800,
      deviceScaleFactor: 2, // 2x for Retina displays
    });
    
    // Enable request interception to handle external resources
    await page.setRequestInterception(true);
    
    page.on('request', (request) => {
      // Block unnecessary resources to speed up loading
      const resourceType = request.resourceType();
      if (['image', 'font', 'stylesheet'].includes(resourceType)) {
        // Allow images (including avatars), fonts, and stylesheets
        request.continue();
      } else if (resourceType === 'document') {
        request.continue();
      } else {
        // Block other resources (scripts, media, etc.)
        request.abort();
      }
    });
    
    // Handle failed requests gracefully
    page.on('requestfailed', (request) => {
      console.warn(`Request failed: ${request.url()} - ${request.failure()?.errorText}`);
      // Don't fail the whole process if an avatar fails to load
    });
    
    // Load HTML content with longer timeout for production
    await page.setContent(html, {
      waitUntil: 'networkidle0',
      timeout: 30000, // 30 second timeout for slow networks
    });
    
    // Wait for animations to settle and ensure fonts are loaded
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Take screenshot with timeout
    const screenshot = await page.screenshot({
      type: 'png',
      encoding: 'base64',
      fullPage: false,
    }).catch(async (error) => {
      console.error('Screenshot failed, trying alternative method:', error.message);
      
      // Try alternative: capture viewport only
      return await page.screenshot({
        type: 'png',
        encoding: 'base64',
        clip: { x: 0, y: 0, width: 600, height: 800 },
      });
    });
    
    console.log(`Successfully generated share card for ${stats.username}`);
    
    return screenshot as string;
  } catch (error: any) {
    console.error('Error generating share card:', error.message);
    console.error('Stack trace:', error.stack);
    throw error;
  } finally {
    await browser.close().catch(error => {
      console.error('Error closing browser:', error.message);
    });
  }
}

/**
 * Generate share card and save to file
 * 
 * @param options - Card generation options
 * @param outputPath - Path to save PNG file
 * @returns Path to saved file
 */
export async function generateShareCardFile(
  options: ShareCardOptions,
  outputPath: string
): Promise<string> {
  const base64Image = await generateShareCard(options);
  const buffer = Buffer.from(base64Image, 'base64');
  
  // Ensure directory exists
  const dir = path.dirname(outputPath);
  await fs.mkdir(dir, { recursive: true });
  
  // Write file
  await fs.writeFile(outputPath, buffer);
  
  return outputPath;
}
