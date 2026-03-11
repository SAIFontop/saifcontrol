import { ProfilesSchema, STORAGE_FILES } from '@saifcontrol/shared';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { existsSync } from 'fs';
import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { writeAudit } from '../../lib/audit.js';
import { getStore } from '../../lib/store.js';

type AuthPayload = { sub: string; role: string; username: string };

function getAuthUser(request: FastifyRequest): AuthPayload {
    return (request as any).user as AuthPayload;
}

function requireRole(...roles: string[]) {
    return async (request: FastifyRequest, reply: FastifyReply) => {
        const user = getAuthUser(request);
        if (!roles.includes(user.role)) {
            reply.code(403).send({ success: false, error: 'Insufficient permissions' });
        }
    };
}

const DEFAULT_CONFIG = {
    title: 'AIRWAR',
    subtitle: 'Combat Aviation Server',
    version: 'v2.0.0',

    tips: [
        'Use flares (G) to break missile locks',
        'Stay above enemies for a tactical advantage',
        'High speed helps avoid radar locks',
        'Use terrain for cover against missiles',
        'Switch between missiles and guns for efficiency',
        'Keep an eye on your fuel gauge',
        'Afterburner drains fuel faster — use wisely',
        'Barrel rolls can dodge incoming fire',
        'Team communication wins battles',
        'Check your radar frequently for bogeys',
        'Altitude gives you energy for maneuvers',
        'Head-on attacks are risky — approach from angles',
    ],
    tipRotationMs: 6000,

    aircraft: [
        { name: 'F-22 Raptor', type: 'Air Superiority Fighter', speed: 95, maneuver: 90, armor: 70, weapons: 'AIM-120 AMRAAM, AIM-9X, M61A2', icon: 'fighter' },
        { name: 'Su-57 Felon', type: 'Stealth Fighter', speed: 92, maneuver: 95, armor: 75, weapons: 'R-77, R-73, GSh-30-1', icon: 'stealth' },
        { name: 'F-35 Lightning', type: 'Multi-Role Stealth', speed: 88, maneuver: 80, armor: 80, weapons: 'AIM-120, GBU-31, GAU-22/A', icon: 'jet' },
        { name: 'B-2 Spirit', type: 'Strategic Bomber', speed: 60, maneuver: 30, armor: 95, weapons: 'JDAM, B83, AGM-158', icon: 'bomber' },
        { name: 'MQ-9 Reaper', type: 'Combat Drone', speed: 40, maneuver: 50, armor: 20, weapons: 'AGM-114 Hellfire, GBU-12', icon: 'drone' },
        { name: 'A-10 Warthog', type: 'Close Air Support', speed: 55, maneuver: 65, armor: 98, weapons: 'GAU-8 Avenger, AGM-65', icon: 'cas' },
    ],

    news: [
        { title: 'New Aircraft: Su-57 Felon', body: 'The Russian stealth fighter joins the hangar.', date: '2026-03-12', type: 'update' },
        { title: 'Season 2 Tournament', body: 'Sign up for the upcoming dogfight tournament.', date: '2026-03-15', type: 'event' },
        { title: 'Balance Patch v2.1', body: 'Missile tracking adjusted. Flare cooldown reduced.', date: '2026-03-10', type: 'balance' },
        { title: 'Server Maintenance', body: 'Scheduled maintenance this weekend.', date: '2026-03-14', type: 'announcement' },
    ],

    controls: [
        { key: 'Mouse 1', action: 'Fire Guns', icon: 'gun' },
        { key: 'Mouse 2', action: 'Lock & Fire Missile', icon: 'missile' },
        { key: 'G', action: 'Deploy Flares', icon: 'flare' },
        { key: 'R', action: 'Toggle Radar', icon: 'radar' },
        { key: 'F', action: 'Afterburner', icon: 'flame' },
        { key: 'TAB', action: 'Scoreboard', icon: 'scoreboard' },
        { key: 'E', action: 'Enter/Exit Aircraft', icon: 'jet' },
        { key: 'SHIFT', action: 'Throttle Up', icon: 'throttle' },
    ],

    maxPlayers: 64,

    showParticles: true,
    showJetFlyby: true,
    showMusicPlayer: true,
    showAircraftShowcase: true,
    showPlayerStats: true,
    showServerInfo: true,
    showNewsPanel: true,
    showKeyboardShortcuts: true,
    showTips: true,

    musicEnabled: true,
    musicVolume: 0.3,
};

