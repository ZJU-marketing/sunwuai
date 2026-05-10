const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { run, log, warn, error, info } = require('../utils/exec');
const { checkGhAuth } = require('../utils/check');
const { getConfig } = require('../utils/config');

function parseMembersFile(filePath) {
  if (!fs.existsSync(filePath)) return [];
  const content = fs.readFileSync(filePath, 'utf8');
  const sections = content.split(/^## /m).filter(s => s.trim());
  const members = [];
  for (const section of sections) {
    const lines = section.split('\n');
    const name = lines[0]?.trim();
    if (!name || name.startsWith('#')) continue;
    const get = (key) => {
      const m = section.match(new RegExp(`${key}[：:]\\s*(.+)`, 'i'));
      return m ? m[1].trim() : '';
    };
    members.push({
      name,
      type: get('类型'),
      role: get('角色'),
      github: get('GitHub 用户名'),
      email: get('GitHub 邮箱'),
      feishu: get('Feishu 名称'),
    });
  }
  return members;
}

function askChoice(question, choices) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    choices.forEach((c, i) => console.log(`    ${i + 1}) ${c}`));
    console.log('');
    rl.question(question, (answer) => {
      rl.close();
      const idx = parseInt(answer, 10) - 1;
      resolve(idx >= 0 && idx < choices.length ? idx : -1);
    });
  });
}

function writeIdentity(identityPath, member) {
  const content = `# IDENTITY.md - Who Am I?

- **Name:** ${member.name}
- **Creature:** ${member.role}
- **GitHub:** ${member.github}
- **Email:** ${member.email}
- **Emoji:**
- **Avatar:**
`;
  fs.writeFileSync(identityPath, content);
}

function check(label, ok, detail) {
  if (ok) {
    console.log(`  ✓ ${label}${detail ? ' — ' + detail : ''}`);
  } else {
    console.log(`  ✗ ${label}${detail ? ' — ' + detail : ''}`);
  }
  return ok;
}

function commandExists(cmd) {
  try {
    require('child_process').execSync(`command -v ${cmd} 2>/dev/null`, { stdio: 'pipe' });
    return true;
  } catch { return false; }
}

function tryExec(cmd) {
  try {
    return require('child_process').execSync(cmd, { stdio: 'pipe', timeout: 15000 }).toString().trim();
  } catch { return null; }
}

