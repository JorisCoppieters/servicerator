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

    cprint.rainbow(c.SCRIPT_NAME + ' Help');
    console.log();
    cprint.magenta('Version ' + c.VERSION);
    console.log();
    cprint.green('General Options:');
    console.log(cprint.toWhite('--help') + '\t\t\t\t' + cprint.toCyan('Show this menu'));
    console.log(cprint.toWhite('--version') + '\t\t\t' + cprint.toCyan('Print the version'));
    console.log();
    cprint.green('Init Commands:');
    console.log(cprint.toWhite('init') + ' ' + cprint.toDarkGray('FOLDER (Optional)') + '\t\t' + cprint.toCyan('Initialise this folder'));
    console.log(cprint.toWhite('git-init') + ' ' + cprint.toDarkGray('FOLDER (Optional)') + '\t' + cprint.toCyan('Initialise this folder as a git repository'));
    console.log(cprint.toWhite('hg-init') + ' ' + cprint.toDarkGray('FOLDER (Optional)') + '\t' + cprint.toCyan('Initialise this folder as a mercurial repository'));
    console.log();
    cprint.green('Init Options:');
    console.log(cprint.toYellow('--overwrite') + '\t\t\t' + cprint.toCyan('Overwrite any files that exist'));
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
