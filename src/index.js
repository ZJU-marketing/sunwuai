const { program } = require('commander');
const syncCommand = require('./commands/sync');
const updateCommand = require('./commands/update');
const { allStatus, memoryStatus, skillStatus } = require('./commands/status');
const onboardCommand = require('./commands/onboard');

program
  .name('sunwuai')
  .description('SunwuAI CLI - Team knowledge and skill distribution tool')
  .version(require('../package.json').version);

program
  .command('sync')
  .description('Sync team memory and skills')
  .option('-f, --force', 'Force overwrite conflicting non-symlink directories')
  .action((options) => syncCommand(options));

program
  .command('status')
  .description('Show sync status of memory and skills')
  .action(() => allStatus());

program
  .command('update')
  .description('Update sunwuai CLI to latest version')
  .action(updateCommand);

program
  .command('onboard')
  .description('Run agent onboarding checks and setup')
  .action(() => onboardCommand());

// Allow `sunwuai memory sync` and `sunwuai skill sync` for granular control
const { Command } = require('commander');
const { syncMemory, syncSkills } = require('./commands/sync');

const memory = new Command('memory');
memory.command('sync').description('Sync team memory only').action(syncMemory);
memory.command('status').description('Show memory sync status').action(memoryStatus);
program.addCommand(memory);

const { createSkill, pushSkill, publishSkill, installSkill, upgradeSkill, listSkills } = require('./commands/skill');

const skill = new Command('skill');
skill
  .command('sync')
  .description('Sync team skills only')
  .option('-f, --force', 'Force overwrite conflicting non-symlink directories')
  .action((options) => syncSkills(options));
skill
  .command('create <name>')
  .description('Create a new skill in the shared repository')
  .action((name) => createSkill(name));
skill
  .command('push <name>')
  .description('Push a skill to the remote repository (alias of publish)')
  .action((name) => pushSkill(name));
skill
  .command('publish <name>')
  .description('Publish a workspace skill to the shared skills repository')
  .option('-m, --message <message>', 'Git commit message')
  .action((name, options) => publishSkill(name, options));
skill
  .command('install <name>')
  .description('Install one skill from the shared skills repository')
  .action((name) => installSkill(name));
skill
  .command('upgrade [name]')
  .description('Upgrade one skill, or all skills with --all')
  .option('-a, --all', 'Upgrade all skills')
  .action((name, options) => upgradeSkill(name, options));
skill
  .command('list')
  .description('List skills available in the shared skills repository')
  .action(() => listSkills());
skill
  .command('status')
  .description('Show skills sync status')
  .action(() => skillStatus());
program.addCommand(skill);

program.parse(process.argv);
