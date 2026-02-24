import { NextResponse } from 'next/server';
import pool from '@/lib/db/pool';
import { getUserIdFromSession } from '@/lib/auth/session';
import crypto from 'crypto';
import { z } from 'zod';
import { enforceRateLimit, rateLimitExceededResponse } from '@/lib/security/rate-limit';
import { extractClientIp } from '@/lib/security/client-ip';

export const dynamic = 'force-dynamic';

const requiredRiskTypes = [
  'options_trading_risk',
  'no_investment_advice',
  'user_sole_responsibility',
  'past_performance_disclaimer',
  'system_downtime_risk',
  'no_fdic_insurance',
] as const;

const submitSchema = z.object({
  sessionId: z.number().int().positive().optional(),
  sessionToken: z.string().min(1).optional(),
  step: z.number().int().min(2).max(5),
  data: z.unknown(),
});

const riskStepSchema = z.object({
  risks: z.array(z.enum(requiredRiskTypes)).min(requiredRiskTypes.length),
});

const acceptanceSchema = z.object({
  accepted: z.literal(true),
  scrollPercentage: z.number().int().min(0).max(100).optional(),
  timeSpent: z.number().int().min(0).optional(),
});

const signatureSchema = z.object({
  signatureName: z.string().trim().min(2).max(200),
  certifyAge: z.literal(true),
});

