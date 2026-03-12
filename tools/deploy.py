#!/usr/bin/env python3
"""
╔══════════════════════════════════════════════════════════════╗
║              SAIFCONTROL DEPLOYMENT TOOL v1.0                ║
║          Remote Server Management for Kali Linux             ║
╚══════════════════════════════════════════════════════════════╝

Usage:
    python tools/deploy.py                  → Interactive menu
    python tools/deploy.py panel            → Update panel only
    python tools/deploy.py fivem            → Update FiveM resources only
    python tools/deploy.py all              → Update everything
    python tools/deploy.py status           → Check server status
    python tools/deploy.py logs [service]   → View service logs
    python tools/deploy.py shell            → Interactive SSH shell
    python tools/deploy.py sync-info        → Check loading screen sync paths
    python tools/deploy.py push             → Git push from Windows + deploy
"""

import argparse
import getpass
import json
import os
import re
import socket
import subprocess
import sys
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

# ─── Configuration ────────────────────────────────────────────
SERVER_HOST = "192.168.0.50"
SERVER_USER = "saif"
SERVER_PORT = 22

# Paths on the server
SAIFCONTROL_DIR = "/home/saif/saifcontrol"
FIVEM_BASE = "/home/saif/fivem/txData/FiveMBasicServerCFXDefault_AF9998.base"
FIVEM_RESOURCES = f"{FIVEM_BASE}/resources/[aw]"

# Panel services
SERVICES = ["saifcontrol-api", "saifcontrol-web"]

# API
API_PORT = 4800
WEB_PORT = 3000

# Local repo path
LOCAL_REPO = Path(__file__).resolve().parent.parent

# ─── ANSI Colors ──────────────────────────────────────────────
class C:
    RESET   = "\033[0m"
    BOLD    = "\033[1m"
    DIM     = "\033[2m"
    RED     = "\033[91m"
    GREEN   = "\033[92m"
    YELLOW  = "\033[93m"
    BLUE    = "\033[94m"
    MAGENTA = "\033[95m"
    CYAN    = "\033[96m"
    WHITE   = "\033[97m"
    BG_RED  = "\033[41m"
    BG_GREEN = "\033[42m"
    BG_BLUE = "\033[44m"

def banner():
    print(f"""
{C.CYAN}{C.BOLD}╔══════════════════════════════════════════════════════════════╗
║{C.YELLOW}     ███████╗ █████╗ ██╗███████╗ ██████╗████████╗██████╗ ██╗   {C.CYAN}║
║{C.YELLOW}     ██╔════╝██╔══██╗██║██╔════╝██╔════╝╚══██╔══╝██╔══██╗██║   {C.CYAN}║
║{C.YELLOW}     ███████╗███████║██║█████╗  ██║        ██║   ██████╔╝██║   {C.CYAN}║
║{C.YELLOW}     ╚════██║██╔══██║██║██╔══╝  ██║        ██║   ██╔══██╗██║   {C.CYAN}║
║{C.YELLOW}     ███████║██║  ██║██║██║     ╚██████╗   ██║   ██║  ██║███████╗{C.CYAN}║
║{C.YELLOW}     ╚══════╝╚═╝  ╚═╝╚═╝╚═╝      ╚═════╝   ╚═╝   ╚═╝  ╚═╝╚══════╝{C.CYAN}║
║                                                              ║
║{C.WHITE}           DEPLOYMENT & SERVER MANAGEMENT TOOL               {C.CYAN}║
║{C.DIM}{C.WHITE}              Server: {SERVER_HOST} │ User: {SERVER_USER}                {C.RESET}{C.CYAN}║
╚══════════════════════════════════════════════════════════════╝{C.RESET}
""")

def info(msg: str):
    print(f"  {C.BLUE}ℹ{C.RESET}  {msg}")

def success(msg: str):
    print(f"  {C.GREEN}✓{C.RESET}  {C.GREEN}{msg}{C.RESET}")

def warn(msg: str):
    print(f"  {C.YELLOW}⚠{C.RESET}  {C.YELLOW}{msg}{C.RESET}")

def error(msg: str):
    print(f"  {C.RED}✗{C.RESET}  {C.RED}{msg}{C.RESET}")

def step(msg: str):
    print(f"\n  {C.CYAN}{C.BOLD}▸ {msg}{C.RESET}")

def divider():
    print(f"  {C.DIM}{'─' * 56}{C.RESET}")

def confirm(msg: str) -> bool:
    resp = input(f"\n  {C.YELLOW}⚠ {msg} [y/N]: {C.RESET}").strip().lower()
    return resp in ('y', 'yes')


# ─── SSH Connection ───────────────────────────────────────────
@dataclass
class SSHResult:
    exit_code: int
    stdout: str
    stderr: str

    @property
    def ok(self) -> bool:
        return self.exit_code == 0


class SSHConnection:
    """Manages SSH connection to the Kali server using paramiko."""

    def __init__(self, host: str, user: str, port: int = 22):
        self.host = host
        self.user = user
        self.port = port
        self._client = None
        self._password: Optional[str] = None

    def connect(self) -> bool:
        try:
            import paramiko
        except ImportError:
            error("paramiko not installed. Installing...")
            subprocess.check_call([sys.executable, "-m", "pip", "install", "paramiko", "-q"])
            import paramiko

        self._client = paramiko.SSHClient()
        self._client.set_missing_host_key_policy(paramiko.AutoAddPolicy())

        # Try key-based auth first
        try:
            self._client.connect(
                hostname=self.host,
                port=self.port,
                username=self.user,
                timeout=10,
                look_for_keys=True,
                allow_agent=True,
            )
            success(f"Connected to {self.host} (SSH key)")
            return True
        except Exception:
            pass

        # Fall back to password
        try:
            if not self._password:
                self._password = getpass.getpass(f"  🔑 SSH Password for {self.user}@{self.host}: ")
            self._client.connect(
                hostname=self.host,
                port=self.port,
                username=self.user,
                password=self._password,
                timeout=10,
            )
            success(f"Connected to {self.host} (password)")
            return True
        except Exception as e:
            error(f"SSH connection failed: {e}")
            self._client = None
            return False

    def close(self):
        if self._client:
            self._client.close()
            self._client = None

    @property
    def connected(self) -> bool:
        if not self._client:
            return False
        try:
            transport = self._client.get_transport()
            return transport is not None and transport.is_active()
        except Exception:
            return False

    def ensure_connected(self) -> bool:
        if not self.connected:
            return self.connect()
        return True

    def run(self, cmd: str, sudo: bool = False, stream: bool = False, timeout: int = 120) -> SSHResult:
        """Execute a command on the remote server."""
        if not self.ensure_connected():
            return SSHResult(exit_code=-1, stdout="", stderr="Connection failed")

        if sudo:
            if self._password:
                cmd = f"echo '{self._password}' | sudo -S bash -c '{cmd}'"
            else:
                cmd = f"sudo {cmd}"

        try:
            stdin, stdout_ch, stderr_ch = self._client.exec_command(cmd, timeout=timeout)

            if stream:
                # Print output in real-time
                output_lines = []
                for line in stdout_ch:
                    line_text = line.strip('\n')
                    output_lines.append(line_text)
                    print(f"    {C.DIM}{line_text}{C.RESET}")
                stdout_text = '\n'.join(output_lines)
            else:
                stdout_text = stdout_ch.read().decode('utf-8', errors='replace').strip()

            stderr_text = stderr_ch.read().decode('utf-8', errors='replace').strip()
            exit_code = stdout_ch.channel.recv_exit_status()

            # Filter out sudo password prompts from stderr
            stderr_filtered = '\n'.join(
                line for line in stderr_text.split('\n')
                if not line.startswith('[sudo]') and 'password' not in line.lower()
            ).strip()

            return SSHResult(exit_code=exit_code, stdout=stdout_text, stderr=stderr_filtered)
        except Exception as e:
            return SSHResult(exit_code=-1, stdout="", stderr=str(e))

    def run_steps(self, steps: list[tuple[str, str]], sudo: bool = False) -> bool:
        """Run a sequence of (description, command) steps. Stop on first failure."""
        for desc, cmd in steps:
            step(desc)
            result = self.run(cmd, sudo=sudo, stream=True)
            if not result.ok:
                error(f"Failed: {desc}")
                if result.stderr:
                    print(f"    {C.RED}{result.stderr}{C.RESET}")
                return False
            success(desc)
        return True

    def interactive_shell(self):
        """Open an interactive SSH session."""
        if not self.ensure_connected():
            error("Cannot open shell — not connected")
            return

        print(f"\n  {C.GREEN}Connected to {self.host}. Type 'exit' or Ctrl+C to return.{C.RESET}\n")
        while True:
            try:
                cmd = input(f"  {C.CYAN}{self.user}@kali{C.RESET}:{C.BLUE}~{C.RESET}$ ").strip()
                if not cmd:
                    continue
                if cmd.lower() in ('exit', 'quit', 'q'):
                    break
                result = self.run(cmd, stream=True)
                if result.stderr:
                    print(f"    {C.RED}{result.stderr}{C.RESET}")
            except (KeyboardInterrupt, EOFError):
                print()
                break
        print(f"\n  {C.DIM}Shell closed.{C.RESET}")