const CONFIG_FILENAME = 'loading-screen.json';

async function getConfigPath(): Promise<string> {
    const store = getStore();
    return store.getFilePath(CONFIG_FILENAME);
}

async function readConfig(): Promise<typeof DEFAULT_CONFIG> {
    const configPath = await getConfigPath();
    if (!existsSync(configPath)) {
        return { ...DEFAULT_CONFIG };
    }
    const raw = await readFile(configPath, 'utf-8');
    return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
}

async function writeConfig(config: typeof DEFAULT_CONFIG): Promise<void> {
    const store = getStore();
    await store.writeAtomic(CONFIG_FILENAME, config);
}

async function syncToResource(config: typeof DEFAULT_CONFIG): Promise<boolean> {
    const store = getStore();
    const profiles = await store.read(STORAGE_FILES.PROFILES, ProfilesSchema);
    if (!profiles?.activeProfileId) return false;

    const profile = profiles.profiles.find((p: any) => p.id === profiles.activeProfileId);
    if (!profile?.serverDataPath) return false;

    // Try common resource paths
    const possiblePaths = [
        join(profile.serverDataPath, 'resources', '[aw]', 'aw-loading', 'html'),
        join(profile.serverDataPath, 'resources', 'aw-loading', 'html'),
    ];

    for (const htmlDir of possiblePaths) {
        if (existsSync(htmlDir)) {
            const configJsonPath = join(htmlDir, 'config.json');
            await writeFile(configJsonPath, JSON.stringify(config, null, 2), 'utf-8');
            return true;
        }
    }

    return false;
}

export async function loadingScreenRoutes(app: FastifyInstance): Promise<void> {
    // All routes require JWT auth
    app.addHook('onRequest', async (request, reply) => {
        try {
            await request.jwtVerify();
        } catch {
            reply.code(401).send({ success: false, error: 'Unauthorized' });
        }
    });

    // GET config
    app.get('/api/loading-screen/config', async () => {
        const config = await readConfig();
        return { success: true, data: config };
    });

    // PUT config
    app.put('/api/loading-screen/config', {
        preHandler: requireRole('owner', 'admin'),
    }, async (request) => {
        const body = request.body as typeof DEFAULT_CONFIG;
        const config = { ...DEFAULT_CONFIG, ...body };

        await writeConfig(config);

        // Try to sync config.json to the loading screen resource
        const synced = await syncToResource(config);

        const user = getAuthUser(request);
        writeAudit({ userId: user.sub, action: 'loading_screen.config.update', details: { synced }, ip: request.ip });

        return { success: true, data: config, synced };
    });

    // POST sync to resource (manual sync)
    app.post('/api/loading-screen/sync', {
        preHandler: requireRole('owner', 'admin'),
    }, async (request) => {
        const config = await readConfig();
        const synced = await syncToResource(config);

        const user = getAuthUser(request);
        writeAudit({ userId: user.sub, action: 'loading_screen.sync', details: { synced }, ip: request.ip });

        return { success: true, synced };
    });

    // POST reset to defaults
    app.post('/api/loading-screen/reset', {
        preHandler: requireRole('owner', 'admin'),
    }, async (request) => {
        await writeConfig({ ...DEFAULT_CONFIG });

        const user = getAuthUser(request);
        writeAudit({ userId: user.sub, action: 'loading_screen.config.reset', ip: request.ip });

        return { success: true, data: DEFAULT_CONFIG };
    });
}
