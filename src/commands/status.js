const fs = require('fs');
const path = require('path');
const { log, info, warn } = require('../utils/exec');
const { getConfig } = require('../utils/config');

function skillStatus() {
  const config = getConfig();
  const skillsPath = config.paths.skills;
  const skillsDir = config.paths.skillsDir;

  info('Skills Status');
  console.log('');

  // Source skills
  if (!fs.existsSync(skillsPath)) {
    warn(`Source directory not found: ${skillsPath}`);
    console.log('  Run: sunwuai skill sync');
    return;
  }

  const sourceSkills = fs.readdirSync(skillsPath, { withFileTypes: true })
    .filter(e => e.isDirectory() && !e.name.startsWith('.'))
    .filter(e => fs.existsSync(path.join(skillsPath, e.name, 'SKILL.md')))
    .map(e => e.name);

  console.log(`  Source: ${skillsPath}`);
  console.log(`  Skills: ${sourceSkills.length}`);
  sourceSkills.forEach(name => console.log(`    - ${name}`));
  console.log('');

  // Workspace links
  if (!fs.existsSync(skillsDir)) {
    warn(`Workspace directory not found: ${skillsDir}`);
    return;
  }

  const entries = fs.readdirSync(skillsDir, { withFileTypes: true });
  const links = [];
  const nonLinks = [];
  const broken = [];

  for (const entry of entries) {
    const linkPath = path.join(skillsDir, entry.name);
    try {
      const stats = fs.lstatSync(linkPath);
      if (stats.isSymbolicLink()) {
        if (fs.existsSync(linkPath)) {
          links.push(entry.name);
        } else {
          broken.push(entry.name);
        }
      } else {
        nonLinks.push(entry.name);
      }
    } catch (e) {
      // ignore
    }
  }

  console.log(`  Workspace: ${skillsDir}`);
  console.log(`  Linked: ${links.length}`);
  links.forEach(name => console.log(`    ✓ ${name}`));

  const needsLink = nonLinks.filter(name => sourceSkills.includes(name));
  const otherSkills = nonLinks.filter(name => !sourceSkills.includes(name));

  if (needsLink.length > 0) {
    console.log(`  Needs re-link: ${needsLink.length}`);
    needsLink.forEach(name => console.log(`    ⚠ ${name} (use --force to replace)`));
  }

  if (otherSkills.length > 0) {
    console.log(`  Other (non-team): ${otherSkills.length}`);
    otherSkills.forEach(name => console.log(`    · ${name}`));
  }

  if (broken.length > 0) {
    console.log(`  Broken links: ${broken.length}`);
    broken.forEach(name => console.log(`    ✗ ${name}`));
  }
}

function memoryStatus() {
  const config = getConfig();
  const memoryPath = config.paths.memory;
  const memoryLink = config.paths.memoryLink;

  info('Memory Status');
  console.log('');

  // Source
  if (!fs.existsSync(memoryPath)) {
    warn(`Source directory not found: ${memoryPath}`);
    console.log('  Run: sunwuai memory sync');
    return;
  }

  console.log(`  Source: ${memoryPath}`);

  // List categories
  const dirs = fs.readdirSync(memoryPath, { withFileTypes: true })
    .filter(e => e.isDirectory() && !e.name.startsWith('.'));
  const files = fs.readdirSync(memoryPath, { withFileTypes: true })
    .filter(e => e.isFile() && e.name.endsWith('.md'));

  // Count total .md files recursively
  let totalFiles = files.length;
  for (const dir of dirs) {
    const dirPath = path.join(memoryPath, dir.name);
    try {
      const subFiles = fs.readdirSync(dirPath).filter(f => f.endsWith('.md'));
      totalFiles += subFiles.length;
    } catch (e) { /* ignore */ }
  }

  console.log(`  Total files: ${totalFiles} .md`);
  console.log(`  Categories: ${dirs.length}`);
  for (const dir of dirs) {
    const dirPath = path.join(memoryPath, dir.name);
    try {
      const count = fs.readdirSync(dirPath).filter(f => f.endsWith('.md')).length;
      console.log(`    📁 ${dir.name}/ (${count} files)`);
    } catch (e) {
      console.log(`    📁 ${dir.name}/`);
    }
  }
  if (files.length > 0) {
    console.log(`  Root files:`);
    files.forEach(f => console.log(`    📄 ${f.name}`));
  }
  console.log('');

  // Workspace link
  try {
    const stats = fs.lstatSync(memoryLink);
    if (stats.isSymbolicLink()) {
      if (fs.existsSync(memoryLink)) {
        console.log(`  Workspace: ${memoryLink}`);
        console.log(`  Status: ✓ Linked`);
      } else {
        console.log(`  Workspace: ${memoryLink}`);
        console.log(`  Status: ✗ Broken link`);
      }
    } else {
      console.log(`  Workspace: ${memoryLink}`);
      console.log(`  Status: ⚠ Not a symlink`);
    }
  } catch (e) {
    console.log(`  Workspace: ${memoryLink}`);
    console.log(`  Status: ✗ Not linked`);
  }
}

function allStatus() {
  memoryStatus();
  console.log('');
  skillStatus();
}

module.exports = { skillStatus, memoryStatus, allStatus };
