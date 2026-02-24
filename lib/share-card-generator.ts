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
  let html = await fs.readFile(templatePath, 'utf-8');
  
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
}

/**
 * Generate share card PNG
 * 
 * @param options - Card generation options
 * @returns Base64-encoded PNG image
 */
export async function generateShareCard(options: ShareCardOptions): Promise<string> {
  const { edition, stats } = options;
  
  // Load and populate template
  const html = await loadTemplate(edition, stats);
  
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
    
    // Set viewport for Retina quality (2x)
    await page.setViewport({
      width: 600,
      height: 800,
      deviceScaleFactor: 2, // 2x for Retina displays
    });
    
    // Load HTML content
    await page.setContent(html, {
      waitUntil: 'networkidle0',
    });
    
    // Wait for animations to settle
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Take screenshot
    const screenshot = await page.screenshot({
      type: 'png',
      encoding: 'base64',
    });
    
    return screenshot as string;
  } finally {
    await browser.close();
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
