# Admin User Settings API

**Created:** February 26, 2026  
**Location:** `/app/api/admin/users/[userId]/settings/route.ts`

## Overview

Admin-only API for managing user trading settings. Allows administrators to view and update risk controls for any user.

## Endpoints

### `GET /api/admin/users/:userId/settings`

**Authentication:** Admin session required (via `requireAdminSession`)

**Response:**
```json
{
  "user": {
    "id": 14,
    "discord_id": "123456789",
    "discord_username": "simonsaidyes",
    "discord_avatar": "https://cdn.discordapp.com/avatars/..."
  },
  "settings": {
    "trading_enabled": true,
    "size_pct": 0.5,
    "max_position_size": 1000,
    "max_daily_loss": 500,
    "risk_level": "moderate",
    "created_at": "2026-02-23T16:39:19.631Z",
    "updated_at": "2026-02-23T22:35:58.050Z"
  }
}
```

**Notes:**
- `risk_level` is calculated from `size_pct` if not explicitly set in database
- `max_daily_loss` is a new field added to `user_trading_settings` table

### `PUT /api/admin/users/:userId/settings`

**Authentication:** Admin session required

**Request Body:**
```json
{
  "trading_enabled": true,
  "size_pct": 0.75,
  "max_position_size": 1000,
  "max_daily_loss": 500,
  "risk_level": "aggressive"
}
```

All fields are optional. Only provided fields will be updated.

**Validation:**
- `size_pct`: Must be between 0.01 and 1.0 (1-100%)
- `max_position_size`: Positive number or `null`
- `max_daily_loss`: Positive number or `null`
- `risk_level`: Must be one of: `very_conservative`, `conservative`, `moderate`, `aggressive`, `maximum`

**Response:**
```json
{
  "success": true,
  "settings": {
    "trading_enabled": true,
    "size_pct": 0.75,
    "max_position_size": 1000,
    "max_daily_loss": 500,
    "risk_level": "aggressive",
    "created_at": "2026-02-23T16:39:19.631Z",
    "updated_at": "2026-02-26T10:41:32.394Z"
  }
}
```

## Database Schema

The API uses the `user_trading_settings` table with the following columns:

| Column | Type | Description |
|--------|------|-------------|
| `id` | SERIAL PRIMARY KEY | Auto-incrementing ID |
| `user_id` | INTEGER NOT NULL UNIQUE | References `users(id)` |
| `trading_enabled` | BOOLEAN DEFAULT true | Whether trading is enabled |
| `size_pct` | DECIMAL(5,4) DEFAULT 1.0 | Position size percentage (0.01-1.0) |
| `max_position_size` | DECIMAL(12,2) NULL | Maximum position size in dollars |
| `max_daily_loss` | DECIMAL(12,2) NULL | Maximum daily loss limit in dollars |
| `risk_level` | VARCHAR(50) NULL | Risk level category |
| `created_at` | TIMESTAMP DEFAULT CURRENT_TIMESTAMP | Creation timestamp |
| `updated_at` | TIMESTAMP DEFAULT CURRENT_TIMESTAMP | Last update timestamp |

**Constraints:**
- `size_pct` must be between 0.0 and 1.0
- `max_daily_loss` must be positive or null
- `risk_level` must be one of allowed values or null

## Risk Level Calculation

If `risk_level` is not explicitly set in the database, it's calculated from `size_pct`:

| `size_pct` Range | Risk Level |
|------------------|------------|
| ≤ 0.10 | `very_conservative` |
| 0.11 - 0.25 | `conservative` |
| 0.26 - 0.50 | `moderate` |
| 0.51 - 0.75 | `aggressive` |
| > 0.75 | `maximum` |

## Integration with Other Systems

When `trading_enabled` or `size_pct` is updated, the API also updates the `api_credentials` table to keep settings in sync across the system.

## Error Handling

- `400 Bad Request`: Invalid user ID or request payload
- `404 Not Found`: User not found
- `401 Unauthorized`: Admin authentication required
- `500 Internal Server Error`: Database or server error

## Migration

Added `max_daily_loss` and `risk_level` columns to `user_trading_settings` table via migration: `lib/db/migrations/add_max_daily_loss.sql`