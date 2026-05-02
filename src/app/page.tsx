import { getDashboardData } from '@/lib/pilar-data';
import { getPilarAdminClient } from '@/lib/pilar-server';
import { PilarDashboard } from '@/components/pilar-dashboard';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type PageProps = {
  searchParams?: Promise<{ year?: string }>;
};

async function getHomeData(year?: number) {
  const base = getDashboardData(Number.isFinite(year) ? year : undefined);

  try {
    getPilarAdminClient();
  } catch {
    return { ...base, source: 'json-fallback', sourceError: 'Supabase env missing' };
  }

  return base;
}

export default async function Home({ searchParams }: PageProps) {
  const params = (await searchParams) || {};
  const year = params.year ? Number(params.year) : undefined;
  const data = await getHomeData(Number.isFinite(year) ? year : undefined);
  return <PilarDashboard data={data} />;
}