# ─── Command Actions ─────────────────────────────────────────

def action_status(ssh: SSHConnection):
    """Check status of all services and ports."""
    step("Checking services status")
    divider()

    for svc in SERVICES:
        result = ssh.run(f"systemctl is-active {svc}")
        status = result.stdout.strip()
        if status == "active":
            print(f"    {C.GREEN}● {svc}{C.RESET} — {C.GREEN}active{C.RESET}")
        elif status == "inactive":
            print(f"    {C.RED}○ {svc}{C.RESET} — {C.RED}inactive{C.RESET}")
        else:
            print(f"    {C.YELLOW}? {svc}{C.RESET} — {C.YELLOW}{status}{C.RESET}")

    divider()
    step("Checking ports")

    for port, name in [(API_PORT, "API"), (WEB_PORT, "Web"), (30120, "FiveM"), (40120, "txAdmin")]:
        result = ssh.run(f"ss -tlnp | grep :{port}")
        if result.stdout.strip():
            print(f"    {C.GREEN}● Port {port}{C.RESET} ({name}) — {C.GREEN}LISTENING{C.RESET}")
        else:
            print(f"    {C.RED}○ Port {port}{C.RESET} ({name}) — {C.RED}NOT LISTENING{C.RESET}")

    divider()
    step("System resources")

    result = ssh.run("free -h | awk '/Mem:/ {print $3\"/\"$2}'")
    if result.ok:
        print(f"    RAM Usage: {C.CYAN}{result.stdout}{C.RESET}")

    result = ssh.run("df -h / | awk 'NR==2 {print $3\"/\"$2\" (\"$5\" used)\"}'")
    if result.ok:
        print(f"    Disk Usage: {C.CYAN}{result.stdout}{C.RESET}")

    result = ssh.run("uptime -p")
    if result.ok:
        print(f"    Uptime: {C.CYAN}{result.stdout}{C.RESET}")

    result = ssh.run("nproc")
    cores = result.stdout.strip() if result.ok else "?"
    result = ssh.run("cat /proc/loadavg | awk '{print $1, $2, $3}'")
    if result.ok:
        print(f"    Load ({cores} cores): {C.CYAN}{result.stdout}{C.RESET}")


def action_update_panel(ssh: SSHConnection):
    """Pull latest code, install deps, build, and restart panel services."""
    step("Updating SaifControl Panel")
    divider()

    ok = ssh.run_steps([
        ("Pulling latest code", f"cd {SAIFCONTROL_DIR} && git pull"),
        ("Installing API dependencies", f"cd {SAIFCONTROL_DIR}/apps/api && npm install"),
        ("Building API", f"cd {SAIFCONTROL_DIR}/apps/api && npm run build"),
        ("Building Web", f"cd {SAIFCONTROL_DIR}/apps/web && npm run build"),
    ])

    if not ok:
        error("Build failed — services NOT restarted")
        return False

    step("Restarting services")
    for svc in SERVICES:
        result = ssh.run(f"systemctl restart {svc}", sudo=True)
        if result.ok:
            success(f"Restarted {svc}")
        else:
            error(f"Failed to restart {svc}: {result.stderr}")

    # Quick health check
    step("Health check (waiting 5s)")
    time.sleep(5)
    for svc in SERVICES:
        result = ssh.run(f"systemctl is-active {svc}")
        status = result.stdout.strip()
        if status == "active":
            success(f"{svc} is running")
        else:
            error(f"{svc} is {status}")

    return True


