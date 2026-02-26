import { generateShareCard, calculateEdition, type UserStats } from './lib/share-card-generator-fixed';
import fs from 'fs/promises';
import path from 'path';

async function testFixedVersion() {
  console.log('Testing fixed share card generator...');
  
  // Test with mock data
  const mockStats: UserStats = {
    username: 'Test Trader Fixed',
    avatarUrl: 'https://cdn.discordapp.com/avatars/123456789012345678/abcdefghijklmnop.png',
    totalProfit: 12847,
    returnPercent: 247,
    winRate: 94,
    totalTrades: 158,
    bestTrade: 1142,
    profitFactor: 4.8,
  };
  
  // Calculate edition based on stats
  const edition = calculateEdition(mockStats.totalTrades, mockStats.winRate);
  console.log(`Calculated edition: ${edition}`);
  
  try {
    console.log('Generating share card with fixed version...');
    const base64Image = await generateShareCard({
      edition,
      stats: mockStats,
    });
    
    console.log('Successfully generated image with fixed version!');
    
    // Save to file for inspection
    const outputPath = path.join(process.cwd(), 'test-fixed-share-card.png');
    const buffer = Buffer.from(base64Image, 'base64');
    await fs.writeFile(outputPath, buffer);
    
    console.log(`Image saved to: ${outputPath}`);
    console.log(`Image size: ${buffer.length} bytes`);
    
    // Also test with different editions
    console.log('\nTesting all editions...');
    const editions: Array<Edition> = ['black', 'ruby', 'emerald', 'sapphire', 'diamond'];
    
    for (const testEdition of editions) {
      console.log(`Testing ${testEdition} edition...`);
      try {
        const testImage = await generateShareCard({
          edition: testEdition,
          stats: mockStats,
        });
        
        const testBuffer = Buffer.from(testImage, 'base64');
        const testPath = path.join(process.cwd(), `test-${testEdition}-edition.png`);
        await fs.writeFile(testPath, testBuffer);
        
        console.log(`  ✓ ${testEdition} edition saved (${testBuffer.length} bytes)`);
      } catch (error: any) {
        console.log(`  ✗ ${testEdition} edition failed: ${error.message}`);
      }
    }
    
    return true;
  } catch (error: any) {
    console.error('Error generating share card with fixed version:', error);
    console.error('Stack trace:', error.stack);
    return false;
  }
}

// Run the test
testFixedVersion()
  .then(success => {
    if (success) {
      console.log('\n✅ Fixed version test completed successfully!');
    } else {
      console.log('\n❌ Fixed version test failed!');
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });