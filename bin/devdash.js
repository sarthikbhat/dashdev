#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawn, execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = path.resolve(__dirname, "..");
const SERVER_ENTRY = path.join(PKG_ROOT, "dist/server/index.js");
const HOME_DIR = path.join(os.homedir(), ".devdash");
const PID_FILE = path.join(HOME_DIR, "devdash.pid");
const LOG_FILE = path.join(HOME_DIR, "devdash.log");
const PORT = parseInt(process.env.DEVDASH_PORT ?? "3847", 10);

const PLIST_LABEL = "com.devdash.server";
const PLIST_DIR = path.join(os.homedir(), "Library/LaunchAgents");
const PLIST_PATH = path.join(PLIST_DIR, `${PLIST_LABEL}.plist`);

const cmd = process.argv[2];

fs.mkdirSync(HOME_DIR, { recursive: true });

switch (cmd) {
  case "start":
    start();
    break;
  case "stop":
    stop();
    break;
  case "restart":
    stop();
    setTimeout(start, 500);
    break;
  case "status":
    status();
    break;
  case "open":
    openBrowser();
    break;
  case "logs":
    logs();
    break;
  case "install":
    installLaunchd();
    break;
  case "uninstall":
    uninstallLaunchd();
    break;
  default:
    help();
}

function isRunning() {
  if (!fs.existsSync(PID_FILE)) return false;
  const pid = parseInt(fs.readFileSync(PID_FILE, "utf-8").trim());
  try {
    process.kill(pid, 0);
    return pid;
  } catch {
    fs.unlinkSync(PID_FILE);
    return false;
  }
}

function start() {
  const existing = isRunning();
  if (existing) {
    console.log(`DevDash is already running (pid ${existing})`);
    console.log(`  http://localhost:${PORT}`);
    return;
  }

  const logFd = fs.openSync(LOG_FILE, "a");
  const child = spawn("node", [SERVER_ENTRY], {
    detached: true,
    stdio: ["ignore", logFd, logFd],
    env: { ...process.env, DEVDASH_PORT: String(PORT) },
    cwd: PKG_ROOT,
  });

  child.unref();
  fs.writeFileSync(PID_FILE, String(child.pid));
  fs.closeSync(logFd);

  console.log(`DevDash started (pid ${child.pid})`);
  console.log(`  http://localhost:${PORT}`);
  console.log(`  Logs: ${LOG_FILE}`);
}

function stop() {
  const pid = isRunning();
  if (!pid) {
    console.log("DevDash is not running");
    return;
  }
  try {
    process.kill(pid, "SIGTERM");
    fs.unlinkSync(PID_FILE);
    console.log(`DevDash stopped (pid ${pid})`);
  } catch {
    console.log("Failed to stop — process may have already exited");
    if (fs.existsSync(PID_FILE)) fs.unlinkSync(PID_FILE);
  }
}

function status() {
  const pid = isRunning();
  if (pid) {
    console.log(`DevDash is running (pid ${pid})`);
    console.log(`  http://localhost:${PORT}`);
  } else {
    console.log("DevDash is not running");
    console.log("  Run: devdash start");
  }
}

function openBrowser() {
  const pid = isRunning();
  if (!pid) {
    console.log("DevDash is not running. Starting...");
    start();
    setTimeout(() => doOpen(), 1500);
  } else {
    doOpen();
  }
}

function doOpen() {
  const url = `http://localhost:${PORT}`;
  const platform = process.platform;
  if (platform === "darwin") execFileSync("open", [url]);
  else if (platform === "linux") execFileSync("xdg-open", [url]);
  else if (platform === "win32") execFileSync("cmd", ["/c", "start", url]);
  else console.log(`Open ${url} in your browser`);
}

function logs() {
  if (!fs.existsSync(LOG_FILE)) {
    console.log("No logs yet. Start DevDash first.");
    return;
  }
  const lines = fs.readFileSync(LOG_FILE, "utf-8").split("\n");
  const tail = lines.slice(-50).join("\n");
  console.log(tail);
}

function installLaunchd() {
  if (process.platform !== "darwin") {
    console.log("Auto-start install is only supported on macOS (launchd)");
    console.log("On Linux, create a systemd user service manually.");
    return;
  }

  const nodePath = process.execPath;
  const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${PLIST_LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${nodePath}</string>
    <string>${SERVER_ENTRY}</string>
  </array>
  <key>EnvironmentVariables</key>
  <dict>
    <key>DEVDASH_PORT</key>
    <string>${PORT}</string>
    <key>PATH</key>
    <string>${process.env.PATH}</string>
  </dict>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>${LOG_FILE}</string>
  <key>StandardErrorPath</key>
  <string>${LOG_FILE}</string>
  <key>WorkingDirectory</key>
  <string>${PKG_ROOT}</string>
</dict>
</plist>`;

  fs.mkdirSync(PLIST_DIR, { recursive: true });
  fs.writeFileSync(PLIST_PATH, plist);

  try {
    execFileSync("launchctl", ["unload", PLIST_PATH], { stdio: "ignore" });
  } catch {}
  execFileSync("launchctl", ["load", PLIST_PATH]);

  console.log("DevDash installed as login service");
  console.log("  Starts automatically on login");
  console.log("  Restarts if it crashes");
  console.log(`  http://localhost:${PORT}`);
  console.log(`\n  To remove: devdash uninstall`);
}

function uninstallLaunchd() {
  if (!fs.existsSync(PLIST_PATH)) {
    console.log("DevDash is not installed as a service");
    return;
  }
  try {
    execFileSync("launchctl", ["unload", PLIST_PATH], { stdio: "ignore" });
  } catch {}
  fs.unlinkSync(PLIST_PATH);
  console.log("DevDash service uninstalled");
  console.log("  It will no longer auto-start on login");
}

function help() {
  console.log(`
  devdash — local development dashboard

  Usage:
    devdash start       Start the server in the background
    devdash stop        Stop the background server
    devdash restart     Restart the server
    devdash status      Check if the server is running
    devdash open        Open the dashboard in your browser
    devdash logs        Show recent server logs

    devdash install     Auto-start on login (macOS launchd)
    devdash uninstall   Remove auto-start

  Environment:
    DEVDASH_PORT        Server port (default: 3847)

  Data:
    ~/.devdash/         Config, database, workflows, logs
`);
}