def action_update_fivem(ssh: SSHConnection):
    """Pull latest FiveM resources."""
    step("Updating FiveM Resources (airwar)")
    divider()

    result = ssh.run(f"cd '{FIVEM_RESOURCES}' && git pull", stream=True)
    if result.ok:
        success("FiveM resources updated")
    else:
        error(f"Failed: {result.stderr}")
        return False
    return True


def action_update_all(ssh: SSHConnection):
    """Update panel + FiveM resources."""
    ok1 = action_update_panel(ssh)
    print()
    ok2 = action_update_fivem(ssh)
    return ok1 and ok2


def action_restart_services(ssh: SSHConnection):
    """Restart panel services only."""
    step("Restarting Panel Services")
    for svc in SERVICES:
        result = ssh.run(f"systemctl restart {svc}", sudo=True)
        if result.ok:
            success(f"Restarted {svc}")
        else:
            error(f"Failed: {result.stderr}")


def action_logs(ssh: SSHConnection, service: Optional[str] = None):
    """View recent logs for a service."""
    if not service:
        print(f"\n  Available services:")
        for i, svc in enumerate(SERVICES, 1):
            print(f"    {C.CYAN}{i}{C.RESET}. {svc}")
        print(f"    {C.CYAN}3{C.RESET}. fxserver (FiveM)")
        choice = input(f"\n  Select [1-3]: ").strip()
        if choice == "1":
            service = SERVICES[0]
        elif choice == "2":
            service = SERVICES[1]
        elif choice == "3":
            service = "fxserver"
        else:
            error("Invalid choice")
            return

    step(f"Last 50 lines of {service}")
    divider()

    if service == "fxserver":
        # FiveM console log
        ssh.run(f"tail -50 {FIVEM_BASE}/server-data/console.log 2>/dev/null || echo 'Log not found'", stream=True)
    else:
        ssh.run(f"journalctl -u {service} -n 50 --no-pager", sudo=True, stream=True)


def action_sync_info(ssh: SSHConnection):
    """Check loading screen sync paths via API."""
    step("Checking Loading Screen Sync Info")
    divider()

    # Try direct API call on localhost from the server
    result = ssh.run(
        f"curl -s http://localhost:{API_PORT}/api/loading-screen/sync-info "
        f"-H 'Authorization: Bearer dummy' 2>/dev/null || echo 'API not responding'"
    )

    if result.ok and result.stdout:
        try:
            data = json.loads(result.stdout)
            if data.get("success") and data.get("data"):
                d = data["data"]
                print(f"    Configured: {C.CYAN}{d.get('configured', '?')}{C.RESET}")
                print(f"    serverDataPath: {C.CYAN}{d.get('serverDataPath', 'N/A')}{C.RESET}")
                print(f"    txDataPath: {C.CYAN}{d.get('txDataPath', 'N/A')}{C.RESET}")
                print(f"    htmlDir: {C.CYAN}{d.get('htmlDir', 'N/A')}{C.RESET}")
                print(f"    Found: {C.GREEN if d.get('found') else C.RED}{d.get('found', '?')}{C.RESET}")

                if d.get("checkedPaths"):
                    print(f"\n    {C.BOLD}Checked paths:{C.RESET}")
                    for p in d["checkedPaths"]:
                        exists = p.get("exists", False)
                        icon = f"{C.GREEN}✓" if exists else f"{C.RED}✗"
                        print(f"      {icon}{C.RESET} {p.get('path', '?')}")
            else:
                warn("API returned error (probably needs auth token)")
                info("Checking paths manually instead...")
                _check_paths_manually(ssh)
        except json.JSONDecodeError:
            warn("Could not parse API response — checking manually")
            _check_paths_manually(ssh)
    else:
        warn("API not responding — checking paths manually")
        _check_paths_manually(ssh)


