#!/bin/bash

# Initialize Meridian Dashboard Database
# Run this once to create the multi-tenant schema

set -e

echo "🔧 Initializing Meridian Dashboard Database..."

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo "❌ ERROR: DATABASE_URL environment variable not set"
    echo "Set it in .env.local or export it:"
    echo "  export DATABASE_URL='postgresql://user:password@host:port/database'"
    exit 1
fi

echo "📊 Creating tables..."

# Run the schema
psql "$DATABASE_URL" < "$(dirname "$0")/../lib/db/schema.sql"

echo "✅ Database initialized successfully!"
echo ""
echo "Tables created:"
echo "  - users (Discord auth)"
echo "  - accounts (trading accounts)"
echo "  - trades (user trades)"
echo ""
echo "Views created:"
echo "  - user_portfolio_summary"
echo ""
echo "🚀 Ready to use multi-tenant dashboard!"
