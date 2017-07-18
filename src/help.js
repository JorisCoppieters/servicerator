'use strict'; // JS: ES5

// ******************************
// Requries:
// ******************************

var c = require('./constants');
var cprint = require('color-print');

// ******************************
// Functions:
// ******************************

function printHelp (in_message) {
    if (in_message) {
        cprint.yellow(in_message);
        console.log();
    }

    console.log();
    console.log(cprint.toBackgroundDarkGrey(cprint.toWhite(' '.repeat(c.SCRIPT_NAME.length + 9), true)) + '\t' + cprint.toBackgroundLightMagenta(cprint.toWhite(' '.repeat(c.VERSION.length + 12), true)));
    console.log(cprint.toBackgroundDarkGrey(cprint.toWhite('  ' + c.SCRIPT_NAME + ' Help  ', true)) + '\t' + cprint.toBackgroundLightMagenta(cprint.toWhite('  Version ' + c.VERSION + '  ', true)));
    console.log(cprint.toBackgroundDarkGrey(cprint.toWhite(' '.repeat(c.SCRIPT_NAME.length + 9), true)) + '\t' + cprint.toBackgroundLightMagenta(cprint.toWhite(' '.repeat(c.VERSION.length + 12), true)));
    console.log();
    cprint.green('General Options:');
    console.log(cprint.toWhite('--help') + '\t\t\t' + cprint.toCyan('Show this menu'));
    console.log(cprint.toWhite('--version') + '\t\t' + cprint.toCyan('Print the version'));
    console.log();
    cprint.green('Init Commands:');
    console.log(cprint.toWhite('init') + ' ' + cprint.toDarkGray('FOLDER') + '\t\t' + cprint.toCyan('Initialise the service.json file in this folder'));
    console.log();
    cprint.green('Setup Commands:');
    console.log(cprint.toWhite('setup') + '\t\t\t' + cprint.toCyan('Setup this folder'));
    console.log('  ' + cprint.toYellow('--overwrite') + '\t\t' + cprint.toCyan('Overwrite any files that exist'));
    console.log(cprint.toWhite('git-setup') + '\t\t' + cprint.toCyan('Setup this folder as a git repository'));
    console.log('  ' + cprint.toYellow('--overwrite') + '\t\t' + cprint.toCyan('Overwrite any files that exist'));
    console.log(cprint.toWhite('hg-setup') + '\t\t' + cprint.toCyan('Setup this folder as a mercurial repository'));
    console.log('  ' + cprint.toYellow('--overwrite') + '\t\t' + cprint.toCyan('Overwrite any files that exist'));
    console.log();
    cprint.green('Docker Commands:');
    console.log(cprint.toWhite('build') + '\t\t\t' + cprint.toCyan('Build the docker image'));
    console.log('  ' + cprint.toYellow('--remove-old') + '\t\t' + cprint.toCyan('Remove old docker images'));
    console.log(cprint.toWhite('push') + '\t\t\t' + cprint.toCyan('Push the docker image'));
}

// ******************************

function printVersion () {
    cprint.green('Version ' + c.VERSION);
}

// ******************************
// Exports:
// ******************************

module.exports['printHelp'] = printHelp;
module.exports['printVersion'] = printVersion;

// ******************************
