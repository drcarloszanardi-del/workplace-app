import { getDashboardPayload } from '@/app/api/pilar/dashboard/route';
import { PilarDashboard } from '@/components/pilar-dashboard';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type PageProps = {
  searchParams?: Promise<{ year?: string }>;
};

async function getHomeData(year?: number) {
  return getDashboardPayload(Number.isFinite(year) ? year : undefined);
}

export default async function Home({ searchParams }: PageProps) {
  const params = (await searchParams) || {};
  const year = params.year ? Number(params.year) : undefined;
  const data = await getHomeData(Number.isFinite(year) ? year : undefined);
  return <PilarDashboard data={data} />;
}
