const { generateShareCard, calculateEdition } = require('./lib/share-card-generator');

async function test() {
  console.log('Testing share card generation...');
  
  const mockStats = {
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
  console.log(`Edition: ${edition}`);
  
  try {
    console.log('Generating...');
    const base64Image = await generateShareCard({
      edition,
      stats: mockStats,
    });
    
    console.log('Success! Image size:', base64Image.length, 'chars');
    
    // Save to file
    const fs = require('fs');
    const buffer = Buffer.from(base64Image, 'base64');
    fs.writeFileSync('test-output.png', buffer);
    console.log('Saved to test-output.png');
    
  } catch (error) {
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
  }
}

test();