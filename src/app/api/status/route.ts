export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { refreshStructuredStatus } from '@/lib/workplace-sync';

export async function GET() {
  const status = await refreshStructuredStatus();
  return NextResponse.json(status);
}