// POST - Submit onboarding step
export async function POST(request: Request) {
  const userId = await getUserIdFromSession();
  
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const limiterResult = await enforceRateLimit({
    request,
    name: 'onboarding_submit',
    limit: 40,
    windowMs: 60_000,
    userId,
  });

  if (!limiterResult.allowed) {
    return rateLimitExceededResponse(limiterResult, 'onboarding_submit');
  }
  
  try {
    const body = await request.json();
    const parsed = submitSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid request payload' },
        { status: 400 }
      );
    }

    const { sessionId: requestedSessionId, sessionToken, step, data } = parsed.data;
    
    // Keep a single normalized IP for INET columns.
    const ip = extractClientIp(request) || '0.0.0.0';

    // Resolve session for this user. Prefer explicit session id/token for backwards compatibility.
    const sessionCheck = requestedSessionId
      ? await pool.query(
          `SELECT id, current_step, status 
           FROM onboarding_sessions 
           WHERE id = $1 AND user_id = $2`,
          [requestedSessionId, userId]
        )
      : sessionToken
        ? await pool.query(
            `SELECT id, current_step, status 
             FROM onboarding_sessions 
             WHERE session_token = $1 AND user_id = $2`,
            [sessionToken, userId]
          )
        : await pool.query(
            `SELECT id, current_step, status
             FROM onboarding_sessions
             WHERE user_id = $1 AND status = 'in_progress'
             ORDER BY started_at DESC LIMIT 1`,
            [userId]
          );
    
    if (sessionCheck.rows.length === 0) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 400 });
    }
    
    const session = sessionCheck.rows[0];
    const sessionId = session.id;
    
    if (session.status === 'completed') {
      return NextResponse.json({ error: 'Session already completed' }, { status: 400 });
    }

    if (session.current_step !== step) {
      return NextResponse.json(
        { error: 'Invalid onboarding step', expectedStep: session.current_step },
        { status: 409 }
      );
    }
    
    // Handle different steps
    switch (step) {
      case 2: // Risk Acknowledgments
        await handleRiskAcknowledgments(sessionId, userId, data, ip);
        break;
        
      case 3: // Terms of Service
        await handleTermsAcceptance(sessionId, userId, data, ip);
        break;
        
      case 4: // Fee Agreement
        await handleFeeAgreement(sessionId, userId, data, ip);
        break;
        
      case 5: // E-Signature
        await handleSignature(sessionId, userId, data, ip, request.headers.get('user-agent') || '');
        
        // Mark session as completed
        await pool.query(
          `UPDATE onboarding_sessions 
           SET status = 'completed', completed_at = CURRENT_TIMESTAMP, current_step = 5
           WHERE id = $1`,
          [sessionId]
        );
        
        // Log completion
        await pool.query(
          `INSERT INTO onboarding_audit_log (
            user_id,
            onboarding_session_id,
            event_type,
            ip_address
          ) VALUES ($1, $2, 'session_completed', $3)`,
          [userId, sessionId, ip]
        );
        
        return NextResponse.json({ 
          success: true,
          completed: true,
          currentStep: 5,
          message: 'Onboarding completed successfully'
        });
        
      default:
        return NextResponse.json({ error: 'Invalid step' }, { status: 400 });
    }
    
    // Update current step
    await pool.query(
      `UPDATE onboarding_sessions 
       SET current_step = $1, last_activity_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [step + 1, sessionId]
    );
    
    // Log step completion
    await pool.query(
      `INSERT INTO onboarding_audit_log (
        user_id,
        onboarding_session_id,
        event_type,
        event_data,
        ip_address
      ) VALUES ($1, $2, 'step_completed', $3, $4)`,
      [userId, sessionId, JSON.stringify({ step }), ip]
    );
    
    return NextResponse.json({
      success: true,
      currentStep: step + 1,
      nextStep: step < 5 ? step + 1 : null
    });
    
  } catch (error: unknown) {
    console.error('Onboarding submit error:', error);

    if (error instanceof Error && (
      error.message.startsWith('Invalid') ||
      error.message.includes('required')
    )) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: 'Failed to submit onboarding step' },
      { status: 500 }
    );
  }
}

async function handleRiskAcknowledgments(sessionId: number, userId: number, rawData: unknown, ip: string) {
  const parsed = riskStepSchema.safeParse(rawData);
  if (!parsed.success) {
    throw new Error('Invalid risk acknowledgment payload');
  }

  const risks = Array.from(new Set(parsed.data.risks));

  if (requiredRiskTypes.some((riskType) => !risks.includes(riskType))) {
    throw new Error('All risk acknowledgments are required');
  }
  
  // Insert each risk acknowledgment
  for (const riskType of risks) {
    await pool.query(
      `INSERT INTO risk_acknowledgments (
        onboarding_session_id,
        user_id,
        risk_type,
        acknowledged,
        acknowledged_at,
        ip_address
      ) VALUES ($1, $2, $3, true, CURRENT_TIMESTAMP, $4)
      ON CONFLICT (onboarding_session_id, risk_type) DO NOTHING`,
      [sessionId, userId, riskType, ip]
    );
  }
}

async function handleTermsAcceptance(sessionId: number, userId: number, rawData: unknown, ip: string) {
  const parsed = acceptanceSchema.safeParse(rawData);
  if (!parsed.success) {
    throw new Error('Invalid terms acceptance payload');
  }

  const documentHash = crypto.createHash('sha256').update('terms_of_service_v1.0').digest('hex');
  
  await pool.query(
    `INSERT INTO document_agreements (
      onboarding_session_id,
      user_id,
      document_type,
      document_version,
      document_hash,
      accepted,
      accepted_at,
      ip_address,
      scroll_percentage,
      time_spent_seconds
    ) VALUES ($1, $2, 'terms_of_service', '1.0', $3, true, CURRENT_TIMESTAMP, $4, $5, $6)
    ON CONFLICT (onboarding_session_id, document_type) DO NOTHING`,
    [sessionId, userId, documentHash, ip, parsed.data.scrollPercentage ?? 0, parsed.data.timeSpent ?? 0]
  );
  
  // Also insert privacy policy and risk disclosure
  const privacyHash = crypto.createHash('sha256').update('privacy_policy_v1.0').digest('hex');
  const riskHash = crypto.createHash('sha256').update('risk_disclosure_v1.0').digest('hex');
  
  await pool.query(
    `INSERT INTO document_agreements (
      onboarding_session_id,
      user_id,
      document_type,
      document_version,
      document_hash,
      accepted,
      accepted_at,
      ip_address
    ) VALUES 
      ($1, $2, 'privacy_policy', '1.0', $3, true, CURRENT_TIMESTAMP, $4),
      ($1, $2, 'risk_disclosure', '1.0', $5, true, CURRENT_TIMESTAMP, $4)
    ON CONFLICT (onboarding_session_id, document_type) DO NOTHING`,
    [sessionId, userId, privacyHash, ip, riskHash]
  );
}

async function handleFeeAgreement(sessionId: number, userId: number, rawData: unknown, ip: string) {
  if (!acceptanceSchema.safeParse(rawData).success) {
    throw new Error('Invalid fee acceptance payload');
  }

  // Record fee agreement acceptance
  await pool.query(
    `INSERT INTO user_consents (
      user_id,
      consent_type,
      consent_version,
      consented,
      consented_at,
      ip_address
    ) VALUES ($1, 'performance_tracking', '1.0', true, CURRENT_TIMESTAMP, $2)
    ON CONFLICT (user_id, consent_type, current) WHERE current = true DO NOTHING`,
    [userId, ip]
  );
}

async function handleSignature(sessionId: number, userId: number, rawData: unknown, ip: string, userAgent: string) {
  const parsed = signatureSchema.safeParse(rawData);
  if (!parsed.success) {
    throw new Error('Invalid signature payload');
  }

  const signatureName = parsed.data.signatureName;
  
  // Create verification hash
  const verificationData = `${signatureName}|${new Date().toISOString()}|${ip}`;
  const verificationHash = crypto.createHmac('sha256', process.env.SESSION_SECRET!)
    .update(verificationData)
    .digest('hex');
  
  await pool.query(
    `INSERT INTO signature_events (
      onboarding_session_id,
      user_id,
      signature_type,
      signature_data,
      signer_name,
      signer_date,
      ip_address,
      user_agent,
      verification_hash
    ) VALUES ($1, $2, 'typed', $3, $4, CURRENT_DATE, $5, $6, $7)`,
    [sessionId, userId, signatureName, signatureName, ip, userAgent, verificationHash]
  );
}