def _check_paths_manually(ssh: SSHConnection):
    """Manually check if loading screen paths exist on server."""
    paths_to_check = [
        f"{FIVEM_BASE}/resources/[aw]/aw-loading/html",
        f"{FIVEM_BASE}/resources/aw-loading/html",
        f"{FIVEM_BASE}/resources/[aw]/aw-loading/ui/html",
    ]

    step("Checking loading screen paths on server")
    for p in paths_to_check:
        result = ssh.run(f"test -d '{p}' && echo EXISTS || echo MISSING")
        exists = "EXISTS" in result.stdout
        icon = f"{C.GREEN}✓" if exists else f"{C.RED}✗"
        print(f"    {icon}{C.RESET} {p}")

        if exists:
            result = ssh.run(f"ls -la '{p}/'")
            if result.ok:
                print(f"    {C.DIM}Contents:{C.RESET}")
                for line in result.stdout.strip().split('\n'):
                    print(f"      {C.DIM}{line}{C.RESET}")

    # Also check what the profile has stored
    step("Checking stored profile data")
    result = ssh.run(f"cat ~/.saifcontrol/profiles.json 2>/dev/null")
    if result.ok and result.stdout:
        try:
            profiles = json.loads(result.stdout)
            active_id = profiles.get("activeProfileId")
            for p in profiles.get("profiles", []):
                is_active = " (ACTIVE)" if p.get("id") == active_id else ""
                print(f"\n    {C.BOLD}Profile: {p.get('name', '?')}{is_active}{C.RESET}")
                print(f"    serverDataPath: {C.CYAN}{p.get('serverDataPath', 'N/A')}{C.RESET}")
                print(f"    txDataPath: {C.CYAN}{p.get('txDataPath', 'N/A')}{C.RESET}")
        except json.JSONDecodeError:
            warn("Could not parse profiles.json")
    else:
        warn("profiles.json not found")


def action_fix_profile_paths(ssh: SSHConnection):
    """Fix the serverDataPath/txDataPath in the active profile."""
    step("Reading current profile")

    result = ssh.run("cat ~/.saifcontrol/profiles.json 2>/dev/null")
    if not result.ok or not result.stdout:
        error("Cannot read profiles.json")
        return

    try:
        profiles = json.loads(result.stdout)
    except json.JSONDecodeError:
        error("Invalid profiles.json")
        return

    active_id = profiles.get("activeProfileId")
    active = None
    for p in profiles.get("profiles", []):
        if p.get("id") == active_id:
            active = p
            break

    if not active:
        error("No active profile found")
        return

    print(f"    Current serverDataPath: {C.CYAN}{active.get('serverDataPath', 'N/A')}{C.RESET}")
    print(f"    Current txDataPath: {C.CYAN}{active.get('txDataPath', 'N/A')}{C.RESET}")

    expected_data_path = FIVEM_BASE
    needs_fix = False

    if active.get("serverDataPath") != expected_data_path:
        warn(f"serverDataPath should be: {expected_data_path}")
        needs_fix = True

    if not needs_fix:
        success("Profile paths look correct!")
        # Check if the html dir actually exists
        result = ssh.run(f"test -d '{expected_data_path}/resources/[aw]/aw-loading/html' && echo YES || echo NO")
        if "YES" in result.stdout:
            success("Loading screen html/ directory exists")
        else:
            error("Loading screen html/ directory NOT found")
            info(f"Expected at: {expected_data_path}/resources/[aw]/aw-loading/html")
        return

    if not confirm("Fix the profile paths?"):
        return

    active["serverDataPath"] = expected_data_path
    if not active.get("txDataPath"):
        active["txDataPath"] = expected_data_path

    # Write back
    json_str = json.dumps(profiles, indent=2)
    # Escape for shell
    escaped = json_str.replace("'", "'\\''")
    result = ssh.run(f"echo '{escaped}' > ~/.saifcontrol/profiles.json")

    if result.ok:
        success("Profile paths updated!")
        info("Restart panel services to apply:")
        action_restart_services(ssh)
    else:
        error(f"Failed to write: {result.stderr}")


