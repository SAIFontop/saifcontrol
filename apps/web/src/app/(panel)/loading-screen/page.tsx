'use client';

import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import {
    Check,
    ChevronDown,
    ChevronUp,
    Eye,
    EyeOff,
    Loader2,
    Monitor,
    Plus,
    RefreshCw,
    RotateCcw,
    Save,
    Trash2,
    Upload,
    UploadCloud,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

const container = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.06 } },
};

const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 260, damping: 20 } },
};

interface Aircraft {
    name: string;
    type: string;
    speed: number;
    maneuver: number;
    armor: number;
    weapons: string;
    icon: string;
}

interface NewsItem {
    title: string;
    body: string;
    date: string;
    type: string;
}

interface Control {
    key: string;
    action: string;
    icon: string;
}

interface LoadingConfig {
    title: string;
    subtitle: string;
    version: string;
    tips: string[];
    tipRotationMs: number;
    aircraft: Aircraft[];
    news: NewsItem[];
    controls: Control[];
    maxPlayers: number;
    showParticles: boolean;
    showJetFlyby: boolean;
    showMusicPlayer: boolean;
    showAircraftShowcase: boolean;
    showPlayerStats: boolean;
    showServerInfo: boolean;
    showNewsPanel: boolean;
    showKeyboardShortcuts: boolean;
    showTips: boolean;
    musicEnabled: boolean;
    musicVolume: number;
    musicUrl: string;
    backgroundVideo: string;
}

const AIRCRAFT_ICONS = ['fighter', 'stealth', 'jet', 'bomber', 'drone', 'cas'];
const CONTROL_ICONS = ['gun', 'missile', 'flare', 'radar', 'flame', 'scoreboard', 'jet', 'throttle'];
const NEWS_TYPES = ['update', 'event', 'balance', 'announcement'];

