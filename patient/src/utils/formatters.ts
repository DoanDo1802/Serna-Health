export function formatCurrency(value: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'decimal',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatPercent(value: number): string {
  return `${value > 0 ? '+' : ''}${value.toFixed(2)}%`;
}

export function smoothScrollTo(elementId: string) {
  const el = document.getElementById(elementId);
  if (el) {
    el.scrollIntoView({ behavior: 'smooth' });
  }
}
