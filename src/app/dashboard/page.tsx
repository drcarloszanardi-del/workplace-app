export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { getDashboardData } from '@/lib/pilar-data';
import { PilarDashboard } from '@/components/pilar-dashboard';

export default async function DashboardPage() {
  const data = getDashboardData();
  return <PilarDashboard data={data} />;
}
