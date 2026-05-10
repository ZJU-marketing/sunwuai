const path = require('path');
const os = require('os');

const defaultConfig = require('../../config/default.json');

function resolveHome(p) {
  return p.replace(/^~/, os.homedir());
}

function getConfig() {
  const home = resolveHome(defaultConfig.home);
  const workspace = resolveHome(defaultConfig.paths.workspace);
  return {
    repos: defaultConfig.repos,
    scopes: defaultConfig.scopes,
    home,
    paths: {
      workspace,
      // sunwuai home directories (source of truth)
      memory: path.join(home, 'memory'),
      skills: path.join(home, 'skills'),
      // openclaw workspace link targets
      memoryLink: path.join(workspace, defaultConfig.paths.memoryLink),
      skillsDir: path.join(workspace, defaultConfig.paths.skillsDir),
    },
  };
}

module.exports = { getConfig, resolveHome };
