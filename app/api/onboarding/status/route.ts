import { NextResponse } from 'next/server';
import pool from '@/lib/db/pool';
import { getUserIdFromSession } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

// GET - Check onboarding status
export async function GET(request: Request) {
  const userId = await getUserIdFromSession();
  
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  try {
    // Check if user has completed onboarding
    const result = await pool.query(
      `SELECT id, status, completed_at 
       FROM onboarding_sessions 
       WHERE user_id = $1 AND status = 'completed'
       ORDER BY completed_at DESC LIMIT 1`,
      [userId]
    );
    
    const hasCompleted = result.rows.length > 0;
    
    // If not completed, check for in-progress session
    let inProgressSession = null;
    if (!hasCompleted) {
      const inProgressResult = await pool.query(
        `SELECT id, session_token, current_step 
         FROM onboarding_sessions 
         WHERE user_id = $1 AND status = 'in_progress'
         ORDER BY started_at DESC LIMIT 1`,
        [userId]
      );
      
      if (inProgressResult.rows.length > 0) {
        inProgressSession = inProgressResult.rows[0];
      }
    }
    
    return NextResponse.json({
      hasCompleted,
      completedAt: hasCompleted ? result.rows[0].completed_at : null,
      inProgressSession: inProgressSession ? {
        sessionId: inProgressSession.id,
        sessionToken: inProgressSession.session_token,
        currentStep: inProgressSession.current_step
      } : null
    });
    
  } catch (error) {
    console.error('Onboarding status error:', error);
    return NextResponse.json(
      { error: 'Failed to check onboarding status' },
      { status: 500 }
    );
  }
}
