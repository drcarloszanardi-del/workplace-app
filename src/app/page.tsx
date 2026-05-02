import { headers } from 'next/headers';
import { PilarDashboard } from '@/components/pilar-dashboard';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type PageProps = {
  searchParams?: Promise<{ year?: string }>;
};

async function fetchDashboard(year?: number) {
  const query = year ? `?year=${year}` : '';
  const headersList = await headers();
  const host = headersList.get('x-forwarded-host') || headersList.get('host') || 'localhost:3000';
  const proto = headersList.get('x-forwarded-proto') || (host.includes('localhost') ? 'http' : 'https');
  const res = await fetch(`${proto}://${host}/api/pilar/dashboard${query}`, {
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new Error(`Dashboard fetch failed: ${res.status}`);
  }
  return res.json();
}

export default async function Home({ searchParams }: PageProps) {
  const params = (await searchParams) || {};
  const year = params.year ? Number(params.year) : undefined;
  const data = await fetchDashboard(Number.isFinite(year) ? year : undefined);
  return <PilarDashboard data={data} />;
}
