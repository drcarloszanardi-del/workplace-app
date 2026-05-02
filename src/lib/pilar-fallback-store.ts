import fs from 'fs/promises';
import path from 'path';
import { getFlujoData } from '@/lib/pilar-data';
import type { DebtItem, FlujoRecordPreview } from '@/lib/pilar-types';

const STORE_PATH = path.join(process.cwd(), 'tmp', 'pilar-fallback-store.json');

type FallbackStore = {
  transactions: FlujoRecordPreview[];
  debts: DebtItem[];
  updatedAt: string;
};

function cloneRecords(): FlujoRecordPreview[] {
  return getFlujoData().recordsPreview.map((item) => ({ ...item }));
}

function cloneDebts(): DebtItem[] {
  return getFlujoData().debts.map((item) => ({ ...item }));
}

async function ensureStoreFile() {
  await fs.mkdir(path.dirname(STORE_PATH), { recursive: true });
  try {
    await fs.access(STORE_PATH);
  } catch {
    const initial: FallbackStore = {
      transactions: cloneRecords(),
      debts: cloneDebts(),
      updatedAt: new Date().toISOString(),
    };
    await fs.writeFile(STORE_PATH, JSON.stringify(initial, null, 2), 'utf8');
  }
}

export async function readFallbackStore(): Promise<FallbackStore> {
  await ensureStoreFile();
  const raw = await fs.readFile(STORE_PATH, 'utf8');
  return JSON.parse(raw) as FallbackStore;
}

export async function writeFallbackStore(store: FallbackStore) {
  await ensureStoreFile();
  await fs.writeFile(
    STORE_PATH,
    JSON.stringify({ ...store, updatedAt: new Date().toISOString() }, null, 2),
    'utf8',
  );
}

export async function addFallbackTransaction(input: Partial<FlujoRecordPreview>) {
  const store = await readFallbackStore();
  const nextId = store.transactions.reduce((max, item) => Math.max(max, Number(item.id || 0)), 0) + 1;
  const date = input.date || new Date().toISOString().slice(0, 10);
  const year = Number(input.year || Number(date.slice(0, 4)) || new Date().getFullYear());
  const month = Number(input.month || Number(date.slice(5, 7)) || 1);
  const budget = Number(input.budget || 0);
  const collection1 = Number(input.collection1 || 0);
  const collection2 = Number(input.collection2 || 0);
  const totalCollection = Number(input.totalCollection || collection1 + collection2);
  const expense = Number(input.expense || 0);
  const pending = Number(input.pending || Math.max(budget - totalCollection, 0));
  const balance = Number(input.balance || pending);
  const record: FlujoRecordPreview = {
    id: nextId,
    date,
    month,
    year,
    client: String(input.client || ''),
    product: String(input.product || ''),
    category: String(input.category || 'Ventas Otros'),
    budget,
    supplierBudget: Number(input.supplierBudget || 0),
    collection1,
    pending,
    date2: input.date2 || null,
    month2: Number(input.month2 || 0),
    year2: Number(input.year2 || 0),
    collection2,
    totalCollection,
    balance,
    expense,
  };
  store.transactions.unshift(record);
  await writeFallbackStore(store);
  return record;
}

export async function addFallbackDebt(input: Partial<DebtItem>) {
  const store = await readFallbackStore();
  const debt: DebtItem = {
    concept: String(input.concept || 'Sin concepto'),
    amount: Number(input.amount || 0),
    dueDate: input.dueDate || null,
  };
  store.debts.push(debt);
  await writeFallbackStore(store);
  return debt;
}
