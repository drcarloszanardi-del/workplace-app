export const dynamic = 'force-dynamic';

import { DashboardClient } from '@/components/dashboard-client';
import { getMergedStatus } from '@/lib/workplace';

export default async function DashboardPage() {
  const status = await getMergedStatus();
  return <DashboardClient initialStatus={status} />;
}