export default function LoadingScreenPage() {
    const [config, setConfig] = useState<LoadingConfig | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [saved, setSaved] = useState(false);
    const [synced, setSynced] = useState<boolean | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'branding' | 'content' | 'visibility' | 'aircraft' | 'news' | 'controls'>('branding');

    const loadConfig = useCallback(async () => {
        setLoading(true);
        const res = await api.getLoadingScreenConfig();
        if (res.success && res.data) {
            setConfig(res.data as unknown as LoadingConfig);
        } else {
            setError(res.error || 'Failed to load config');
        }
        setLoading(false);
    }, []);

    useEffect(() => { loadConfig(); }, [loadConfig]);

    const saveConfig = async () => {
        if (!config) return;
        setSaving(true);
        setSaved(false);
        setError(null);
        const res = await api.saveLoadingScreenConfig(config as unknown as Record<string, unknown>);
        if (res.success) {
            setSaved(true);
            setSynced((res as any).synced ?? null);
            setTimeout(() => setSaved(false), 3000);
        } else {
            setError(res.error || 'Failed to save');
        }
        setSaving(false);
    };

    const syncToServer = async () => {
        setSyncing(true);
        const res = await api.syncLoadingScreen();
        if (res.success) {
            setSynced(res.data?.synced ?? false);
        }
        setSyncing(false);
    };

    const resetConfig = async () => {
        const res = await api.resetLoadingScreen();
        if (res.success && res.data) {
            setConfig(res.data as unknown as LoadingConfig);
        }
    };

    const update = <K extends keyof LoadingConfig>(key: K, value: LoadingConfig[K]) => {
        setConfig((prev) => prev ? { ...prev, [key]: value } : prev);
    };

    if (loading || !config) {
        return (
            <div className="flex items-center justify-center h-64">
                <RefreshCw className="w-6 h-6 text-muted animate-spin" />
            </div>
        );
    }

    const tabs = [
        { id: 'branding' as const, label: 'Branding' },
        { id: 'content' as const, label: 'Tips & Content' },
        { id: 'visibility' as const, label: 'Visibility' },
        { id: 'aircraft' as const, label: 'Aircraft' },
        { id: 'news' as const, label: 'News' },
        { id: 'controls' as const, label: 'Controls' },
    ];

    return (
        <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
            {/* Header */}
            <motion.div variants={item} className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
                        <Monitor className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-text">Loading Screen</h1>
                        <p className="text-sm text-muted">Configure your FiveM loading screen</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={resetConfig}
                        className="flex items-center gap-2 px-3 py-2 rounded-xl bg-card border border-border text-muted hover:text-text transition text-sm"
                    >
                        <RotateCcw className="w-4 h-4" /> Reset
                    </button>
                    <button
                        onClick={syncToServer}
                        disabled={syncing}
                        className="flex items-center gap-2 px-3 py-2 rounded-xl bg-accent/15 text-accent hover:bg-accent/25 transition text-sm disabled:opacity-50"
                    >
                        <Upload className="w-4 h-4" /> {syncing ? 'Syncing...' : 'Sync to Server'}
                    </button>
                    <button
                        onClick={saveConfig}
                        disabled={saving}
                        className={cn(
                            'flex items-center gap-2 px-4 py-2 rounded-xl transition text-sm font-medium disabled:opacity-50',
                            saved ? 'bg-success/15 text-success' : 'bg-primary/15 text-primary hover:bg-primary/25',
                        )}
                    >
                        {saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                        {saved ? 'Saved!' : saving ? 'Saving...' : 'Save & Deploy'}
                    </button>
                </div>
            </motion.div>

            {/* Status Banner */}
            {(error || synced !== null) && (
                <motion.div
                    variants={item}
                    className={cn(
                        'glass-card p-3 text-sm flex items-center gap-2',
                        error ? 'border-danger/30 text-danger' : synced ? 'border-success/30 text-success' : 'border-warning/30 text-warning',
                    )}
                >
                    {error ? error : synced ? 'Config synced to server resource' : 'Config saved but could not auto-sync to server (resource path not found)'}
                </motion.div>
            )}

            {/* Tabs */}
            <motion.div variants={item} className="flex gap-1 bg-card/50 p-1 rounded-xl border border-border">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={cn(
                            'flex-1 px-3 py-2 rounded-lg text-sm font-medium transition',
                            activeTab === tab.id ? 'bg-primary/15 text-primary' : 'text-muted hover:text-text',
                        )}
                    >
                        {tab.label}
                    </button>
                ))}
            </motion.div>

            {/* Tab Content */}
            {activeTab === 'branding' && (
                <motion.div variants={item} className="glass-card p-6 space-y-5">
                    <h2 className="text-lg font-semibold text-text">Branding</h2>

                    <Field label="Title" value={config.title} onChange={(v) => update('title', v)} />
                    <Field label="Subtitle" value={config.subtitle} onChange={(v) => update('subtitle', v)} />
                    <Field label="Version" value={config.version} onChange={(v) => update('version', v)} />
                    <NumberField label="Max Players" value={config.maxPlayers} onChange={(v) => update('maxPlayers', v)} min={1} max={1024} />

                    <div className="pt-4 border-t border-border">
                        <h3 className="text-sm font-semibold text-text mb-3">Background Video</h3>
                        <p className="text-xs text-muted mb-2">Upload a video file or paste a direct URL. Plays behind all UI elements.</p>
                        <Field label="Video URL or filename (e.g. bg.mp4)" value={config.backgroundVideo} onChange={(v) => update('backgroundVideo', v)} />
                        <FileUpload
                            accept="video/mp4,video/webm,video/ogg"
                            label="Upload Video"
                            onUploaded={(filename) => update('backgroundVideo', filename)}
                        />
                    </div>
                </motion.div>
            )}

            {activeTab === 'content' && (
                <motion.div variants={item} className="glass-card p-6 space-y-5">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-semibold text-text">Tips</h2>
                        <button
                            onClick={() => update('tips', [...config.tips, ''])}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary/15 text-primary hover:bg-primary/25 transition text-sm"
                        >
                            <Plus className="w-3.5 h-3.5" /> Add Tip
                        </button>
                    </div>

                    <NumberField label="Tip Rotation (ms)" value={config.tipRotationMs} onChange={(v) => update('tipRotationMs', v)} min={1000} max={30000} step={500} />

                    <div className="space-y-2">
                        {config.tips.map((tip, i) => (
                            <div key={i} className="flex gap-2">
                                <input
                                    type="text"
                                    value={tip}
                                    onChange={(e) => {
                                        const tips = [...config.tips];
                                        tips[i] = e.target.value;
                                        update('tips', tips);
                                    }}
                                    className="flex-1 px-3 py-2 rounded-lg bg-card border border-border text-text text-sm focus:outline-none focus:border-primary/50"
                                    placeholder={`Tip ${i + 1}`}
                                />
                                <button
                                    onClick={() => update('tips', config.tips.filter((_, idx) => idx !== i))}
                                    className="p-2 rounded-lg text-danger/60 hover:text-danger hover:bg-danger/10 transition"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        ))}
                    </div>

                    <div className="pt-4 border-t border-border">
                        <h3 className="text-sm font-semibold text-text mb-3">Music</h3>
                        <p className="text-xs text-muted mb-2">Upload an audio file or paste a direct URL.</p>
                        <Field label="Music URL or filename (e.g. music.mp3)" value={config.musicUrl} onChange={(v) => update('musicUrl', v)} />
                        <FileUpload
                            accept="audio/mpeg,audio/ogg,audio/wav,audio/mp4"
                            label="Upload Audio"
                            onUploaded={(filename) => update('musicUrl', filename)}
                        />
                        <div className="flex items-center gap-4 mt-3">
                            <Toggle label="Music Enabled" value={config.musicEnabled} onChange={(v) => update('musicEnabled', v)} />
                            <NumberField label="Volume" value={config.musicVolume} onChange={(v) => update('musicVolume', v)} min={0} max={1} step={0.05} />
                        </div>
                    </div>
                </motion.div>
            )}

            {activeTab === 'visibility' && (
                <motion.div variants={item} className="glass-card p-6 space-y-5">
                    <h2 className="text-lg font-semibold text-text">Component Visibility</h2>
                    <p className="text-sm text-muted">Toggle which sections are visible on the loading screen.</p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <Toggle label="Particle Background" value={config.showParticles} onChange={(v) => update('showParticles', v)} />
                        <Toggle label="Jet Flyby Animation" value={config.showJetFlyby} onChange={(v) => update('showJetFlyby', v)} />
                        <Toggle label="Music Player" value={config.showMusicPlayer} onChange={(v) => update('showMusicPlayer', v)} />
                        <Toggle label="Aircraft Showcase" value={config.showAircraftShowcase} onChange={(v) => update('showAircraftShowcase', v)} />
                        <Toggle label="Player Statistics" value={config.showPlayerStats} onChange={(v) => update('showPlayerStats', v)} />
                        <Toggle label="Server Info" value={config.showServerInfo} onChange={(v) => update('showServerInfo', v)} />
                        <Toggle label="News Panel" value={config.showNewsPanel} onChange={(v) => update('showNewsPanel', v)} />
                        <Toggle label="Keyboard Shortcuts" value={config.showKeyboardShortcuts} onChange={(v) => update('showKeyboardShortcuts', v)} />
                        <Toggle label="Tips" value={config.showTips} onChange={(v) => update('showTips', v)} />
                    </div>
                </motion.div>
            )}

            {activeTab === 'aircraft' && (
                <motion.div variants={item} className="glass-card p-6 space-y-5">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-semibold text-text">Aircraft Database</h2>
                        <button
                            onClick={() => update('aircraft', [...config.aircraft, { name: '', type: '', speed: 50, maneuver: 50, armor: 50, weapons: '', icon: 'fighter' }])}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary/15 text-primary hover:bg-primary/25 transition text-sm"
                        >
                            <Plus className="w-3.5 h-3.5" /> Add Aircraft
                        </button>
                    </div>

                    <div className="space-y-4">
                        {config.aircraft.map((ac, i) => (
                            <AircraftEditor
                                key={i}
                                aircraft={ac}
                                index={i}
                                onChange={(updated) => {
                                    const list = [...config.aircraft];
                                    list[i] = updated;
                                    update('aircraft', list);
                                }}
                                onRemove={() => update('aircraft', config.aircraft.filter((_, idx) => idx !== i))}
                                onMoveUp={i > 0 ? () => {
                                    const list = [...config.aircraft];
                                    [list[i - 1], list[i]] = [list[i], list[i - 1]];
                                    update('aircraft', list);
                                } : undefined}
                                onMoveDown={i < config.aircraft.length - 1 ? () => {
                                    const list = [...config.aircraft];
                                    [list[i], list[i + 1]] = [list[i + 1], list[i]];
                                    update('aircraft', list);
                                } : undefined}
                            />
                        ))}
                    </div>
                </motion.div>
            )}

            {activeTab === 'news' && (
                <motion.div variants={item} className="glass-card p-6 space-y-5">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-semibold text-text">Server News</h2>
                        <button
                            onClick={() => update('news', [...config.news, { title: '', body: '', date: new Date().toISOString().split('T')[0], type: 'update' }])}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary/15 text-primary hover:bg-primary/25 transition text-sm"
                        >
                            <Plus className="w-3.5 h-3.5" /> Add News
                        </button>
                    </div>

                    <div className="space-y-4">
                        {config.news.map((n, i) => (
                            <div key={i} className="p-4 rounded-xl bg-card border border-border space-y-3">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm font-medium text-text">News #{i + 1}</span>
                                    <button
                                        onClick={() => update('news', config.news.filter((_, idx) => idx !== i))}
                                        className="p-1.5 rounded-lg text-danger/60 hover:text-danger hover:bg-danger/10 transition"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                                <Field label="Title" value={n.title} onChange={(v) => {
                                    const list = [...config.news]; list[i] = { ...n, title: v }; update('news', list);
                                }} />
                                <Field label="Body" value={n.body} onChange={(v) => {
                                    const list = [...config.news]; list[i] = { ...n, body: v }; update('news', list);
                                }} />
                                <div className="grid grid-cols-2 gap-3">
                                    <Field label="Date" value={n.date} onChange={(v) => {
                                        const list = [...config.news]; list[i] = { ...n, date: v }; update('news', list);
                                    }} type="date" />
                                    <SelectField label="Type" value={n.type} options={NEWS_TYPES} onChange={(v) => {
                                        const list = [...config.news]; list[i] = { ...n, type: v }; update('news', list);
                                    }} />
                                </div>
                            </div>
                        ))}
                    </div>
                </motion.div>
            )}

            {activeTab === 'controls' && (
                <motion.div variants={item} className="glass-card p-6 space-y-5">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-semibold text-text">Keyboard Controls</h2>
                        <button
                            onClick={() => update('controls', [...config.controls, { key: '', action: '', icon: 'gun' }])}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary/15 text-primary hover:bg-primary/25 transition text-sm"
                        >
                            <Plus className="w-3.5 h-3.5" /> Add Control
                        </button>
                    </div>

                    <div className="space-y-2">
                        {config.controls.map((ctrl, i) => (
                            <div key={i} className="flex items-center gap-2 p-3 rounded-xl bg-card border border-border">
                                <input
                                    type="text"
                                    value={ctrl.key}
                                    onChange={(e) => {
                                        const list = [...config.controls]; list[i] = { ...ctrl, key: e.target.value }; update('controls', list);
                                    }}
                                    className="w-24 px-2 py-1.5 rounded-lg bg-background border border-border text-text text-sm focus:outline-none focus:border-primary/50"
                                    placeholder="Key"
                                />
                                <input
                                    type="text"
                                    value={ctrl.action}
                                    onChange={(e) => {
                                        const list = [...config.controls]; list[i] = { ...ctrl, action: e.target.value }; update('controls', list);
                                    }}
                                    className="flex-1 px-2 py-1.5 rounded-lg bg-background border border-border text-text text-sm focus:outline-none focus:border-primary/50"
                                    placeholder="Action"
                                />
                                <select
                                    value={ctrl.icon}
                                    onChange={(e) => {
                                        const list = [...config.controls]; list[i] = { ...ctrl, icon: e.target.value }; update('controls', list);
                                    }}
                                    className="px-2 py-1.5 rounded-lg bg-background border border-border text-text text-sm focus:outline-none focus:border-primary/50"
                                >
                                    {CONTROL_ICONS.map((ic) => (
                                        <option key={ic} value={ic}>{ic}</option>
                                    ))}
                                </select>
                                <button
                                    onClick={() => update('controls', config.controls.filter((_, idx) => idx !== i))}
                                    className="p-1.5 rounded-lg text-danger/60 hover:text-danger hover:bg-danger/10 transition"
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        ))}
                    </div>
                </motion.div>
            )}
        </motion.div>
    );
}

