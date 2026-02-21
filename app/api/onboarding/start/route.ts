import { NextResponse } from 'next/server';
import pool from '@/lib/db/pool';
import { getUserIdFromSession } from '@/lib/auth/session';
import crypto from 'crypto';
import { enforceRateLimit, rateLimitExceededResponse } from '@/lib/security/rate-limit';

export const dynamic = 'force-dynamic';

// POST - Start onboarding session
export async function POST(request: Request) {
  const userId = await getUserIdFromSession();
  
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const limiterResult = await enforceRateLimit({
    request,
    name: 'onboarding_start',
    limit: 10,
    windowMs: 60_000,
    userId,
  });

  if (!limiterResult.allowed) {
    return rateLimitExceededResponse(limiterResult, 'onboarding_start');
  }
  
  try {
    const body = await request.json().catch(() => ({}));
    const userAgent = typeof body.userAgent === 'string' ? body.userAgent : undefined;
    
    // Get IP from headers (proxied through Cloudflare/Render)
    const forwarded = request.headers.get('x-forwarded-for');
    const ip = forwarded ? forwarded.split(',')[0] : request.headers.get('x-real-ip') || 'unknown';
    
    // Check if user already completed onboarding
    const existingCheck = await pool.query(
      `SELECT id, status FROM onboarding_sessions 
       WHERE user_id = $1 AND status = 'completed'
       ORDER BY completed_at DESC LIMIT 1`,
      [userId]
    );
    
    if (existingCheck.rows.length > 0) {
      return NextResponse.json({
        error: 'Onboarding already completed',
        sessionId: existingCheck.rows[0].id
      }, { status: 400 });
    }
    
    // Resume the latest in-progress session if available.
    const existingInProgress = await pool.query(
      `SELECT id, current_step
       FROM onboarding_sessions
       WHERE user_id = $1 AND status = 'in_progress'
       ORDER BY started_at DESC LIMIT 1`,
      [userId]
    );

    if (existingInProgress.rows.length > 0) {
      await pool.query(
        `UPDATE onboarding_sessions
         SET last_activity_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [existingInProgress.rows[0].id]
      );

      return NextResponse.json({
        success: true,
        sessionId: existingInProgress.rows[0].id,
        currentStep: existingInProgress.rows[0].current_step,
        resumed: true,
      });
    }

    // Create new onboarding session
    const sessionToken = crypto.randomBytes(32).toString('hex');
    
    const result = await pool.query(
      `INSERT INTO onboarding_sessions (
        user_id,
        session_token,
        current_step,
        status,
        ip_address,
        user_agent
      ) VALUES ($1, $2, 2, 'in_progress', $3, $4)
      RETURNING id, current_step`,
      [userId, sessionToken, ip, userAgent]
    );
    
    // Log audit event
    await pool.query(
      `INSERT INTO onboarding_audit_log (
        user_id,
        onboarding_session_id,
        event_type,
        ip_address,
        user_agent
      ) VALUES ($1, $2, 'session_started', $3, $4)`,
      [userId, result.rows[0].id, ip, userAgent]
    );
    
    return NextResponse.json({
      success: true,
      sessionId: result.rows[0].id,
      currentStep: result.rows[0].current_step
    });
    
  } catch (error) {
    console.error('Onboarding start error:', error);
    return NextResponse.json(
      { error: 'Failed to start onboarding' },
      { status: 500 }
    );
  }
}