async function onboard() {
  const config = getConfig();
  const workspace = config.paths.workspace;
  let passed = 0;
  let failed = 0;

  console.log('');
  console.log('  🐵 SunwuAI Agent Onboarding');
  console.log('  ===========================');
  console.log('');

  // 1. Tools
  info('Checking tools...');
  const nodeOk = commandExists('node');
  check('Node.js', nodeOk, nodeOk ? tryExec('node -v') : 'not found');

  const gitOk = commandExists('git');
  check('Git', gitOk, gitOk ? tryExec('git --version')?.replace('git version ', '') : 'not found');

  const ghOk = commandExists('gh') || fs.existsSync('/snap/bin/gh');
  check('GitHub CLI', ghOk, ghOk ? 'found' : 'not found — install: https://cli.github.com');

  const ghAuth = checkGhAuth();
  check('GitHub auth', ghAuth, ghAuth ? 'logged in' : 'run: sunwuai sync (will prompt login)');

  let himOk = commandExists('himalaya');
  check('Himalaya', himOk, himOk ? tryExec('himalaya --version') : 'not found — install: https://github.com/pimalaya/himalaya');

  const oclawOk = commandExists('openclaw');
  check('OpenClaw', oclawOk, oclawOk ? tryExec('openclaw --version 2>/dev/null')?.split('\n')[0] : 'not found');

  [nodeOk, gitOk, ghOk, ghAuth, himOk, oclawOk].forEach(ok => ok ? passed++ : failed++);
  console.log('');

  // 2. Memory & Skills sync
  info('Checking sync status...');
  const memoryOk = fs.existsSync(config.paths.memory);
  check('Memory repo', memoryOk, memoryOk ? config.paths.memory : 'run: sunwuai sync');

  const skillsOk = fs.existsSync(config.paths.skills);
  check('Skills repo', skillsOk, skillsOk ? config.paths.skills : 'run: sunwuai sync');

  let memoryLinked = false;
  try {
    const stats = fs.lstatSync(config.paths.memoryLink);
    memoryLinked = stats.isSymbolicLink() && fs.existsSync(config.paths.memoryLink);
  } catch {}
  check('Memory linked', memoryLinked, memoryLinked ? config.paths.memoryLink : 'run: sunwuai memory sync');

  [memoryOk, skillsOk, memoryLinked].forEach(ok => ok ? passed++ : failed++);
  console.log('');

  // 3. Identity — auto-detect via GitHub username
  info('Checking identity...');
  const identityPath = path.join(workspace, 'IDENTITY.md');
  let agentName = null;
  let identityOk = false;

  const membersPath = path.join(config.paths.memoryLink, 'members', 'members.md');
  const allMembers = parseMembersFile(membersPath);

  // Try to identify via gh login
  const ghUser = tryExec('gh api user --jq .login 2>/dev/null') ||
                 tryExec('/snap/bin/gh api user --jq .login 2>/dev/null');

  let matchedMember = null;
  if (ghUser && allMembers.length > 0) {
    matchedMember = allMembers.find(m => m.github.toLowerCase() === ghUser.toLowerCase());
  }

  if (matchedMember) {
    // Auto-detected identity from GitHub
    agentName = matchedMember.name;
    identityOk = true;

    // Update IDENTITY.md if missing or different
    let needsUpdate = !fs.existsSync(identityPath);
    if (!needsUpdate) {
      const content = fs.readFileSync(identityPath, 'utf8');
      const nameMatch = content.match(/\*?\*?Name\*?\*?[：:]\s*(.+)/i);
      const currentName = nameMatch ? nameMatch[1].replace(/\*/g, '').trim() : null;
      needsUpdate = currentName !== matchedMember.name;
    }
    if (needsUpdate) {
      writeIdentity(identityPath, matchedMember);
      log(`Identity auto-set from GitHub: ${matchedMember.name} (${ghUser})`);
    }
    check('GitHub user', true, ghUser);
    check('Identity', true, `${matchedMember.name} — ${matchedMember.role}`);
    check('Member registered', true, `matched by GitHub username`);
  } else {
    // Fallback: read IDENTITY.md name
    if (fs.existsSync(identityPath)) {
      const content = fs.readFileSync(identityPath, 'utf8');
      const nameMatch = content.match(/\*?\*?Name\*?\*?[：:]\s*(.+)/i);
      agentName = nameMatch ? nameMatch[1].replace(/\*/g, '').trim() : null;
      identityOk = !!agentName;
    }

    check('GitHub user', !!ghUser, ghUser || 'not detected');

    let memberFound = false;
    if (agentName && allMembers.length > 0) {
      const match = allMembers.find(m =>
        m.name === agentName || m.feishu === agentName ||
        m.name.toLowerCase().includes(agentName.toLowerCase())
      );
      if (match) { memberFound = true; agentName = match.name; }
    }

    if (!memberFound && allMembers.length > 0) {
      check('Identity', false, agentName ? `"${agentName}" not matched` : 'no name set');
      console.log('');
      info('Who are you? Select your identity:');
      const choices = allMembers.map(m => `${m.name} — ${m.role} (${m.type})`);
      const idx = await askChoice('  Choose [number]: ', choices);
      if (idx >= 0) {
        const selected = allMembers[idx];
        writeIdentity(identityPath, selected);
        agentName = selected.name;
        memberFound = true;
        identityOk = true;
        log(`Identity set to: ${selected.name} (${selected.role})`);
      } else {
        warn('No valid selection, skipping identity setup');
      }
    }

    check('Identity', identityOk, agentName ? `Agent: ${agentName}` : 'not set');
    check('Member registered', !!agentName && (!!matchedMember || memberFound), agentName || 'unknown');
  }

  const memberRegistered = !!matchedMember || (agentName && allMembers.some(m => m.name === agentName));
  [identityOk, memberRegistered].forEach(ok => ok ? passed++ : failed++);
  console.log('');

  // 4. Email
  info('Checking email...');
  let emailConfigured = false;
  let emailAccount = null;

  // 4a. Install himalaya if missing
  if (!himOk) {
    info('Himalaya not found. Attempting install...');
    const installed = tryExec('curl -sSL https://raw.githubusercontent.com/pimalaya/himalaya/master/install.sh | bash 2>&1');
    if (installed && commandExists('himalaya')) {
      log('Himalaya installed');
      himOk = true;
    } else {
      // Try direct download
      const arch = tryExec('uname -m') || 'x86_64';
      const dlUrl = `https://github.com/pimalaya/himalaya/releases/latest/download/himalaya-linux-${arch === 'aarch64' ? 'arm64' : 'x86_64'}.tar.gz`;
      const dlResult = tryExec(`curl -sSL "${dlUrl}" | tar xz -C /usr/local/bin/ 2>&1`);
      if (dlResult !== null && commandExists('himalaya')) {
        log('Himalaya installed from GitHub release');
        himOk = true;
      } else {
        warn('Auto-install failed. Install manually: https://github.com/pimalaya/himalaya');
      }
    }
  }
  check('Himalaya', himOk, himOk ? (tryExec('himalaya --version') || 'installed') : 'not installed');

  // 4b. Configure email if himalaya is available but not configured
  if (himOk) {
    const accountList = tryExec('himalaya account list 2>/dev/null');
    if (accountList && !accountList.includes('error') && !accountList.includes('cannot')) {
      emailConfigured = true;
      emailAccount = accountList.split('\n')[0];
    }
  }

  if (himOk && !emailConfigured && matchedMember && matchedMember.email) {
    info(`Setting up email for ${matchedMember.email}...`);
    const accountName = matchedMember.email.split('@')[0].replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-');
    const configDir = path.join(require('os').homedir(), '.config', 'himalaya');
    const configFile = path.join(configDir, 'config.toml');
    const passFile = path.join(configDir, `${accountName}_pass`);

    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }

    if (!fs.existsSync(configFile)) {
      const config_toml = `downloads-dir = "~/Downloads"

[accounts.${accountName}]
default = true
email = "${matchedMember.email}"
display-name = "${matchedMember.name}"

[accounts.${accountName}.backend]
type = "imap"
host = "imap.qiye.aliyun.com"
port = 993
login = "${matchedMember.email}"

[accounts.${accountName}.backend.encryption]
type = "tls"

[accounts.${accountName}.backend.auth]
type = "password"
cmd = "cat ${passFile}"

[accounts.${accountName}.message.send.backend]
type = "smtp"
host = "smtp.qiye.aliyun.com"
port = 465
login = "${matchedMember.email}"

[accounts.${accountName}.message.send.backend.encryption]
type = "tls"

[accounts.${accountName}.message.send.backend.auth]
type = "password"
cmd = "cat ${passFile}"

[accounts.${accountName}.folder.aliases]
inbox = "INBOX"
sent = "Sent"
drafts = "Drafts"
trash = "Trash"
`;
      fs.writeFileSync(configFile, config_toml);
      log(`Email config created: ${configFile}`);
    }

    if (!fs.existsSync(passFile)) {
      let password = '';
      if (process.stdin.isTTY) {
        // Interactive: hidden input
        password = await new Promise((resolve) => {
          process.stdout.write('  Enter email password (or app password): ');
          const stdin = process.stdin;
          stdin.setRawMode(true);
          stdin.resume();
          stdin.setEncoding('utf8');
          let input = '';
          const onData = (ch) => {
            if (ch === '\n' || ch === '\r' || ch === '\u0004') {
              stdin.setRawMode(false);
              stdin.pause();
              stdin.removeListener('data', onData);
              process.stdout.write('\n');
              resolve(input.trim());
            } else if (ch === '\u0003') {
              process.exit(1);
            } else if (ch === '\u007F' || ch === '\b') {
              input = input.slice(0, -1);
            } else {
              input += ch;
              process.stdout.write('*');
            }
          };
          stdin.on('data', onData);
        });
      } else {
        // Non-interactive: read from stdin
        password = await new Promise((resolve) => {
          const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
          rl.question('  Enter email password (or app password): ', (answer) => {
            rl.close();
            resolve(answer.trim());
          });
        });
      }
      if (password) {
        fs.writeFileSync(passFile, password);
        fs.chmodSync(passFile, 0o600);
        log(`Password saved to ${passFile}`);
      } else {
        warn('No password entered, skipping email setup');
      }
    }

    // Try to verify after setup
    if (fs.existsSync(passFile)) {
      const verifyResult = tryExec('himalaya account list 2>/dev/null');
      if (verifyResult && !verifyResult.includes('error') && !verifyResult.includes('cannot')) {
        emailConfigured = true;
        emailAccount = verifyResult.split('\n')[0];
        log('Email verified');
      }
    }
  }

  check('Email configured', emailConfigured, emailConfigured ? emailAccount : 'needs password file — see above');

  let emailCanReceive = false;
  if (emailConfigured) {
    const folders = tryExec('himalaya folder list 2>/dev/null');
    emailCanReceive = folders && folders.toLowerCase().includes('inbox');
  }
  check('Email can receive', emailCanReceive, emailCanReceive ? 'INBOX accessible' : 'cannot verify inbox');

  [emailConfigured, emailCanReceive].forEach(ok => ok ? passed++ : failed++);
  console.log('');

  // 5. Skills
  info('Checking required skills...');
  const skillsDir = config.paths.skillsDir;
  const requiredSkills = ['sunwu-agent-workflow', 'sunwu-agent-onboarding', 'aliyun-enterprise-mail'];
  for (const name of requiredSkills) {
    const skillPath = path.join(skillsDir, name, 'SKILL.md');
    const ok = fs.existsSync(skillPath);
    check(`Skill: ${name}`, ok, ok ? 'available' : 'missing — run: sunwuai skill sync');
    ok ? passed++ : failed++;
  }
  console.log('');

  // 6. Issue memory directory
  info('Checking issue memory...');
  const agentWorkDir = path.join(workspace, 'memory', 'agent-work');
  const safeName = agentName ? agentName.toLowerCase().replace(/\s+/g, '-') : null;
  const agentIssueDir = safeName ? path.join(agentWorkDir, safeName) : null;
  let issueDirOk = false;
  if (agentIssueDir) {
    if (!fs.existsSync(agentIssueDir)) {
      fs.mkdirSync(agentIssueDir, { recursive: true });
      check('Issue memory dir', true, `created: ${agentIssueDir}`);
      issueDirOk = true;
    } else {
      check('Issue memory dir', true, agentIssueDir);
      issueDirOk = true;
    }
  } else {
    check('Issue memory dir', false, 'cannot create — agent name unknown');
  }
  issueDirOk ? passed++ : failed++;
  console.log('');

  // 7. Cron job
  info('Checking cron jobs...');
  let cronOk = false;
  if (oclawOk) {
    const cronList = tryExec('openclaw cron list 2>/dev/null');
    if (cronList && !cronList.includes('No cron jobs')) {
      const jobCount = cronList.split('\n').filter(l => l.trim()).length;
      cronOk = true;
      check('Cron jobs', true, `${jobCount} job(s) configured`);
    } else {
      check('Cron jobs', false, 'no cron jobs — Agent needs at least one periodic task');
    }
  } else {
    check('Cron jobs', false, 'OpenClaw not available');
  }
  cronOk ? passed++ : failed++;
  console.log('');

  // 8. Onboarding status
  info('Checking onboarding status...');
  const onboardFile = path.join(workspace, '.onboarded');
  const allCritical = nodeOk && gitOk && ghOk && ghAuth && memoryOk && skillsOk && memoryLinked && identityOk && memberRegistered;

  if (failed === 0) {
    // All checks passed, mark as onboarded
    const timestamp = new Date().toISOString();
    const status = {
      agent: agentName,
      completedAt: timestamp,
      version: require('../../package.json').version,
      checks: { passed, failed }
    };
    fs.writeFileSync(onboardFile, JSON.stringify(status, null, 2));
    check('Onboarding', true, `completed at ${timestamp}`);
  } else if (fs.existsSync(onboardFile)) {
    const prev = JSON.parse(fs.readFileSync(onboardFile, 'utf8'));
    check('Onboarding', false, `previously completed ${prev.completedAt}, but ${failed} checks now failing`);
  } else {
    check('Onboarding', false, `${failed} checks must pass first`);
  }
  console.log('');

  // Summary
  console.log('  ─────────────────────────');
  console.log(`  ✓ Passed: ${passed}  ✗ Failed: ${failed}`);
  console.log('');

  if (failed === 0) {
    log('Onboarding complete! Agent is ready.');
  } else {
    warn(`${failed} checks failed. Fix the issues above and re-run: sunwuai onboard`);
  }
  console.log('');
}

module.exports = onboard;
