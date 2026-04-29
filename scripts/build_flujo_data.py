from __future__ import annotations

import json
from collections import defaultdict
from datetime import datetime
from pathlib import Path
from typing import Any

from openpyxl import load_workbook

ROOT = Path('/Users/jarvis/workplace-app')
SOURCE = Path('/Users/jarvis/.openclaw/media/inbound/Flujo_de_Fondos_2026---5877ca3e-5fba-478c-bd25-d3518ab72ad8.xlsx')
OUTPUT = ROOT / 'src' / 'data' / 'flujo-fondos.json'


MONTH_NAMES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']


def excel_value(value: Any) -> float:
    if value is None or value == '':
        return 0.0
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, datetime):
        return 0.0
    if isinstance(value, str):
        text = value.strip()
        if not text:
            return 0.0
        if text.startswith('='):
            expr = text.lstrip('=').replace('+', '')
            pieces = [part.strip() for part in expr.split('-')]
            total = 0.0
            for idx, piece in enumerate(pieces):
                if not piece:
                    continue
                subtotal = sum(excel_value(part) for part in piece.split('+')) if '+' in piece else excel_value(piece)
                total = subtotal if idx == 0 else total - subtotal
            return total
        normalized = text.replace('.', '').replace(',', '.')
        try:
            return float(normalized)
        except ValueError:
            return 0.0
    return 0.0


wb = load_workbook(SOURCE, data_only=False)
ws_datos = wb['Datos']
ws_resumen = wb['Flujo de Fondos']
ws_deudas = wb['Deudas']

headers = [ws_datos.cell(1, c).value for c in range(1, 19)]
rows = []
for r in range(2, ws_datos.max_row + 1):
    record = {headers[c - 1]: ws_datos.cell(r, c).value for c in range(1, 19)}
    if not any(record.values()):
        continue
    rows.append(record)

month_columns = []
col = 2
while True:
    raw = ws_resumen.cell(2, col).value
    if raw is None:
        break
    if isinstance(raw, datetime):
        year = raw.year
        month = raw.month
    else:
        break
    month_columns.append({
        'col': col,
        'key': f'{year}-{month:02d}',
        'label': f"{MONTH_NAMES[month - 1]} {str(year)[2:]}",
        'year': year,
        'month': month,
    })
    col += 1

income_labels = [ws_resumen.cell(r, 1).value for r in range(5, 12)]
pending_labels = [ws_resumen.cell(r, 1).value for r in range(13, 20)]
expense_labels = [ws_resumen.cell(r, 1).value for r in range(21, 40)]
utility_labels = [ws_resumen.cell(r, 1).value for r in range(41, 44)]

summary = []
for month in month_columns:
    key = month['key']
    year = month['year']
    m = month['month']

    income_by_category = {}
    pending_by_category = {}
    expense_by_category = {}
    utility_by_category = {}

    for label in income_labels:
        total = 0.0
        for record in rows:
            if record.get('RUBRO') != label:
                continue
            if excel_value(record.get('Mes')) == m and excel_value(record.get('Año')) == year:
                total += excel_value(record.get('Cobro 1'))
            if excel_value(record.get('Mes2')) == m and excel_value(record.get('Año2')) == year:
                total += excel_value(record.get('Cobro 2'))
        income_by_category[label] = round(total, 2)

    for label in pending_labels:
        base_label = str(label)
        total = 0.0
        for record in rows:
            if record.get('RUBRO') != base_label:
                continue
            if excel_value(record.get('Mes')) == m and excel_value(record.get('Año')) == year:
                total += excel_value(record.get('Saldo'))
        pending_by_category[base_label] = round(total, 2)

    for label in expense_labels + utility_labels:
        total = 0.0
        for record in rows:
            if record.get('RUBRO') != label:
                continue
            if excel_value(record.get('Mes')) == m and excel_value(record.get('Año')) == year:
                total += excel_value(record.get('Gastos'))
        if label in expense_labels:
            expense_by_category[label] = round(total, 2)
        else:
            utility_by_category[label] = round(total, 2)

    total_income = round(sum(income_by_category.values()), 2)
    total_pending = round(sum(pending_by_category.values()), 2)
    total_expense = round(sum(expense_by_category.values()), 2)
    total_utility = round(sum(utility_by_category.values()), 2)
    period_balance = round((total_income + total_pending) - total_expense - total_utility, 2)
    initial_balance = excel_value(ws_resumen.cell(3, month['col']).value)
    accumulated_balance = round(initial_balance + period_balance, 2)

    summary.append({
        'key': key,
        'label': month['label'],
        'year': year,
        'month': m,
        'initialBalance': round(initial_balance, 2),
        'incomeByCategory': income_by_category,
        'pendingByCategory': pending_by_category,
        'expenseByCategory': expense_by_category,
        'utilityByCategory': utility_by_category,
        'totals': {
            'income': total_income,
            'pending': total_pending,
            'expense': total_expense,
            'utility': total_utility,
            'periodBalance': period_balance,
            'accumulatedBalance': accumulated_balance,
        },
        'excelCheck': {
            'income': excel_value(ws_resumen.cell(4, month['col']).value),
            'pending': excel_value(ws_resumen.cell(12, month['col']).value),
            'expense': excel_value(ws_resumen.cell(20, month['col']).value),
            'utility': excel_value(ws_resumen.cell(40, month['col']).value),
            'periodBalance': excel_value(ws_resumen.cell(44, month['col']).value),
            'accumulatedBalance': excel_value(ws_resumen.cell(45, month['col']).value),
        },
    })

