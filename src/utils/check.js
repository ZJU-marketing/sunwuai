const { runCapture, error } = require('./exec');
const { getConfig } = require('./config');

function checkGh() {
  const out = runCapture('gh --version');
  if (!out) {
    error('gh CLI not found. Install: https://cli.github.com');
    return false;
  }
  return true;
}

function checkGhAuth() {
  const out = runCapture('gh auth status 2>&1');
  if (!out || out.includes('not logged')) {
    return false;
  }
  return true;
}

function checkScopes() {
  const out = runCapture('gh auth status 2>&1');
  if (!out) return { ok: false, missing: [] };

  const config = getConfig();
  const missing = [];
  for (const scope of config.scopes) {
    if (!out.includes(scope)) {
      missing.push(scope);
    }
  }
  return { ok: missing.length === 0, missing };
}

function checkGit() {
  const out = runCapture('git --version');
  if (!out) {
    error('git not found.');
    return false;
  }
  return true;
}

function checkAll() {
  const results = {
    gh: checkGh(),
    ghAuth: checkGhAuth(),
    git: checkGit(),
  };
  if (results.gh && results.ghAuth) {
    results.scopes = checkScopes();
  }
  return results;
}

module.exports = { checkGh, checkGhAuth, checkScopes, checkGit, checkAll };
