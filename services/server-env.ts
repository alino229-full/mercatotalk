let cachedDotEnv: Record<string, string> | null = null;

type FsLike = {
  existsSync: (path: string) => boolean;
  readFileSync: (path: string, encoding: 'utf8') => string;
};

type PathLike = {
  join: (...parts: string[]) => string;
};

function parseDotEnv(content: string): Record<string, string> {
  const values: Record<string, string> = {};
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const equalIndex = line.indexOf('=');
    if (equalIndex <= 0) continue;
    const key = line.slice(0, equalIndex).trim();
    let value = line.slice(equalIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    values[key] = value;
  }
  return values;
}

function readDotEnv(): Record<string, string> {
  if (cachedDotEnv) return cachedDotEnv;
  cachedDotEnv = {};

  try {
    const nodeRequire = (0, eval)('require') as (id: string) => unknown;
    const fs = nodeRequire('node:fs') as FsLike;
    const path = nodeRequire('node:path') as PathLike;
    const envPath = path.join(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
      cachedDotEnv = parseDotEnv(fs.readFileSync(envPath, 'utf8'));
    }
  } catch {
    cachedDotEnv = {};
  }

  return cachedDotEnv;
}

export function getServerEnv(...keys: string[]): string | undefined {
  for (const key of keys) {
    const runtimeValue = process.env[key]?.trim();
    if (runtimeValue) return runtimeValue;
  }

  const dotEnv = readDotEnv();
  for (const key of keys) {
    const fileValue = dotEnv[key]?.trim();
    if (fileValue) return fileValue;
  }

  return undefined;
}
