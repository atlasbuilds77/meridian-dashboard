/**
 * Share Card Generator - FIXED VERSION
 * 
 * Generates shareable P&L cards using Puppeteer
 * Supports 5 edition tiers: Black, Ruby, Emerald, Sapphire, Diamond
 * 
 * Fixes:
 * 1. Font issue: Replaced 'SF Pro Display' with generic font stack
 * 2. Added better error handling and logging
 * 3. Fixed template loading to handle missing files
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
 * Load and populate HTML template with font fix
 */
async function loadTemplate(edition: Edition, stats: UserStats): Promise<string> {
  const templatePath = path.join(process.cwd(), 'lib', 'templates', `${edition}-edition.html`);
  
  try {
    let html = await fs.readFile(templatePath, 'utf-8');
    
    // FIX: Replace Apple-specific font with generic font stack
    html = html.replace(
      /font-family:\s*'SF Pro Display',\s*-apple-system,\s*BlinkMacSystemFont,\s*sans-serif;/g,
      "font-family: 'Segoe UI', 'Roboto', 'Helvetica Neue', Arial, sans-serif;"
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
 * Generate share card PNG with improved error handling
 * 
 * @param options - Card generation options
 * @returns Base64-encoded PNG image
 */
export async function generateShareCard(options: ShareCardOptions): Promise<string> {
  const { edition, stats } = options;
  
  console.log(`Generating share card for ${stats.username}, edition: ${edition}`);
  
  // Load and populate template
  const html = await loadTemplate(edition, stats);
  
  // Launch Puppeteer with more robust configuration
  const browser = await puppeteer.launch({
    headless: 'new', // Use new headless mode
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--single-process', // Helps with memory issues
      '--no-zygote',
      '--disable-web-security', // Allow external images (avatars)
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
      // Allow all requests for now
      request.continue();
    });
    
    // Load HTML content with longer timeout
    await page.setContent(html, {
      waitUntil: 'networkidle0',
      timeout: 30000, // 30 second timeout
    });
    
    // Wait for animations to settle and ensure fonts are loaded
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Take screenshot
    const screenshot = await page.screenshot({
      type: 'png',
      encoding: 'base64',
      fullPage: false,
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