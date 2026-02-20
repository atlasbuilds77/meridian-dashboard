# Meridian Dashboard

Professional trading analytics dashboard with Discord OAuth authentication and role-based access control.

![Security Grade](https://img.shields.io/badge/Security-A--grade-brightgreen)
![License](https://img.shields.io/badge/license-MIT-blue)
![Next.js](https://img.shields.io/badge/Next.js-16-black)

---

## Features

- 🔐 **Discord OAuth Authentication** - Secure login with role-based access (Singularity tier only)
- 🔒 **JWT Session Security** - Signed sessions with 24h expiry, tamper-proof
- 📊 **Live Trading Data** - Real-time market data via Tradier API
- 💼 **Multi-Account Portfolio** - Track TopstepX, Webull, Polymarket accounts
- 📈 **Trade Analytics** - Win rate, P&L, profit factor, recent trades
- 🎨 **Modern UI** - Dark theme with BlockScout-inspired design
- ⚡ **High Performance** - Connection pooling, optimized queries
- ✅ **Input Validation** - Zod schemas prevent bad data

---

## Security Features

All critical vulnerabilities from security audit have been fixed:

- ✅ **JWT Session Signing** - Cryptographically signed sessions (jose library)
- ✅ **Connection Pooling** - pg.Pool with max 20 connections
- ✅ **Input Validation** - Zod schemas for all trade/account inputs
- ✅ **Race Condition Fixed** - Atomic user creation with INSERT ... ON CONFLICT
- ✅ **Mandatory Role Check** - Server fails if Discord env vars missing
- ✅ **Database Constraints** - SQL CHECK constraints for data integrity
- ✅ **Capped Queries** - Max 500 trades per request
- ✅ **Options P&L Fixed** - Correct 100x contract multiplier

**Security Grade: D → A-** (Production Ready)

See [SECURITY_FIXES.md](./SECURITY_FIXES.md) for full audit results.

---

## Tech Stack

- **Framework:** Next.js 16 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS v4
- **Database:** PostgreSQL (Render)
- **Authentication:** Discord OAuth + JWT
- **Validation:** Zod
- **API:** Tradier (market data)

---

## Prerequisites

1. **Discord Application** - OAuth app with redirect URIs configured
2. **PostgreSQL Database** - Render or any PostgreSQL provider
3. **Tradier API Key** - For live market data
4. **Node.js 18+** - Required for Next.js 16

---

## Environment Variables

Create `.env.local` for local development:

```bash
# Discord OAuth
DISCORD_CLIENT_ID=your_client_id
DISCORD_CLIENT_SECRET=your_client_secret
DISCORD_REDIRECT_URI=http://localhost:3000/api/auth/discord/callback

# Discord Server (REQUIRED - app fails without these)
DISCORD_GUILD_ID=your_discord_server_id
SINGULARITY_ROLE_ID=your_singularity_role_id

# Client-side
NEXT_PUBLIC_DISCORD_CLIENT_ID=your_client_id

# Session Secret (CRITICAL - 32+ characters)
# Generate with: openssl rand -base64 32
SESSION_SECRET=your_random_32_character_secret

# Database
DATABASE_URL=postgresql://user:password@host:port/database

# Tradier API
TRADIER_TOKEN=your_tradier_token

# Environment
NODE_ENV=development
```

See [.env.local.example](./.env.local.example) for template.

---

## Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/meridian-dashboard.git
cd meridian-dashboard

# Install dependencies
npm install

# Set up environment variables
cp .env.local.example .env.local
# Edit .env.local with your credentials

# Run database migrations
psql $DATABASE_URL < lib/db/migrations/add_constraints.sql

# Start development server
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000)

---

## Deployment

### Render

See [DEPLOY_NOW.md](./DEPLOY_NOW.md) for quick start or [RENDER_DEPLOYMENT.md](./RENDER_DEPLOYMENT.md) for full guide.

**Quick steps:**
1. Create Render Web Service
2. Add environment variables (see `.env.production`)
3. Set custom domain (optional)
4. Deploy!

**Build Command:** `npm install && npm run build`  
**Start Command:** `npm start`

---

## Discord OAuth Setup

1. Create Discord application at https://discord.com/developers/applications
2. Go to **OAuth2** → **Redirects**
3. Add redirect URIs:
   - `http://localhost:3000/api/auth/discord/callback` (local)
   - `https://yourdomain.com/api/auth/discord/callback` (production)
4. Enable scopes:
   - `identify`
   - `guilds`
   - `guilds.members.read`
5. Copy **Client ID** and **Client Secret**
6. Get **Guild ID** (right-click server → Copy Server ID)
7. Get **Role ID** (Server Settings → Roles → right-click role → Copy Role ID)

See [DISCORD_OAUTH_SETUP.md](./DISCORD_OAUTH_SETUP.md) for detailed instructions.

---

## Database Schema

```sql
-- Users table
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  discord_id VARCHAR(255) UNIQUE NOT NULL,
  username VARCHAR(255) NOT NULL,
  avatar TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_login TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Accounts table
CREATE TABLE accounts (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  platform VARCHAR(50) NOT NULL,
  account_name VARCHAR(100) NOT NULL,
  account_id VARCHAR(100),
  balance DECIMAL(15, 2) NOT NULL DEFAULT 0,
  currency VARCHAR(3) NOT NULL DEFAULT 'USD',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Trades table
CREATE TABLE trades (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  account_id INTEGER REFERENCES accounts(id) ON DELETE SET NULL,
  symbol VARCHAR(20) NOT NULL,
  direction VARCHAR(10) NOT NULL, -- LONG, SHORT, CALL, PUT
  asset_type VARCHAR(20) NOT NULL DEFAULT 'stock',
  strike DECIMAL(10, 2),
  expiry DATE,
  entry_price DECIMAL(15, 2) NOT NULL,
  exit_price DECIMAL(15, 2),
  quantity INTEGER NOT NULL,
  entry_date TIMESTAMP NOT NULL,
  exit_date TIMESTAMP,
  pnl DECIMAL(15, 2),
  pnl_percent DECIMAL(10, 2),
  status VARCHAR(20) NOT NULL DEFAULT 'closed',
  notes TEXT,
  chart_url TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

Run migrations: `psql $DATABASE_URL < lib/db/migrations/add_constraints.sql`

---

## API Routes

### Authentication
- `GET /api/auth/discord/callback` - OAuth callback
- `POST /api/auth/logout` - Logout
- `GET /api/auth/session` - Session status

### User Data
- `GET /api/user/accounts` - List accounts
- `POST /api/user/accounts` - Create account
- `PATCH /api/user/accounts` - Update account
- `DELETE /api/user/accounts` - Delete account

- `GET /api/user/trades` - List trades
- `POST /api/user/trades` - Create trade
- `PATCH /api/user/trades` - Update trade
- `DELETE /api/user/trades` - Delete trade

- `GET /api/user/stats` - Portfolio stats

### System
- `GET /api/status` - System health (Meridian, Helios, Nebula)
- `GET /api/market` - Live market data (Tradier)
- `GET /api/accounts` - Legacy account endpoint (credentials.json)
- `GET /api/trades` - Helios pending_signals

---

## Development

```bash
# Run dev server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Lint code
npm run lint
```

---

## Project Structure

```
meridian-dashboard/
├── app/
│   ├── api/                # API routes
│   │   ├── auth/           # Authentication
│   │   ├── user/           # User data (trades, accounts)
│   │   ├── market/         # Market data
│   │   └── status/         # System health
│   ├── login/              # Login page
│   ├── layout.tsx          # Root layout
│   └── page.tsx            # Dashboard home
├── components/
│   ├── ui/                 # shadcn/ui components
│   └── user-menu.tsx       # User dropdown
├── lib/
│   ├── auth/               # JWT session helpers
│   ├── db/                 # Database queries & migrations
│   └── validation/         # Zod schemas
├── public/                 # Static assets
├── DEPLOY_NOW.md           # Quick deployment guide
├── RENDER_DEPLOYMENT.md    # Full deployment guide
├── SECURITY_FIXES.md       # Security audit results
└── README.md               # This file
```

---

## Security Audit

**Audit Date:** 2026-02-20  
**Overall Grade:** A- (Production Ready)

### Fixed Vulnerabilities

1. **Session Tampering (CRITICAL)** - JWT signing implemented
2. **Connection Leaks (HIGH)** - Connection pooling added
3. **Invalid Input (HIGH)** - Zod validation everywhere
4. **Race Conditions (HIGH)** - Atomic user creation
5. **Bypass Risk (HIGH)** - Mandatory role check
6. **Data Integrity (MEDIUM)** - Database constraints
7. **P&L Errors (MEDIUM)** - Contract multiplier fixed
8. **DoS Risk (MEDIUM)** - Query limits capped
9. **Session Duration (MEDIUM)** - 24h expiry

See [SECURITY_FIXES.md](./SECURITY_FIXES.md) for detailed report.

---

## License

MIT

---

## Support

For issues or questions:
- **GitHub Issues:** https://github.com/yourusername/meridian-dashboard/issues
- **Discord:** [Your Discord Server]

---

## Roadmap

- [ ] Rate limiting
- [ ] CSRF tokens for sensitive actions
- [ ] Session revocation (logout all devices)
- [ ] Trade performance charts
- [ ] Export to CSV
- [ ] Dark/light theme toggle
- [ ] Mobile app (React Native)

---

Built with ⚡ by [Orion Solana LLC](https://github.com/yourusername)
