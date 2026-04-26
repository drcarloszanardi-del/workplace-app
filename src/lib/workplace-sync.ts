import fs from 'fs/promises';
import { defaultStatus } from '@/lib/default-status';
import { getMergedStatus, statusPath } from '@/lib/workplace';

export async function refreshStructuredStatus() {
  const merged = await getMergedStatus();
  const next = {
    ...defaultStatus,
    ...merged,
    frentes: merged.frentes,
  };
  await fs.writeFile(statusPath, JSON.stringify(next, null, 2) + '\n', 'utf8');
  return next;
}
