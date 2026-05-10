const fs = require('fs');
const path = require('path');
const { run, runCapture, log, warn, error, info } = require('../utils/exec');
const { checkGhAuth } = require('../utils/check');
const { getConfig } = require('../utils/config');

function shellQuote(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

function ensureGhAuth() {
  if (!checkGhAuth()) {
    error('Not logged in. Run: gh auth login -s repo,project,workflow,read:org');
    process.exit(1);
  }
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function assertSkillName(name) {
  if (!name || name.includes('/') || name.includes('..')) {
    error(`Invalid skill name: ${name}`);
    process.exit(1);
  }
}

function assertSkillDir(skillPath, name) {
  if (!fs.existsSync(skillPath)) {
    error(`Skill ${name} not found at ${skillPath}`);
    process.exit(1);
  }
  if (!fs.existsSync(path.join(skillPath, 'SKILL.md'))) {
    error(`${skillPath}/SKILL.md not found`);
    process.exit(1);
  }
}

function rsyncDir(source, dest, deleteExtra = true) {
  ensureDir(path.dirname(dest));
  ensureDir(dest);
  const deleteFlag = deleteExtra ? '--delete ' : '';
  run(`rsync -a ${deleteFlag}${shellQuote(source + path.sep)} ${shellQuote(dest + path.sep)}`);
}

function cloneOrPullSkillsRepo() {
  ensureGhAuth();
  const config = getConfig();
  const skillsPath = config.paths.skills;

  ensureDir(config.home);
  if (fs.existsSync(skillsPath)) {
    info(`Updating skills repo at ${skillsPath}...`);
    run(`cd ${shellQuote(skillsPath)} && git pull --ff-only`);
  } else {
    info(`Cloning skills repo to ${skillsPath}...`);
    run(`gh repo clone ${config.repos.skills} ${shellQuote(skillsPath)} -- --depth=1`);
  }
  return { config, skillsPath };
}

function listLocalSkillNames(skillsPath) {
  if (!fs.existsSync(skillsPath)) return [];
  return fs.readdirSync(skillsPath, { withFileTypes: true })
    .filter(e => e.isDirectory() && !e.name.startsWith('.'))
    .filter(e => fs.existsSync(path.join(skillsPath, e.name, 'SKILL.md')))
    .map(e => e.name)
    .sort();
}

function publishSkillToWorkspace(config, skillsPath, name) {
  const sourcePath = path.join(skillsPath, name);
  const destPath = path.join(config.paths.skillsDir, name);
  assertSkillDir(sourcePath, name);
  rsyncDir(sourcePath, destPath, true);
  try {
    fs.writeFileSync(path.join(destPath, '.sunwuai-managed.json'), JSON.stringify({
      source: config.repos.skills,
      skill: name,
      installedAt: new Date().toISOString(),
    }, null, 2) + '\n');
  } catch {}
  log(`Installed ${name} to ${destPath}`);
}

async function createSkill(name) {
  assertSkillName(name);
  ensureGhAuth();

  const config = getConfig();
  const skillsPath = config.paths.skills;
  const skillPath = path.join(skillsPath, name);

  if (fs.existsSync(skillPath)) {
    error(`Skill ${name} already exists at ${skillPath}`);
    process.exit(1);
  }

  info(`Creating skill: ${name}`);
  ensureDir(skillPath);
  ensureDir(path.join(skillPath, 'references'));

  const skillMd = `---\nname: ${name}\ndescription: Describe when this skill should be activated.\n---\n\n# ${name}\n\n## When to use\nDescribe when this skill should be activated.\n\n## What it does\nBrief description of the skill's purpose.\n\n## Instructions\nStep-by-step instructions for the agent.\n\n## References\n- See references/ for additional files\n`;

  fs.writeFileSync(path.join(skillPath, 'SKILL.md'), skillMd);
  log(`Created ${skillPath}/SKILL.md`);

  const workspacePath = path.join(config.paths.skillsDir, name);
  if (!fs.existsSync(workspacePath)) {
    rsyncDir(skillPath, workspacePath, true);
  }
  log(`Skill ${name} created successfully`);
  info('Next steps:');
  info(`  1. Edit ${workspacePath}/SKILL.md`);
  info(`  2. Run: sunwuai skill publish ${name}`);
}

async function installSkill(name) {
  assertSkillName(name);
  const { config, skillsPath } = cloneOrPullSkillsRepo();
  publishSkillToWorkspace(config, skillsPath, name);
}

async function upgradeSkill(name, options = {}) {
  if (options.all) return upgradeAllSkills();
  if (!name) {
    error('Missing skill name. Use: sunwuai skill upgrade <name> or sunwuai skill upgrade --all');
    process.exit(1);
  }
  await installSkill(name);
}

async function upgradeAllSkills() {
  const { config, skillsPath } = cloneOrPullSkillsRepo();
  const names = listLocalSkillNames(skillsPath);
  for (const name of names) publishSkillToWorkspace(config, skillsPath, name);
  log(`${names.length} skills upgraded`);
}

async function listSkills() {
  const { skillsPath } = cloneOrPullSkillsRepo();
  const names = listLocalSkillNames(skillsPath);
  if (!names.length) {
    warn('No skills found in shared skills repo');
    return;
  }
  for (const name of names) console.log(name);
}

async function publishSkill(name, options = {}) {
  assertSkillName(name);
  ensureGhAuth();
  const config = getConfig();
  const workspacePath = path.join(config.paths.skillsDir, name);
  assertSkillDir(workspacePath, name);

  const { skillsPath } = cloneOrPullSkillsRepo();
  const repoSkillPath = path.join(skillsPath, name);

  info(`Publishing skill ${name} from ${workspacePath} to ${repoSkillPath}...`);
  rsyncDir(workspacePath, repoSkillPath, true);
  const marker = path.join(repoSkillPath, '.sunwuai-managed.json');
  if (fs.existsSync(marker)) fs.unlinkSync(marker);

  const status = runCapture(`cd ${shellQuote(skillsPath)} && git status --short -- ${shellQuote(name)}`) || '';
  if (!status.trim()) {
    log(`No changes to publish for ${name}`);
    return;
  }

  run(`cd ${shellQuote(skillsPath)} && git add ${shellQuote(name)}`);
  const message = options.message || `chore(skill): publish ${name}`;
  run(`cd ${shellQuote(skillsPath)} && git commit -m ${shellQuote(message)}`);
  run(`cd ${shellQuote(skillsPath)} && git push`);
  log(`Skill ${name} published to ${config.repos.skills}`);
}

async function pushSkill(name) {
  return publishSkill(name, { message: `feat: add ${name} skill` });
}

module.exports = { createSkill, pushSkill, publishSkill, installSkill, upgradeSkill, upgradeAllSkills, listSkills };
