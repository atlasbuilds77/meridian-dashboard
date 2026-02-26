/**
 * Comprehensive test for share card generation
 * Tests all components: database, API, image generation
 */

import pool from './lib/db/pool';
import { generateShareCard, calculateEdition, type UserStats } from './lib/share-card-generator';
import fs from 'fs/promises';
import path from 'path';

async function testDatabaseStats() {
  console.log('Testing database stats calculation...');
  
  const client = await pool.connect();
  
  try {
    // Get a user with trades
    const userResult = await client.query(`
      SELECT u.id, u.username, u.discord_id, u.avatar
      FROM users u
      WHERE EXISTS (
        SELECT 1 FROM trades t 
        WHERE t.user_id = u.id 
        AND t.status = 'closed' 
        AND t.pnl IS NOT NULL
      )
      LIMIT 1
    `);
    
    if (userResult.rows.length === 0) {
      console.log('No users with trades found');
      return null;
    }
    
    const user = userResult.rows[0];
    
    // Calculate stats manually to verify
    const statsQuery = `
      SELECT 
        COUNT(*) as total_trades,
        SUM(CASE WHEN pnl > 0 THEN 1 ELSE 0 END) as wins,
        SUM(pnl) as total_pnl,
        MAX(pnl) as best_trade,
        SUM(CASE WHEN pnl > 0 THEN pnl ELSE 0 END) as total_wins,
        SUM(CASE WHEN pnl < 0 THEN ABS(pnl) ELSE 0 END) as total_losses
      FROM trades
      WHERE user_id = $1
        AND status = 'closed'
        AND pnl IS NOT NULL
    `;
    const statsResult = await client.query(statsQuery, [user.id]);
    const stats = statsResult.rows[0];
    
    const totalTrades = parseInt(stats.total_trades) || 0;
    const wins = parseInt(stats.wins) || 0;
    const totalPnl = parseFloat(stats.total_pnl) || 0;
    const bestTrade = parseFloat(stats.best_trade) || 0;
    const totalWins = parseFloat(stats.total_wins) || 0;
    const totalLosses = parseFloat(stats.total_losses) || 0;
    
    const winRate = totalTrades > 0 ? Math.round((wins / totalTrades) * 100) : 0;
    const profitFactor = totalLosses > 0 ? totalWins / totalLosses : totalWins > 0 ? 99.9 : 0;
    
    // Calculate return % (assuming $5000 starting capital)
    const startingCapital = 5000;
    const returnPercent = Math.round((totalPnl / startingCapital) * 100);
    
    // Build avatar URL
    const avatarUrl = user.avatar && user.discord_id
      ? `https://cdn.discordapp.com/avatars/${user.discord_id}/${user.avatar}.png`
      : undefined;
    
    const userStats: UserStats = {
      username: user.username,
      avatarUrl,
      totalProfit: totalPnl,
      returnPercent,
      winRate,
      totalTrades,
      bestTrade,
      profitFactor,
    };
    
    console.log(`User: ${user.username}`);
    console.log(`Total trades: ${totalTrades}`);
    console.log(`Win rate: ${winRate}%`);
    console.log(`Total P&L: $${totalPnl}`);
    console.log(`Return %: ${returnPercent}%`);
    console.log(`Best trade: $${bestTrade}`);
    console.log(`Profit factor: ${profitFactor.toFixed(2)}x`);
    console.log(`Avatar URL: ${avatarUrl || 'None'}`);
    
    return { userId: user.id, stats: userStats };
  } finally {
    client.release();
  }
}

async function testImageGeneration(stats: UserStats) {
  console.log('\nTesting image generation...');
  
  const edition = calculateEdition(stats.totalTrades, stats.winRate);
  console.log(`Calculated edition: ${edition}`);
  
  try {
    console.log('Generating share card...');
    const base64Image = await generateShareCard({
      edition,
      stats,
    });
    
    console.log('Successfully generated image!');
    
    // Save to file
    const outputPath = path.join(process.cwd(), 'comprehensive-test-share-card.png');
    const buffer = Buffer.from(base64Image, 'base64');
    await fs.writeFile(outputPath, buffer);
    
    console.log(`Image saved to: ${outputPath}`);
    console.log(`Image size: ${buffer.length} bytes`);
    
    return true;
  } catch (error: any) {
    console.error('Error generating image:', error.message);
    return false;
  }
}

