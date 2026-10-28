import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export interface FarolPrintEnv {
    dataDir: string;
    gcodeDir: string;
    databaseUrl: string;

    port: number;

    baseUrl: string;
    authSecret: string;

    webDir: string | null;

    certsDir: string;
    assetsDir: string;

    migrationsDir: string;

    extraOrigins: string[];
    trustedProxies: string[];
    ipAddressHeaders: string[];
    isDev: boolean;
}

let cached: FarolPrintEnv | null = null;

function csv(value: string | undefined): string[] {
    return (value ?? '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
}

function apiRoot(): string {
    return path.resolve(__dirname, '..', '..');
}

function ensureSecret(dataDir: string): string {
    if (process.env.BETTER_AUTH_SECRET) return process.env.BETTER_AUTH_SECRET;
    const file = path.join(dataDir, '.auth-secret');
    try {
        const existing = fs.readFileSync(file, 'utf8').trim();
        if (existing.length >= 32) return existing;
    } catch {}
    const secret = randomBytes(32).toString('hex');
    fs.writeFileSync(file, secret, { mode: 0o600 });
    return secret;
}

export function adoptLegacyEnv(): void {
    for (const [key, value] of Object.entries(process.env)) {
        if (!key.startsWith('KOBRALINK_') || value === undefined) continue;
        const next = `FAROLPRINT_${key.slice('KOBRALINK_'.length)}`;
        if (process.env[next] === undefined) process.env[next] = value;
    }
}

export function adoptLegacyDatabase(dataDir: string): void {
    const next = path.join(dataDir, 'farolprint.db');
    const legacy = path.join(dataDir, 'kobralink.db');
    if (fs.existsSync(next) || !fs.existsSync(legacy)) return;
    for (const suffix of ['', '-wal', '-shm']) {
        if (fs.existsSync(legacy + suffix)) fs.renameSync(legacy + suffix, next + suffix);
    }
}

export function loadEnv(): FarolPrintEnv {
    if (cached) return cached;
    adoptLegacyEnv();
    const root = apiRoot();
    const dataDir = process.env.FAROLPRINT_DATA_DIR
        ? path.resolve(process.env.FAROLPRINT_DATA_DIR)
        : path.resolve(root, '..', '..', 'data');
    const gcodeDir = path.join(dataDir, 'gcodes');
    fs.mkdirSync(gcodeDir, { recursive: true });
    adoptLegacyDatabase(dataDir);

    const port = Number(process.env.FAROLPRINT_PORT ?? 7100);
    const baseUrl = (process.env.BETTER_AUTH_URL ?? `http://localhost:${port}`).replace(/\/$/, '');
    const webDirEnv = process.env.FAROLPRINT_WEB_DIR
        ? path.resolve(process.env.FAROLPRINT_WEB_DIR)
        : path.resolve(root, '..', 'web', 'dist');
    const webDir = fs.existsSync(path.join(webDirEnv, 'index.html')) ? webDirEnv : null;

    cached = {
        dataDir,
        gcodeDir,
        databaseUrl: process.env.DATABASE_URL ?? `file:${path.join(dataDir, 'farolprint.db')}`,
        port,
        baseUrl,
        authSecret: ensureSecret(dataDir),
        webDir,
        certsDir: process.env.FAROLPRINT_CERTS_DIR ?? path.join(root, 'certs'),
        assetsDir: path.join(root, 'assets'),
        migrationsDir: path.join(root, 'prisma', 'migrations'),
        extraOrigins: (process.env.FAROLPRINT_EXTRA_ORIGINS ?? 'http://localhost:5173,http://127.0.0.1:5173')
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
        trustedProxies: csv(process.env.FAROLPRINT_TRUSTED_PROXIES),
        ipAddressHeaders: csv(process.env.FAROLPRINT_IP_HEADERS),
        isDev: process.env.NODE_ENV !== 'production',
    };
    return cached;
}
