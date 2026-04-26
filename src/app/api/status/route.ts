export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getMergedStatus } from '@/lib/workplace';

export async function GET() {
  const status = await getMergedStatus();
  return NextResponse.json(status);
}
