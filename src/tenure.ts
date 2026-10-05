// Tenure formatting — custom date fields come back from insights in SECONDS, not milliseconds.
//
// Previously shown as a bare whole-year count (Math.floor), which rounds down to a sad "0"
// for anyone employed less than a year. Now shows years AND months, falling back to a
// months-only phrase under a year so a new hire's first few months actually show something.

export interface Tenure {
  years: number;
  months: number;
}

export function computeTenure(startSec: number | null | undefined): Tenure | null {
  if (!startSec) return null;
  const start = new Date(startSec * 1000);
  const now = new Date();
  let years = now.getUTCFullYear() - start.getUTCFullYear();
  let months = now.getUTCMonth() - start.getUTCMonth();
  if (now.getUTCDate() < start.getUTCDate()) months -= 1;
  if (months < 0) { years -= 1; months += 12; }
  if (years < 0) return { years: 0, months: 0 };
  return { years, months };
}

export function formatTenure(startSec: number | null | undefined): string {
  const t = computeTenure(startSec);
  if (!t) return '—';
  if (t.years === 0 && t.months === 0) return 'Less than a month';
  const parts: string[] = [];
  if (t.years > 0) parts.push(`${t.years} year${t.years === 1 ? '' : 's'}`);
  if (t.months > 0) parts.push(`${t.months} month${t.months === 1 ? '' : 's'}`);
  return parts.join(', ');
}

/** Next occurrence of the start date's month/day, on or after today. */
export function formatNextAnniversary(startSec: number | null | undefined): string {
  if (!startSec) return '—';
  const start = new Date(startSec * 1000);
  const now = new Date();
  const todayUTC = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  let next = new Date(Date.UTC(now.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
  if (next.getTime() < todayUTC) {
    next = new Date(Date.UTC(now.getUTCFullYear() + 1, start.getUTCMonth(), start.getUTCDate()));
  }
  return next.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

export function formatDate(startSec: number | null | undefined): string {
  if (!startSec) return '—';
  return new Date(startSec * 1000).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}
