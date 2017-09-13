'use strict'; // JS: ES6

// ******************************
// Requires:
// ******************************

let cprint = require('color-print');

let c = require('./constants');
let env = require('./utils/env');
let plugins = env.getPlugins();

// ******************************
// Constants:
// ******************************

let SPACING = 32;

// ******************************
// Functions:
// ******************************

function printHelp (in_message) {
    if (in_message) {
        cprint.yellow(in_message);
        console.log();
    }

    console.log();
    console.log(cprint.toBackgroundMagenta(cprint.toWhite(' '.repeat(c.SCRIPT_NAME.length + 18), true)) + ' ' + cprint.toBackgroundMagenta(cprint.toWhite(' '.repeat(c.VERSION.length + 12), true)));
    console.log(cprint.toBackgroundMagenta(cprint.toWhite('  ' + c.SCRIPT_NAME + ' Help  ' + ' '.repeat(9), true)) + ' ' + cprint.toBackgroundMagenta(cprint.toWhite('  Version ' + c.VERSION + '  ', true)));
    console.log(cprint.toBackgroundMagenta(cprint.toWhite(' '.repeat(c.SCRIPT_NAME.length + 18), true)) + ' ' + cprint.toBackgroundMagenta(cprint.toWhite(' '.repeat(c.VERSION.length + 12), true)));
    console.log();
    _printHelpHeader('General Options');
    console.log(cprint.toWhite('--help') + '\t\t\t\t' + cprint.toCyan('Show this menu'));
    console.log(cprint.toWhite('--version') + '\t\t\t' + cprint.toCyan('Print the version'));
    console.log();
    _printHelpHeader('Init Commands');
    console.log(cprint.toLightGreen('init') + ' ' + cprint.toLightGrey('FOLDER (Optional)') + '\t\t' + cprint.toCyan('Initialise the service.json file in this folder'));
    console.log();

    plugins.forEach(p => {
        if (!p.getBaseCommands) {
            return;
        }
        _printPluginHelp(p.getTitle(), p.getCommands());
    });
}

// ******************************

function printPluginHelp (in_command) {
    plugins.forEach(p => {
        if (!p.getBaseCommands) {
            return;
        }
        if (p.getBaseCommands().indexOf(in_command) >= 0) {
            _printPluginHelp(p.getTitle(), p.getCommands());
        }
    });
}

// ******************************
// Test Functions:
// ******************************

function _printPluginHelp (in_plugin, in_commands) {
    _printHelpHeader(in_plugin + ' Commands');
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
            console.log(cprint.toLightGreen(firstParam) + cprint.toCyan(description));
        } else {
            console.log(cprint.toGreen(firstParam) + cprint.toCyan(description));
        }

        options.forEach(option => {
            let optionParam = option.param;
            if (!optionParam) {
                return;
            }

            let optionParamPrefix = (optionParam.length > 1 ? '--' : '-');
            if (optionParam.match(/^\+.*/)) {
                optionParamPrefix = '';
            }

            optionParam = optionParamPrefix + optionParam;
            let optionDescription = option.description || '';

            let indent = '  ';

            optionParam = (indent + optionParam + ' '.repeat(SPACING)).substr(0, SPACING);

            console.log(cprint.toLightGrey(optionParam) + '  ' + cprint.toCyan(optionDescription));
        });

        console.log();
    });
}

// ******************************

function _printHelpHeader (in_title) {
    console.log();
    cprint.backgroundLightBlue(cprint.toWhite(' '.repeat(in_title.length + 2), true));
    cprint.backgroundLightBlue(cprint.toWhite(' ' + in_title + ' ', true));
    cprint.backgroundLightBlue(cprint.toWhite(' '.repeat(in_title.length + 2), true));
    console.log();
}

// ******************************

function printVersion () {
    cprint.green('Version ' + c.VERSION);
}

// ******************************
// Exports:
// ******************************

module.exports['printHelp'] = printHelp;
module.exports['printPluginHelp'] = printPluginHelp;
module.exports['printVersion'] = printVersion;

// ******************************