records = []
client_totals = defaultdict(float)
category_income_totals = defaultdict(float)
category_expense_totals = defaultdict(float)
with_pending = 0
for idx, record in enumerate(rows, start=1):
    fecha_1 = record.get('Fecha1')
    fecha_2 = record.get('Fecha 2')
    normalized = {
        'id': idx,
        'date': fecha_1.strftime('%Y-%m-%d') if isinstance(fecha_1, datetime) else None,
        'month': int(excel_value(record.get('Mes'))),
        'year': int(excel_value(record.get('Año'))),
        'client': record.get('Cliente') or '',
        'product': record.get('Producto') or '',
        'category': record.get('RUBRO') or 'Sin rubro',
        'budget': round(excel_value(record.get('Presupuesto')), 2),
        'supplierBudget': round(excel_value(record.get('Presupuesto Proveedor')), 2),
        'collection1': round(excel_value(record.get('Cobro 1')), 2),
        'pending': round(excel_value(record.get('Pendiente')), 2),
        'date2': fecha_2.strftime('%Y-%m-%d') if isinstance(fecha_2, datetime) else None,
        'month2': int(excel_value(record.get('Mes2'))),
        'year2': int(excel_value(record.get('Año2'))),
        'collection2': round(excel_value(record.get('Cobro 2')), 2),
        'totalCollection': round(excel_value(record.get('Cobro Total')), 2),
        'balance': round(excel_value(record.get('Saldo')), 2),
        'expense': round(excel_value(record.get('Gastos')), 2),
    }
    records.append(normalized)
    if normalized['client']:
        client_totals[normalized['client']] += normalized['totalCollection']
    if normalized['collection1'] or normalized['collection2']:
        category_income_totals[normalized['category']] += normalized['totalCollection']
    if normalized['expense']:
        category_expense_totals[normalized['category']] += normalized['expense']
    if normalized['balance'] > 0:
        with_pending += 1

debts = []
for r in range(2, 21):
    concept = ws_deudas.cell(r, 1).value
    amount = excel_value(ws_deudas.cell(r, 2).value)
    due = ws_deudas.cell(r, 3).value
    if concept is None and amount == 0 and due is None:
        continue
    debts.append({
        'concept': concept or '',
        'amount': round(amount, 2),
        'dueDate': due.strftime('%Y-%m-%d') if isinstance(due, datetime) else None,
    })

output = {
    'sourceWorkbook': SOURCE.name,
    'generatedAt': datetime.now().isoformat(),
    'months': [
        {
            'key': item['key'],
            'label': item['label'],
            'year': item['year'],
            'month': item['month'],
        }
        for item in summary
    ],
    'summary': summary,
    'metrics': {
        'recordCount': len(records),
        'clientsCount': len({r['client'] for r in records if r['client']}),
        'categoriesCount': len({r['category'] for r in records if r['category']}),
        'monthsCount': len(summary),
        'openPendingCount': with_pending,
        'totalDebt': round(sum(item['amount'] for item in debts), 2),
    },
    'highlights': {
        'topClients': [
            {'name': name, 'amount': round(amount, 2)}
            for name, amount in sorted(client_totals.items(), key=lambda item: item[1], reverse=True)[:8]
        ],
        'topIncomeCategories': [
            {'name': name, 'amount': round(amount, 2)}
            for name, amount in sorted(category_income_totals.items(), key=lambda item: item[1], reverse=True)[:8]
        ],
        'topExpenseCategories': [
            {'name': name, 'amount': round(amount, 2)}
            for name, amount in sorted(category_expense_totals.items(), key=lambda item: item[1], reverse=True)[:8]
        ],
    },
    'debts': debts,
    'recordsPreview': records[:120],
}

OUTPUT.parent.mkdir(parents=True, exist_ok=True)
OUTPUT.write_text(json.dumps(output, ensure_ascii=False, indent=2), encoding='utf8')
print(f'Wrote {OUTPUT}')