// ─── Reusable form components ───

function Field({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
    return (
        <div>
            <label className="block text-xs font-medium text-muted mb-1">{label}</label>
            <input
                type={type}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-card border border-border text-text text-sm focus:outline-none focus:border-primary/50"
            />
        </div>
    );
}

function NumberField({ label, value, onChange, min, max, step = 1 }: { label: string; value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number }) {
    return (
        <div>
            <label className="block text-xs font-medium text-muted mb-1">{label}</label>
            <input
                type="number"
                value={value}
                min={min}
                max={max}
                step={step}
                onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 rounded-lg bg-card border border-border text-text text-sm focus:outline-none focus:border-primary/50"
            />
        </div>
    );
}

function SelectField({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
    return (
        <div>
            <label className="block text-xs font-medium text-muted mb-1">{label}</label>
            <select
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-card border border-border text-text text-sm focus:outline-none focus:border-primary/50"
            >
                {options.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                ))}
            </select>
        </div>
    );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
    return (
        <button
            onClick={() => onChange(!value)}
            className={cn(
                'flex items-center gap-3 p-3 rounded-xl border transition w-full text-left',
                value ? 'bg-primary/10 border-primary/30' : 'bg-card border-border',
            )}
        >
            <div className={cn(
                'w-9 h-5 rounded-full relative transition-colors',
                value ? 'bg-primary' : 'bg-border',
            )}>
                <div className={cn(
                    'absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform',
                    value ? 'translate-x-4' : 'translate-x-0.5',
                )} />
            </div>
            <span className={cn('text-sm', value ? 'text-text' : 'text-muted')}>{label}</span>
            {value ? <Eye className="w-3.5 h-3.5 text-primary ml-auto" /> : <EyeOff className="w-3.5 h-3.5 text-muted ml-auto" />}
        </button>
    );
}

