/**
 * Test to simulate production environment issues
 */

import fs from 'fs/promises';
import path from 'path';

async function simulateProductionIssues() {
  console.log('Simulating production environment issues...\n');
  
  // 1. Check if templates exist
  console.log('1. Checking template files...');
  const templates = ['black', 'ruby', 'emerald', 'sapphire', 'diamond'];
  
  for (const template of templates) {
    const templatePath = path.join(process.cwd(), 'lib', 'templates', `${template}-edition.html`);
    try {
      await fs.access(templatePath);
      const stats = await fs.stat(templatePath);
      console.log(`  ✓ ${template}-edition.html exists (${stats.size} bytes)`);
    } catch (error) {
      console.log(`  ✗ ${template}-edition.html missing!`);
    }
  }
  
  // 2. Check font availability (simulate Linux server)
  console.log('\n2. Checking font issues (simulating Linux server)...');
  console.log('   SF Pro Display is an Apple font, not available on Linux servers');
  console.log('   This causes fallback to system fonts which may look different');
  
  // 3. Check Puppeteer installation
  console.log('\n3. Checking Puppeteer installation...');
  try {
    const puppeteer = require('puppeteer');
    console.log('  ✓ Puppeteer is installed');
    
    // Try to get browser executable path
    const browserFetcher = puppeteer.createBrowserFetcher();
    const revisions = await browserFetcher.localRevisions();
    console.log(`  ✓ Browser revisions available: ${revisions.length}`);
    
    if (revisions.length === 0) {
      console.log('  ⚠️ No browser revisions found - may need to install');
    }
  } catch (error: any) {
    console.log(`  ✗ Puppeteer error: ${error.message}`);
  }
  
  // 4. Check memory/performance issues
  console.log('\n4. Checking for potential performance issues...');
  console.log('   Each Puppeteer instance uses ~100-200MB RAM');
  console.log('   Multiple concurrent requests could cause memory issues');
  console.log('   Consider using a browser pool or limiting concurrency');
  
  // 5. Check external resource loading (avatars)
  console.log('\n5. Checking external resource loading...');
  console.log('   Avatar URLs from Discord may:');
  console.log('   - Be blocked by CORS policies');
  console.log('   - Take time to load (network latency)');
  console.log('   - Return 404 if user changed avatar');
  
  // 6. Check file permissions
  console.log('\n6. Checking file permissions...');
  const templateDir = path.join(process.cwd(), 'lib', 'templates');
  try {
    const stats = await fs.stat(templateDir);
    console.log(`  ✓ Template directory accessible (mode: ${stats.mode.toString(8)})`);
  } catch (error: any) {
    console.log(`  ✗ Template directory error: ${error.message}`);
  }
  
  // 7. Check environment variables
  console.log('\n7. Checking environment variables...');
  const requiredVars = ['DATABASE_URL', 'NODE_ENV'];
  for (const varName of requiredVars) {
    if (process.env[varName]) {
      console.log(`  ✓ ${varName} is set`);
    } else {
      console.log(`  ⚠️ ${varName} is not set (may cause issues)`);
    }
  }
  
  // 8. Check for common production issues
  console.log('\n8. Common production issues to check:');
  console.log('   - Running out of memory (OOM killer)');
  console.log('   - Timeout issues (Puppeteer taking too long)');
  console.log('   - Database connection limits');
  console.log('   - Missing system dependencies (libX11, etc.)');
  console.log('   - Firewall blocking external resources');
  
  console.log('\n✅ Production simulation complete!');
  console.log('\nRecommended fixes:');
  console.log('1. Update templates to use generic fonts (already done in fixed version)');
  console.log('2. Add timeout handling and retry logic');
  console.log('3. Implement browser pooling for better performance');
  console.log('4. Add fallback for missing avatars');
  console.log('5. Add comprehensive error logging');
}

// Run the simulation
simulateProductionIssues().catch(error => {
  console.error('Error during simulation:', error);
  process.exit(1);
});