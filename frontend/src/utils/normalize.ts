/**
 * 将后端/导入可能出现的哨兵字符串归一化，避免把 "null"/"undefined" 误判为有效值。
 */

export const normalizeOptionalId = (value: unknown): string | undefined => {
  if (value === null || value === undefined) return undefined;
  if (typeof value !== 'string') return undefined;
  const v = value.trim();
  if (!v) return undefined;
  const lower = v.toLowerCase();
  if (lower === 'null' || lower === 'undefined') return undefined;
  return v;
};

export const normalizeOptionalText = (value: unknown): string | undefined => {
  if (value === null || value === undefined) return undefined;
  if (typeof value !== 'string') return undefined;
  const v = value.trim();
  if (!v) return undefined;
  const lower = v.toLowerCase();
  if (lower === 'null' || lower === 'undefined') return undefined;
  return v;
};


