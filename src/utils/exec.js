const { execSync } = require('child_process');
const chalk = require('chalk');

// gh CLI may not be in default PATH (e.g. /snap/bin/gh)
const GH_PATHS = ['gh', '/snap/bin/gh', '/usr/local/bin/gh'];

function findGh() {
  for (const p of GH_PATHS) {
    try {
      execSync(`${p} --version`, { stdio: 'pipe' });
      return p;
    } catch {}
  }
  return null;
}

let _ghPath;
function ghPath() {
  if (!_ghPath) _ghPath = findGh();
  return _ghPath;
}

function resolveCmd(cmd) {
  const gh = ghPath();
  if (gh && gh !== 'gh') {
    return cmd.replace(/\bgh\b/, gh);
  }
  return cmd;
}

function run(cmd, opts = {}) {
  cmd = resolveCmd(cmd);
  try {
    return execSync(cmd, {
      encoding: 'utf-8',
      stdio: opts.silent ? 'pipe' : 'inherit',
      ...opts,
    });
  } catch (err) {
    if (opts.silent) return null;
    throw err;
  }
}

function runCapture(cmd) {
  return run(cmd, { silent: true });
}

function log(msg) {
  console.log(chalk.green('✔'), msg);
}

function warn(msg) {
  console.log(chalk.yellow('⚠'), msg);
}

function error(msg) {
  console.log(chalk.red('✖'), msg);
}

function info(msg) {
  console.log(chalk.blue('ℹ'), msg);
}

module.exports = { run, runCapture, log, warn, error, info };