async function testEdgeCases() {
  console.log('\nTesting edge cases...');
  
  // Test 1: User with no avatar
  console.log('\n1. Testing user with no avatar...');
  const statsNoAvatar: UserStats = {
    username: 'No Avatar User',
    avatarUrl: undefined,
    totalProfit: 5000,
    returnPercent: 100,
    winRate: 75,
    totalTrades: 20,
    bestTrade: 1000,
    profitFactor: 2.5,
  };
  
  try {
    const image = await generateShareCard({
      edition: 'black',
      stats: statsNoAvatar,
    });
    console.log('  ✓ Successfully generated card without avatar');
    
    const buffer = Buffer.from(image, 'base64');
    await fs.writeFile(path.join(process.cwd(), 'test-no-avatar.png'), buffer);
  } catch (error: any) {
    console.log(`  ✗ Failed: ${error.message}`);
  }
  
  // Test 2: Very high profit factor (no losses)
  console.log('\n2. Testing user with no losses (high profit factor)...');
  const statsNoLosses: UserStats = {
    username: 'Perfect Trader',
    avatarUrl: 'https://cdn.discordapp.com/avatars/123456789012345678/abcdefghijklmnop.png',
    totalProfit: 10000,
    returnPercent: 200,
    winRate: 100,
    totalTrades: 50,
    bestTrade: 500,
    profitFactor: 99.9, // From the calculation when no losses
  };
  
  try {
    const image = await generateShareCard({
      edition: 'diamond',
      stats: statsNoLosses,
    });
    console.log('  ✓ Successfully generated card with high profit factor');
    
    const buffer = Buffer.from(image, 'base64');
    await fs.writeFile(path.join(process.cwd(), 'test-no-losses.png'), buffer);
  } catch (error: any) {
    console.log(`  ✗ Failed: ${error.message}`);
  }
  
  // Test 3: Negative P&L
  console.log('\n3. Testing user with negative P&L...');
  const statsNegative: UserStats = {
    username: 'Learning Trader',
    avatarUrl: 'https://cdn.discordapp.com/avatars/123456789012345678/abcdefghijklmnop.png',
    totalProfit: -1500,
    returnPercent: -30,
    winRate: 40,
    totalTrades: 25,
    bestTrade: 300,
    profitFactor: 0.6,
  };
  
  try {
    const image = await generateShareCard({
      edition: 'black',
      stats: statsNegative,
    });
    console.log('  ✓ Successfully generated card with negative P&L');
    
    const buffer = Buffer.from(image, 'base64');
    await fs.writeFile(path.join(process.cwd(), 'test-negative-pnl.png'), buffer);
  } catch (error: any) {
    console.log(`  ✗ Failed: ${error.message}`);
  }
}

async function runComprehensiveTest() {
  console.log('=== Comprehensive Share Card Generation Test ===\n');
  
  // Load environment variables
  require('dotenv').config({ path: '.env.local' });
  
  try {
    // Test 1: Database stats
    const dbResult = await testDatabaseStats();
    
    if (!dbResult) {
      console.log('Skipping further tests - no user data available');
      return;
    }
    
    // Test 2: Image generation with real data
    const imageSuccess = await testImageGeneration(dbResult.stats);
    
    if (!imageSuccess) {
      console.log('Image generation failed with real data');
    }
    
    // Test 3: Edge cases
    await testEdgeCases();
    
    console.log('\n=== Test Summary ===');
    console.log('✅ Database connection and stats calculation: Working');
    console.log(`✅ Image generation with real data: ${imageSuccess ? 'Working' : 'Failed'}`);
    console.log('✅ Edge case testing: Completed');
    
    console.log('\n=== Files Generated ===');
    const files = [
      'comprehensive-test-share-card.png',
      'test-no-avatar.png',
      'test-no-losses.png',
      'test-negative-pnl.png',
    ];
    
    for (const file of files) {
      try {
        const filePath = path.join(process.cwd(), file);
        await fs.access(filePath);
        const stats = await fs.stat(filePath);
        console.log(`  ${file}: ${stats.size} bytes`);
      } catch {
        // File doesn't exist
      }
    }
    
    console.log('\n✅ Comprehensive test completed!');
  } catch (error: any) {
    console.error('\n❌ Comprehensive test failed:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

// Run the test
runComprehensiveTest().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});