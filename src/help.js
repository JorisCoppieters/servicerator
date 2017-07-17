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
    console.log(cprint.toWhite('--help') + '\t\t\t' + cprint.toCyan('Show this menu'));
    console.log(cprint.toWhite('--version') + '\t\t' + cprint.toCyan('Print the version'));
    // console.log();
    // cprint.green('Flags:');
    // console.log(cprint.toWhite('--debug') + '\t\t\t' + cprint.toCyan('Debug mode'));
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