function FileUpload({ accept, label, onUploaded }: { accept: string; label: string; onUploaded: (filename: string) => void }) {
    const [uploading, setUploading] = useState(false);
    const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const handleUpload = async (file: File) => {
        setUploading(true);
        setResult(null);
        const res = await api.uploadLoadingScreenFile(file);
        if (res.success && res.data) {
            setResult({ success: true, message: `Uploaded & synced: ${res.data.filename}` });
            onUploaded(res.data.filename);
        } else {
            setResult({ success: false, message: res.error || 'Upload failed' });
        }
        setUploading(false);
    };

    return (
        <div className="mt-2">
            <input
                ref={inputRef}
                type="file"
                accept={accept}
                className="hidden"
                onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleUpload(file);
                    e.target.value = '';
                }}
            />
            <button
                onClick={() => inputRef.current?.click()}
                disabled={uploading}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-accent/15 text-accent hover:bg-accent/25 transition text-sm disabled:opacity-50"
            >
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />}
                {uploading ? 'Uploading...' : label}
            </button>
            {result && (
                <p className={cn('text-xs mt-1', result.success ? 'text-success' : 'text-danger')}>
                    {result.message}
                </p>
            )}
        </div>
    );
}

function AircraftEditor({ aircraft, index, onChange, onRemove, onMoveUp, onMoveDown }: {
    aircraft: Aircraft;
    index: number;
    onChange: (ac: Aircraft) => void;
    onRemove: () => void;
    onMoveUp?: () => void;
    onMoveDown?: () => void;
}) {
    const [expanded, setExpanded] = useState(false);

    return (
        <div className="rounded-xl bg-card border border-border overflow-hidden">
            <div className="flex items-center justify-between p-4 cursor-pointer" onClick={() => setExpanded(!expanded)}>
                <div className="flex items-center gap-3">
                    <span className="w-7 h-7 rounded-lg bg-primary/15 flex items-center justify-center text-xs font-mono text-primary">
                        {index + 1}
                    </span>
                    <div>
                        <span className="text-sm font-medium text-text">{aircraft.name || 'Unnamed'}</span>
                        <span className="text-xs text-muted ml-2">{aircraft.type}</span>
                    </div>
                </div>
                <div className="flex items-center gap-1">
                    {onMoveUp && (
                        <button onClick={(e) => { e.stopPropagation(); onMoveUp(); }} className="p-1 text-muted hover:text-text transition">
                            <ChevronUp className="w-4 h-4" />
                        </button>
                    )}
                    {onMoveDown && (
                        <button onClick={(e) => { e.stopPropagation(); onMoveDown(); }} className="p-1 text-muted hover:text-text transition">
                            <ChevronDown className="w-4 h-4" />
                        </button>
                    )}
                    <button onClick={(e) => { e.stopPropagation(); onRemove(); }} className="p-1 text-danger/60 hover:text-danger transition">
                        <Trash2 className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {expanded && (
                <div className="px-4 pb-4 space-y-3 border-t border-border pt-3">
                    <div className="grid grid-cols-2 gap-3">
                        <Field label="Name" value={aircraft.name} onChange={(v) => onChange({ ...aircraft, name: v })} />
                        <Field label="Type" value={aircraft.type} onChange={(v) => onChange({ ...aircraft, type: v })} />
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                        <NumberField label="Speed" value={aircraft.speed} onChange={(v) => onChange({ ...aircraft, speed: v })} min={0} max={100} />
                        <NumberField label="Maneuver" value={aircraft.maneuver} onChange={(v) => onChange({ ...aircraft, maneuver: v })} min={0} max={100} />
                        <NumberField label="Armor" value={aircraft.armor} onChange={(v) => onChange({ ...aircraft, armor: v })} min={0} max={100} />
                    </div>
                    <Field label="Weapons" value={aircraft.weapons} onChange={(v) => onChange({ ...aircraft, weapons: v })} />
                    <SelectField label="Icon" value={aircraft.icon} options={AIRCRAFT_ICONS} onChange={(v) => onChange({ ...aircraft, icon: v })} />
                </div>
            )}
        </div>
    );
}
