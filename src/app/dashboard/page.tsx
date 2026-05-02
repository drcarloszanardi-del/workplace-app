export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { PilarDashboard } from '@/components/pilar-dashboard';

async function fetchDashboard() {
  const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/pilar/dashboard`, {
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new Error(`Dashboard fetch failed: ${res.status}`);
  }
  return res.json();
}

export default async function DashboardPage() {
  const data = await fetchDashboard();
  return <PilarDashboard data={data} />;
}