def action_push_and_deploy(ssh: SSHConnection):
    """Git push from Windows then deploy on server."""
    step("Git Push from Windows")
    divider()

    # Check if there are changes to commit
    result = subprocess.run(
        ["git", "status", "--porcelain"],
        cwd=str(LOCAL_REPO), capture_output=True, text=True,
    )

    if not result.stdout.strip():
        info("No local changes to commit")
    else:
        print(f"    Changed files:")
        for line in result.stdout.strip().split('\n'):
            print(f"    {C.YELLOW}{line}{C.RESET}")

        msg = input(f"\n  Commit message [{C.DIM}auto update{C.RESET}]: ").strip()
        if not msg:
            msg = "auto update"

        step("Committing and pushing")
        cmds = [
            (["git", "add", "-A"], "git add"),
            (["git", "commit", "-m", msg], "git commit"),
            (["git", "push", "origin", "master"], "git push"),
        ]
        for cmd, desc in cmds:
            info(desc)
            r = subprocess.run(cmd, cwd=str(LOCAL_REPO), capture_output=True, text=True)
            if r.returncode != 0 and "nothing to commit" not in r.stdout:
                error(f"{desc} failed: {r.stderr}")
                return
            if r.stdout.strip():
                print(f"    {C.DIM}{r.stdout.strip()}{C.RESET}")

        success("Pushed to GitHub")

    # Now deploy on server
    print()
    action_update_all(ssh)


def action_subtree_push():
    """Push resources/ subtree to airwar repo."""
    step("Subtree split resources/ → airwar")
    divider()

    cmds = [
        (["git", "subtree", "split", "--prefix=resources", "-b", "airwar-deploy"], "subtree split"),
        (["git", "push", "airwar", "airwar-deploy:master", "--force"], "push to airwar"),
    ]

    for cmd, desc in cmds:
        info(desc)
        r = subprocess.run(cmd, cwd=str(LOCAL_REPO), capture_output=True, text=True)
        if r.returncode != 0:
            error(f"{desc} failed: {r.stderr}")
            return False
        if r.stdout.strip():
            print(f"    {C.DIM}{r.stdout.strip()}{C.RESET}")

    success("Resources pushed to airwar repo")
    return True


def action_build_loading_screen(ssh: SSHConnection):
    """Build aw-loading UI and sync to server."""
    step("Building Loading Screen UI")
    divider()

    ok = ssh.run_steps([
        ("Installing deps", f"cd {SAIFCONTROL_DIR}/resources/aw-loading/ui && npm install"),
        ("Building", f"cd {SAIFCONTROL_DIR}/resources/aw-loading/ui && npm run build"),
    ])

    if ok:
        # Check if build output went to html/
        result = ssh.run(f"ls {SAIFCONTROL_DIR}/resources/aw-loading/html/")
        if result.ok:
            success("Build output:")
            print(f"    {C.DIM}{result.stdout}{C.RESET}")

        # Also copy to FiveM resources if they exist
        result = ssh.run(f"test -d '{FIVEM_RESOURCES}/aw-loading/html' && echo YES || echo NO")
        if "YES" in result.stdout:
            step("Syncing to FiveM resources")
            ssh.run(f"cp -r {SAIFCONTROL_DIR}/resources/aw-loading/html/* '{FIVEM_RESOURCES}/aw-loading/html/'", stream=True)
            success("Synced to FiveM resources")


# ─── Interactive Menu ─────────────────────────────────────────

MENU_ITEMS = [
    ("1", "📊 Server Status",          "Check services, ports, and system resources"),
    ("2", "🚀 Update Panel",            "Pull + build + restart API & Web"),
    ("3", "🎮 Update FiveM Resources",  "Pull latest airwar resources"),
    ("4", "⚡ Update Everything",        "Panel + FiveM resources"),
    ("5", "🔄 Restart Services",        "Restart API & Web services"),
    ("6", "📋 View Logs",               "View service logs"),
    ("7", "🖥️  Interactive Shell",       "SSH shell to server"),
    ("8", "🔍 Sync Info",               "Check loading screen sync paths"),
    ("9", "🔧 Fix Profile Paths",       "Fix serverDataPath/txDataPath"),
    ("10", "📤 Push & Deploy",          "Git push from Windows + deploy"),
    ("11", "🌿 Subtree Push (airwar)",  "Push resources/ to airwar repo"),
    ("12", "🏗️  Build Loading Screen",   "Build aw-loading UI"),
    ("q", "❌ Quit",                    "Exit the tool"),
]


