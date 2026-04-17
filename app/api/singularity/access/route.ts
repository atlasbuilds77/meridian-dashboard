import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/api/require-auth';
import { currentUserHasRole } from '@/lib/auth/check-discord-role';
import { isAdminDiscordId } from '@/lib/auth/admin';

export const dynamic = 'force-dynamic';

const SINGULARITY_ROLE_ID = process.env.SINGULARITY_ROLE_ID ?? '';

export async function GET(request: Request) {
  const sessionResult = await requireSession();
  if (!sessionResult.ok) return NextResponse.json({ hasAccess: false });

  // Admins always have access
  if (await isAdminDiscordId(sessionResult.session.discordId)) {
    return NextResponse.json({ hasAccess: true });
  }

  if (!SINGULARITY_ROLE_ID) return NextResponse.json({ hasAccess: false });

  const hasAccess = await currentUserHasRole(SINGULARITY_ROLE_ID);
  return NextResponse.json({ hasAccess });
}
