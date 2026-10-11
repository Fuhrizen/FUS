// An explicit sign is a relative adjustment; unsigned values replace the value.
export function numericInput(raw, current) {
  const text = String(raw).trim();
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(text)) throw new Error('Enter a number, or use + / - to adjust the current value.');
  const value = Number(text);
  const result = /^[+-]/.test(text) ? Number(current) + value : value;
  if (!Number.isFinite(result)) throw new Error('The numeric value is too large.');
  return result;
}