def interactive_menu(ssh: SSHConnection):
    """Show interactive menu and handle selection."""
    while True:
        print(f"\n  {C.BOLD}What do you want to do?{C.RESET}\n")

        for key, label, desc in MENU_ITEMS:
            if key == "q":
                print(f"    {C.RED}{key:>2}{C.RESET}  {label}")
            else:
                print(f"    {C.CYAN}{key:>2}{C.RESET}  {label}  {C.DIM}— {desc}{C.RESET}")

        print()
        choice = input(f"  {C.BOLD}Select [{C.CYAN}1-12{C.RESET}{C.BOLD}, {C.RED}q{C.RESET}{C.BOLD}]: {C.RESET}").strip().lower()
        print()

        actions = {
            "1": lambda: action_status(ssh),
            "2": lambda: action_update_panel(ssh),
            "3": lambda: action_update_fivem(ssh),
            "4": lambda: action_update_all(ssh),
            "5": lambda: action_restart_services(ssh),
            "6": lambda: action_logs(ssh),
            "7": lambda: ssh.interactive_shell(),
            "8": lambda: action_sync_info(ssh),
            "9": lambda: action_fix_profile_paths(ssh),
            "10": lambda: action_push_and_deploy(ssh),
            "11": lambda: action_subtree_push(),
            "12": lambda: action_build_loading_screen(ssh),
        }

        if choice in ("q", "quit", "exit"):
            print(f"  {C.DIM}Goodbye! 👋{C.RESET}\n")
            break
        elif choice in actions:
            try:
                actions[choice]()
            except KeyboardInterrupt:
                print(f"\n  {C.YELLOW}Cancelled.{C.RESET}")
            except Exception as e:
                error(f"Error: {e}")
            divider()
        else:
            error("Invalid choice")


# ─── Main ─────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="SaifControl Deployment Tool",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Commands:
  (none)        Interactive menu
  panel         Update panel (pull + build + restart)
  fivem         Update FiveM resources
  all           Update everything
  status        Check server status
  logs [svc]    View service logs
  shell         Interactive SSH shell
  sync-info     Check loading screen sync paths
  fix-paths     Fix profile paths
  push          Git push + deploy
  subtree       Push resources/ to airwar repo
  build-ui      Build loading screen UI
        """,
    )
    parser.add_argument("command", nargs="?", default=None,
                        choices=["panel", "fivem", "all", "status", "logs", "shell",
                                 "sync-info", "fix-paths", "push", "subtree", "build-ui"])
    parser.add_argument("extra", nargs="?", default=None, help="Extra argument (service name for logs)")
    parser.add_argument("--host", default=SERVER_HOST, help=f"Server host (default: {SERVER_HOST})")
    parser.add_argument("--user", default=SERVER_USER, help=f"SSH user (default: {SERVER_USER})")
    parser.add_argument("--port", type=int, default=SERVER_PORT, help=f"SSH port (default: {SERVER_PORT})")

    args = parser.parse_args()

    # Enable ANSI on Windows
    if sys.platform == "win32":
        os.system("")

    banner()

    # Subtree doesn't need SSH
    if args.command == "subtree":
        action_subtree_push()
        return

    ssh = SSHConnection(host=args.host, user=args.user, port=args.port)

    step("Connecting to server")
    if not ssh.connect():
        error("Could not connect to server. Check network / credentials.")
        sys.exit(1)

    try:
        cmd_map = {
            "panel":     lambda: action_update_panel(ssh),
            "fivem":     lambda: action_update_fivem(ssh),
            "all":       lambda: action_update_all(ssh),
            "status":    lambda: action_status(ssh),
            "logs":      lambda: action_logs(ssh, args.extra),
            "shell":     lambda: ssh.interactive_shell(),
            "sync-info": lambda: action_sync_info(ssh),
            "fix-paths": lambda: action_fix_profile_paths(ssh),
            "push":      lambda: action_push_and_deploy(ssh),
            "build-ui":  lambda: action_build_loading_screen(ssh),
        }

        if args.command and args.command in cmd_map:
            cmd_map[args.command]()
        else:
            interactive_menu(ssh)
    except KeyboardInterrupt:
        print(f"\n\n  {C.DIM}Interrupted. Goodbye! 👋{C.RESET}\n")
    finally:
        ssh.close()


if __name__ == "__main__":
    main()
