'use strict'; // JS: ES6

// ******************************
// Requries:
// ******************************

let docker = require('./plugins/docker');
let edit = require('./plugins/edit');
let info = require('./plugins/info');
let summary = require('./plugins/summary');

let c = require('./constants');
let cprint = require('color-print');

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

    _printPluginHelp('Setup', [
        { params: [''], description: 'Setup this folder',
            options: [{param:'overwrite', description:'Overwrite any files that exist'}] },
        { params: ['git'], description: 'Setup this folder as a git repository',
            options: [{param:'overwrite', description:'Overwrite any files that exist'}] },
        { params: ['hg'], description: 'Setup this folder as a mercurial repository',
            options: [{param:'overwrite', description:'Overwrite any files that exist'}] },
    ]);
    _printPluginHelp('Info', info.getCommands());
    _printPluginHelp('Summary', summary.getCommands());
    _printPluginHelp('Docker', docker.getCommands());
    _printPluginHelp('Edit', edit.getCommands());
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
