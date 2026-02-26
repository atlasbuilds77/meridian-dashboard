import { generateShareCard, calculateEdition, type UserStats } from './lib/share-card-generator';
import fs from 'fs/promises';
import path from 'path';

async function testShareCardGeneration() {
  console.log('Testing share card generation...');
  
  // Test with mock data
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
  
  // Calculate edition based on stats
  const edition = calculateEdition(mockStats.totalTrades, mockStats.winRate);
  console.log(`Calculated edition: ${edition}`);
  
  try {
    console.log('Generating share card...');
    const base64Image = await generateShareCard({
      edition,
      stats: mockStats,
    });
    
    console.log('Successfully generated image!');
    
    // Save to file for inspection
    const outputPath = path.join(process.cwd(), 'test-share-card.png');
    const buffer = Buffer.from(base64Image, 'base64');
    await fs.writeFile(outputPath, buffer);
    
    console.log(`Image saved to: ${outputPath}`);
    console.log(`Image size: ${buffer.length} bytes`);
    
    return true;
  } catch (error: any) {
    console.error('Error generating share card:', error);
    console.error('Stack trace:', error.stack);
    return false;
  }
}

// Run the test
testShareCardGeneration()
  .then(success => {
    if (success) {
      console.log('✅ Test completed successfully!');
    } else {
      console.log('❌ Test failed!');
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });