'use strict'; // JS: ES6

// ******************************
// Requries:
// ******************************

let cprint = require('color-print');

let c = require('./constants');
let env = require('./utils/env');
let plugins = env.getPlugins();

// ******************************
// Constants:
// ******************************

let SPACING = 24;

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

    plugins.forEach(p => {
        _printPluginHelp(p.getTitle(), p.getCommands());
    });
}

// ******************************

function _printPluginHelp (in_plugin, in_commands) {
    console.log();
    cprint.green(in_plugin + ' Commands:');
    in_commands.forEach(command => {
        let params = command.params || [];
        if (!params.length) {
            return;
        }
        let description = command.description || '';
        let options = command.options || [];

        let defaultParam = (params.find(p => p === '') === '');
        let firstParam = params.find(p => p.length !== 0) || false;
        firstParam = in_plugin.toLowerCase() + (firstParam ? ' ' + firstParam : '');

        firstParam = (firstParam + ' '.repeat(SPACING)).substr(0, SPACING);

        if (defaultParam) {
            console.log(cprint.toWhite(firstParam) + cprint.toCyan(description));
        } else {
            console.log(cprint.toLightGrey(firstParam) + cprint.toCyan(description));
        }

        options.forEach(option => {
            let optionParam = option.param;
            if (!optionParam) {
                return;
            }

            optionParam = '--' + optionParam;
            let optionDescription = option.description || '';

            let indent = '  ';

            optionParam = (indent + optionParam + ' '.repeat(SPACING)).substr(0, SPACING);

            console.log(cprint.toYellow(optionParam) + cprint.toCyan(optionDescription));
        });
    });
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
