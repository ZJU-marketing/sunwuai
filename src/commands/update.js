const { run, log, info } = require('../utils/exec');

function updateCommand() {
  info('Updating sunwuai CLI...');
  run('npm install -g github:ZJU-marketing/cli');
  log(`Updated to sunwuai ${require('../../package.json').version}`);
}

module.exports = updateCommand;
