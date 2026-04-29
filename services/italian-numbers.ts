const UNITS = [
  'zero',
  'uno',
  'due',
  'tre',
  'quattro',
  'cinque',
  'sei',
  'sette',
  'otto',
  'nove',
] as const;

const TEENS: Record<number, string> = {
  10: 'dieci',
  11: 'undici',
  12: 'dodici',
  13: 'tredici',
  14: 'quattordici',
  15: 'quindici',
  16: 'sedici',
  17: 'diciassette',
  18: 'diciotto',
  19: 'diciannove',
};

const TENS: Record<number, string> = {
  20: 'venti',
  30: 'trenta',
  40: 'quaranta',
  50: 'cinquanta',
  60: 'sessanta',
  70: 'settanta',
  80: 'ottanta',
  90: 'novanta',
};

export type NumberDrillMode = 'price' | 'dimension' | 'date' | 'plain';

export type NumberDrillItem = {
  id: string;
  mode: NumberDrillMode;
  numeric: string;
  spoken: string;
  promptFr: string;
};

function normalizeInteger(value: number): number {
  return Math.max(0, Math.min(999999, Math.floor(Math.abs(value))));
}

function underHundred(n: number): string {
  if (n < 10) return UNITS[n] ?? 'zero';
  if (n < 20) return TEENS[n] ?? '';
  const ten = Math.floor(n / 10) * 10;
  const unit = n % 10;
  const base = TENS[ten] ?? '';
  if (unit === 0) return base;
  return unit === 1 || unit === 8 ? `${base.slice(0, -1)}${UNITS[unit]}` : `${base}${UNITS[unit]}`;
}

function underThousand(n: number): string {
  if (n < 100) return underHundred(n);
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  const prefix = hundreds === 1 ? 'cento' : `${UNITS[hundreds]}cento`;
  const adjustedPrefix = rest >= 80 && rest < 90 ? prefix.slice(0, -1) : prefix;
  return rest === 0 ? adjustedPrefix : `${adjustedPrefix}${underHundred(rest)}`;
}

export function integerToItalian(value: number): string {
  const n = normalizeInteger(value);
  if (n < 1000) return underThousand(n);
  if (n < 2000) {
    const rest = n - 1000;
    return rest === 0 ? 'mille' : `mille${underThousand(rest)}`;
  }
  const thousands = Math.floor(n / 1000);
  const rest = n % 1000;
  const prefix = `${underThousand(thousands)}mila`;
  return rest === 0 ? prefix : `${prefix}${underThousand(rest)}`;
}

export function readItalianNumber(input: string | number, mode: NumberDrillMode = 'plain'): string {
  const raw = String(input).trim().replace(/\s/g, '').replace(',', '.');
  const numeric = Number.parseFloat(raw);
  if (!Number.isFinite(numeric)) return '';

  if (mode === 'price') {
    const euros = Math.floor(numeric);
    const cents = Math.round((numeric - euros) * 100);
    const euroText = `${integerToItalian(euros)} euro`;
    return cents > 0 ? `${euroText} e ${integerToItalian(cents)} centesimi` : euroText;
  }

  if (mode === 'dimension') {
    return `${integerToItalian(numeric)} metri`;
  }

  return integerToItalian(numeric);
}

export function readItalianDate(day: number, month: number): string {
  const safeDay = Math.max(1, Math.min(31, Math.floor(day)));
  const safeMonth = Math.max(1, Math.min(12, Math.floor(month)));
  return `entro il ${safeDay === 1 ? 'primo' : integerToItalian(safeDay)} del ${integerToItalian(safeMonth)}`;
}

export function buildNumberDrill(mode: NumberDrillMode, speedLevel: number): NumberDrillItem {
  const seed = Date.now() + Math.round(Math.random() * 10000);
  const base = seed % 8900;

  if (mode === 'date') {
    const day = (base % 28) + 1;
    const month = ((base >> 2) % 12) + 1;
    const numeric = `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}`;
    return {
      id: `date-${seed}`,
      mode,
      numeric,
      spoken: readItalianDate(day, month),
      promptFr: 'Date limite entendue',
    };
  }

  if (mode === 'dimension') {
    const meters = 2 + (base % 39);
    return {
      id: `dim-${seed}`,
      mode,
      numeric: `${meters} m`,
      spoken: `${readItalianNumber(meters, 'plain')} metri`,
      promptFr: 'Dimension entendue',
    };
  }

  const amount = speedLevel > 2 ? 900 + base : 80 + (base % 2400);
  return {
    id: `price-${seed}`,
    mode: 'price',
    numeric: `${amount} €`,
    spoken: readItalianNumber(amount, 'price'),
    promptFr: 'Prix entendu',
  };
}

export function normalizeNumberAnswer(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, '').replace('€', '').replace('eur', '').replace('euro', '');
}
