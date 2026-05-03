import { PilarDashboard } from '@/components/pilar-dashboard';
import { getDashboardPayload, normalizeYear } from '@/lib/pilar-dashboard-data';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const revalidate = 0;

type PageProps = {
  searchParams?: Promise<{ year?: string | string[] }>;
};

function parseYearParam(value?: string | string[]) {
  const raw = Array.isArray(value) ? value[0] : value;
  return normalizeYear(raw ? Number(raw) : undefined);
}

export default async function Home({ searchParams }: PageProps) {
  const params = (await searchParams) || {};
  const data = await getDashboardPayload(parseYearParam(params.year));
  return <PilarDashboard data={data} />;
}
