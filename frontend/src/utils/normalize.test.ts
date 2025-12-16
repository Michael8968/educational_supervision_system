import { normalizeOptionalId, normalizeOptionalText } from './normalize';

describe('normalizeOptionalId', () => {
  test('should normalize nullish/empty/sentinel strings to undefined', () => {
    expect(normalizeOptionalId(undefined)).toBeUndefined();
    expect(normalizeOptionalId(null)).toBeUndefined();
    expect(normalizeOptionalId('')).toBeUndefined();
    expect(normalizeOptionalId('   ')).toBeUndefined();
    expect(normalizeOptionalId('null')).toBeUndefined();
    expect(normalizeOptionalId('NULL')).toBeUndefined();
    expect(normalizeOptionalId('undefined')).toBeUndefined();
    expect(normalizeOptionalId('  undefined  ')).toBeUndefined();
  });

  test('should keep normal strings (trimmed)', () => {
    expect(normalizeOptionalId(' abc ')).toBe('abc');
    expect(normalizeOptionalId('0')).toBe('0');
  });
});

describe('normalizeOptionalText', () => {
  test('should normalize nullish/empty/sentinel strings to undefined', () => {
    expect(normalizeOptionalText(undefined)).toBeUndefined();
    expect(normalizeOptionalText(null)).toBeUndefined();
    expect(normalizeOptionalText('')).toBeUndefined();
    expect(normalizeOptionalText('null')).toBeUndefined();
    expect(normalizeOptionalText('undefined')).toBeUndefined();
  });

  test('should keep normal strings (trimmed)', () => {
    expect(normalizeOptionalText('  路径A > 字段B  ')).toBe('路径A > 字段B');
  });
});


