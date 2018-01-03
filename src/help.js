'use strict'; // JS: ES6

// ******************************
// Requires:
// ******************************

let cprint = require('color-print');

let print = require('./utils/print');
let c = require('./constants');
let env = require('./utils/env');

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
        print.out('\n');
    }

    print.out('\n');
    print.out(cprint.toBackgroundMagenta(cprint.toWhite(' '.repeat(c.SCRIPT_NAME.length + 18), true)) + ' ' + cprint.toBackgroundMagenta(cprint.toWhite(' '.repeat(c.VERSION.length + 12), true)) + '\n');
    print.out(cprint.toBackgroundMagenta(cprint.toWhite('  ' + c.SCRIPT_NAME + ' Help  ' + ' '.repeat(9), true)) + ' ' + cprint.toBackgroundMagenta(cprint.toWhite('  Version ' + c.VERSION + '  ', true)) + '\n');
    print.out(cprint.toBackgroundMagenta(cprint.toWhite(' '.repeat(c.SCRIPT_NAME.length + 18), true)) + ' ' + cprint.toBackgroundMagenta(cprint.toWhite(' '.repeat(c.VERSION.length + 12), true)) + '\n');
    print.out('\n');
    _printHelpHeader('General Options');
    print.out(cprint.toWhite('--help') + '\t\t\t\t' + cprint.toCyan('Show this menu') + '\n');
    print.out(cprint.toWhite('--version') + '\t\t\t' + cprint.toCyan('Print the version') + '\n');
    print.out('\n');
    _printHelpHeader('Init Commands');
    print.out(cprint.toLightGreen('init') + ' ' + cprint.toLightGrey('FOLDER (Optional)') + '\t\t' + cprint.toCyan('Initialise the service.json file in this folder') + '\n');
    print.out('\n');

    let plugins = env.getPlugins();
    plugins.forEach(p => {
        if (!p.getBaseCommands) {
            return;
        }
        _printPluginHelp(p.getTitle(), p.getCommands());
    });
}

// ******************************

function printPluginHelp (in_command) {
    let plugins = env.getPlugins();
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
            print.out(cprint.toLightGreen(firstParam) + cprint.toCyan(description) + '\n');
        } else {
            print.out(cprint.toGreen(firstParam) + cprint.toCyan(description) + '\n');
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

            print.out(cprint.toLightGrey(optionParam) + '  ' + cprint.toCyan(optionDescription) + '\n');
        });

        print.out('\n');
    });
}

// ******************************

function _printHelpHeader (in_title) {
    print.out('\n');
    cprint.backgroundLightBlue(cprint.toWhite(' '.repeat(in_title.length + 2), true));
    cprint.backgroundLightBlue(cprint.toWhite(' ' + in_title + ' ', true));
    cprint.backgroundLightBlue(cprint.toWhite(' '.repeat(in_title.length + 2), true));
    print.out('\n');
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
