/**
 * Share Card Generator
 * 
 * Generates shareable P&L cards using Puppeteer + Chromium
 * Works on serverless/Render environments
 */

import fs from 'fs/promises';
import path from 'path';
import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';

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

export function calculateEdition(totalTrades: number, winRate: number): Edition {
  if (totalTrades >= 100 && winRate >= 90) return 'diamond';
  if (totalTrades >= 75 || winRate >= 80) return 'sapphire';
  if (totalTrades >= 50) return 'emerald';
  if (totalTrades >= 26) return 'ruby';
  return 'black';
}

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

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function loadTemplate(edition: Edition, stats: UserStats): Promise<string> {
  const templatePath = path.join(process.cwd(), 'lib', 'templates', `${edition}-edition.html`);
  
  let html = await fs.readFile(templatePath, 'utf-8');
  
  // Replace Apple fonts with generic fonts for production
  html = html.replace(
    /font-family\s*:\s*['"]?SF Pro Display['"]?\s*,\s*['"]?-apple-system['"]?\s*,\s*['"]?BlinkMacSystemFont['"]?\s*,\s*['"]?sans-serif['"]?\s*;/gi,
    "font-family: 'Segoe UI', 'Roboto', 'Helvetica Neue', Arial, sans-serif;"
  );
  html = html.replace(/['"]SF Pro Display['"]/gi, "'Segoe UI'");
  
  const meta = getEditionMeta(edition);
  
  const replacements: Record<string, string> = {
    'Hunter Manes': stats.username,
    'Elite Options Trader': meta.subtitle,
    'Limited Edition #0042': `${meta.name} #${meta.number}`,
    '$12,847': formatCurrency(stats.totalProfit),
    '+247% Return': `+${stats.returnPercent}% Return`,
    '94%': `${stats.winRate}%`,
    '158': stats.totalTrades.toString(),
    '$1,142': formatCurrency(stats.bestTrade),
    '4.8x': `${stats.profitFactor.toFixed(1)}x`,
  };
  
  for (const [find, replace] of Object.entries(replacements)) {
    html = html.replace(new RegExp(escapeRegex(find), 'g'), replace);
  }
  
  if (stats.avatarUrl) {
    html = html.replace(
      /<div class="avatar"><\/div>/g,
      `<div class="avatar" style="background-image: url('${stats.avatarUrl}'); background-size: cover; background-position: center;"></div>`
    );
  }
  
  return html;
}

export async function generateShareCard(options: ShareCardOptions): Promise<string> {
  const { edition, stats } = options;
  
  console.log(`Generating share card for ${stats.username}, edition: ${edition}`);
  
  const html = await loadTemplate(edition, stats);
  
  // Launch browser with serverless chromium
  const browser = await puppeteer.launch({
    args: chromium.args,
    executablePath: await chromium.executablePath(),
    headless: true,
    defaultViewport: { width: 600, height: 800 },
  });
  
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    
    const screenshot = await page.screenshot({
      type: 'png',
      encoding: 'base64',
    });
    
    return screenshot as string;
  } finally {
    await browser.close();
  }
}
