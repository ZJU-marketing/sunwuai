const fs = require('fs');
const path = require('path');
const { run, log, warn, error, info } = require('../utils/exec');
const { checkGhAuth } = require('../utils/check');
const { getConfig } = require('../utils/config');

async function syncMemory() {
  if (!checkGhAuth()) {
    error('Not logged in. Run: gh auth login -s repo,project,workflow,read:org');
    process.exit(1);
  }

  const config = getConfig();
  const memoryPath = config.paths.memory;

  if (!fs.existsSync(config.home)) {
    fs.mkdirSync(config.home, { recursive: true });
  }

  if (fs.existsSync(memoryPath)) {
    info(`Updating memory at ${memoryPath}...`);
    run(`cd ${memoryPath} && git pull`);
  } else {
    info(`Cloning memory to ${memoryPath}...`);
    run(`gh repo clone ${config.repos.memory} ${memoryPath} -- --depth=1`);
  }

  log('Memory synced');

  const linkTarget = config.paths.memoryLink;
  const linkDir = path.dirname(linkTarget);

  if (!fs.existsSync(linkDir)) {
    fs.mkdirSync(linkDir, { recursive: true });
  }

  let linkExists = false;
  try {
    fs.lstatSync(linkTarget);
    linkExists = true;
  } catch (e) {
    // path does not exist at all
  }

  if (linkExists) {
    const stats = fs.lstatSync(linkTarget);
    if (stats.isSymbolicLink()) {
      if (!fs.existsSync(linkTarget)) {
        info('Fixing broken memory link...');
        fs.unlinkSync(linkTarget);
        fs.symlinkSync(memoryPath, linkTarget, 'dir');
      }
    } else {
      warn('Memory path exists but is not a symlink, skipping link');
    }
  } else {
    info('Linking memory to workspace...');
    fs.symlinkSync(memoryPath, linkTarget, 'dir');
    log('Memory linked');
  }

  info('Reindexing memory...');
  run('openclaw memory index --force');
  log('Memory indexed');
}

async function syncSkills(options = {}) {
  if (!checkGhAuth()) {
    error('Not logged in. Run: gh auth login -s repo,project,workflow,read:org');
    process.exit(1);
  }

  const config = getConfig();
  const skillsPath = config.paths.skills;
  const force = options.force || false;

  if (!fs.existsSync(config.home)) {
    fs.mkdirSync(config.home, { recursive: true });
  }

  if (fs.existsSync(skillsPath)) {
    info(`Updating skills at ${skillsPath}...`);
    run(`cd ${skillsPath} && git pull`);
  } else {
    info(`Cloning skills to ${skillsPath}...`);
    run(`gh repo clone ${config.repos.skills} ${skillsPath} -- --depth=1`);
  }

  log('Skills synced');

  const skillsDir = config.paths.skillsDir;
  if (!fs.existsSync(skillsDir)) {
    fs.mkdirSync(skillsDir, { recursive: true });
  }

  const entries = fs.readdirSync(skillsPath, { withFileTypes: true });
  const validSkills = new Set(
    entries
      .filter(e => e.isDirectory() && !e.name.startsWith('.'))
      .filter(e => fs.existsSync(path.join(skillsPath, e.name, 'SKILL.md')))
      .map(e => e.name)
  );

  for (const name of validSkills) {
    const sourcePath = path.join(skillsPath, name);
    const linkPath = path.join(skillsDir, name);

    if (fs.existsSync(linkPath)) {
      const stats = fs.lstatSync(linkPath);
      if (stats.isSymbolicLink()) continue;
      
      if (force) {
        warn(`Removing conflicting directory: ${name}`);
        run(`rm -rf ${linkPath}`);
      } else {
        warn(`Skill ${name} exists but is not a symlink, skipping (use --force to override)`);
        continue;
      }
    }

    info(`Linking skill: ${name}`);
    fs.symlinkSync(sourcePath, linkPath, 'dir');
  }

  const existingLinks = fs.readdirSync(skillsDir, { withFileTypes: true });
  for (const entry of existingLinks) {
    const linkPath = path.join(skillsDir, entry.name);
    const stats = fs.lstatSync(linkPath);

    if (stats.isSymbolicLink()) {
      const target = fs.readlinkSync(linkPath);
      if (target.startsWith(skillsPath) && !fs.existsSync(linkPath)) {
        info(`Removing stale link: ${entry.name}`);
        fs.unlinkSync(linkPath);
      }
    }
  }

  log(`${validSkills.size} skills linked to workspace`);
}

async function syncAll(options = {}) {
  info('Syncing memory and skills...');
  await syncMemory();
  await syncSkills(options);
  log('All resources synced');
}

module.exports = syncAll;
module.exports.syncMemory = syncMemory;
module.exports.syncSkills = syncSkills;
