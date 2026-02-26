import { NextRequest } from 'next/server';
import { POST } from './app/api/share/generate/route';
import pool from './lib/db/pool';

async function testApiEndpoint() {
  console.log('Testing API endpoint...');
  
  // First, get a user ID from the database
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
      console.log('No users with trades found in database');
      return false;
    }
    
    const user = userResult.rows[0];
    console.log(`Testing with user: ${user.username} (ID: ${user.id})`);
    
    // Create a mock NextRequest
    const requestBody = {
      userId: user.id,
      // Optionally specify an edition: 'black', 'ruby', 'emerald', 'sapphire', 'diamond'
    };
    
    const request = new NextRequest('http://localhost:3001/api/share/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });
    
    console.log('Calling API endpoint...');
    
    // Call the API handler
    const response = await POST(request);
    const result = await response.json();
    
    console.log('API Response status:', response.status);
    
    if (response.ok) {
      console.log('✅ API call successful!');
      console.log('Edition:', result.edition);
      console.log('Stats:', result.stats);
      console.log('Image data present:', !!result.image);
      console.log('Image size (approx):', result.image ? result.image.length : 0, 'characters');
      
      // Save the image to a file
      if (result.image) {
        const fs = await import('fs/promises');
        const path = await import('path');
        
        // Extract base64 from data URL
        const base64Data = result.image.replace(/^data:image\/png;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');
        const outputPath = path.join(process.cwd(), 'api-generated-share-card.png');
        
        await fs.writeFile(outputPath, buffer);
        console.log(`Image saved to: ${outputPath}`);
        console.log(`Image size: ${buffer.length} bytes`);
      }
      
      return true;
    } else {
      console.log('❌ API call failed!');
      console.log('Error:', result.error);
      console.log('Details:', result.details);
      return false;
    }
  } catch (error: any) {
    console.error('Error testing API endpoint:', error);
    console.error('Stack trace:', error.stack);
    return false;
  } finally {
    client.release();
  }
}

// Run the test
testApiEndpoint()
  .then(success => {
    if (success) {
      console.log('\n✅ API endpoint test completed successfully!');
    } else {
      console.log('\n❌ API endpoint test failed!');
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });