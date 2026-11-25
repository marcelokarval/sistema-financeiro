export interface ConsortiumSelection {
  readonly consortiumId: string;
}

export interface ConsortiumInstallment {
  id: string;
  number: number;
  amount: number;
  dueDate: string;
  paidDate: string | null;
  status: string;
  notes: string;
  assemblyDate: string | null;
  assemblyResult: string;
  consortiumId: string;
}

// Cada abertura cria um token novo, mesmo ao voltar ao mesmo consórcio.
export function isCurrentConsortiumSelection(current: ConsortiumSelection | null, opening: ConsortiumSelection) {
  return current === opening;
}

export function resolveConsortiumPaymentRefresh(
  current: ConsortiumSelection | null,
  submitted: ConsortiumSelection,
  succeeded: boolean,
) {
  // Uma leitura nova pode usar a abertura vigente do mesmo alvo; a confirmação antiga não pode.
  const detail = current?.consortiumId === submitted.consortiumId ? current : undefined;
  return { detail, list: succeeded || detail !== undefined || current === null };
}

function isOwnedInstallment(row: unknown, consortiumId: string): row is ConsortiumInstallment {
  if (!row || typeof row !== 'object') return false;
  const i = row as Record<string, unknown>;
  return i.consortiumId === consortiumId && typeof i.id === 'string' && i.id.length > 0
    && typeof i.number === 'number' && Number.isFinite(i.number)
    && typeof i.amount === 'number' && Number.isFinite(i.amount)
    && typeof i.dueDate === 'string' && (i.paidDate === null || typeof i.paidDate === 'string')
    && (i.status === 'PENDING' || i.status === 'OVERDUE' || i.status === 'PAID')
    && typeof i.notes === 'string' && (i.assemblyDate === null || typeof i.assemblyDate === 'string')
    && typeof i.assemblyResult === 'string';
}

export function readConsortiumInstallments(opening: ConsortiumSelection, payload: unknown): ConsortiumInstallment[] | null {
  if (!Array.isArray(payload)) return null;
  const rows: ConsortiumInstallment[] = [];
  const ids = new Set<string>();
  for (const row of payload) {
    if (!isOwnedInstallment(row, opening.consortiumId) || ids.has(row.id)) return null;
    ids.add(row.id);
    rows.push(row);
  }
  return rows;
}

export function findPayableConsortiumInstallment(
  current: ConsortiumSelection | null,
  opening: ConsortiumSelection,
  rows: readonly ConsortiumInstallment[] | null,
  installmentId: string,
) {
  if (!isCurrentConsortiumSelection(current, opening)) return undefined;
  return rows?.find((row) => row.id === installmentId && row.consortiumId === opening.consortiumId
    && (row.status === 'PENDING' || row.status === 'OVERDUE'));
}
