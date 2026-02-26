import pool from './lib/db/pool';

async function testDatabaseConnection() {
  console.log('Testing database connection...');
  
  const client = await pool.connect();
  
  try {
    // Test basic query
    const result = await client.query('SELECT NOW() as current_time');
    console.log('Database connection successful!');
    console.log('Current database time:', result.rows[0].current_time);
    
    // Check if users table exists
    const usersTable = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'users'
      );
    `);
    
    console.log('Users table exists:', usersTable.rows[0].exists);
    
    // Check if trades table exists
    const tradesTable = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'trades'
      );
    `);
    
    console.log('Trades table exists:', tradesTable.rows[0].exists);
    
    // Count users
    const userCount = await client.query('SELECT COUNT(*) as count FROM users');
    console.log('Total users:', userCount.rows[0].count);
    
    // Count trades
    const tradeCount = await client.query('SELECT COUNT(*) as count FROM trades');
    console.log('Total trades:', tradeCount.rows[0].count);
    
    // Get a sample user with trades
    const sampleUser = await client.query(`
      SELECT 
        u.id,
        u.username,
        u.discord_id,
        u.avatar,
        COUNT(t.id) as trade_count,
        SUM(t.pnl) as total_pnl
      FROM users u
      LEFT JOIN trades t ON u.id = t.user_id
      GROUP BY u.id, u.username, u.discord_id, u.avatar
      HAVING COUNT(t.id) > 0
      LIMIT 5
    `);
    
    console.log('\nSample users with trades:');
    sampleUser.rows.forEach((row, i) => {
      console.log(`${i + 1}. ${row.username} - ${row.trade_count} trades, P&L: $${row.total_pnl || 0}`);
    });
    
    return true;
  } catch (error: any) {
    console.error('Database connection error:', error.message);
    console.error('Stack trace:', error.stack);
    return false;
  } finally {
    client.release();
  }
}

// Run the test
testDatabaseConnection()
  .then(success => {
    if (success) {
      console.log('\n✅ Database test completed successfully!');
    } else {
      console.log('\n❌ Database test failed!');
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });