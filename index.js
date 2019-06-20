#!/usr/bin/env node

'use strict'; // JS: ES6

// ******************************
//
// SERVICERATOR v0.19.8
//
// ******************************

// ******************************
// Requires:
// ******************************

let cprint = require('color-print');
let minimist = require('minimist');

let help = require('./src/help');

let env = require('./src/utils/env');
let service = require('./src/utils/service');
let print = require('./src/utils/print');
let plugins = env.getPlugins();

// ******************************
// Arguments:
// ******************************

let g_ARGV = minimist(process.argv.slice(2));

// ******************************
// Script:
// ******************************

if (g_ARGV['help']) {
    help.printHelp();
} else if (g_ARGV['version']) {
    help.printVersion();
} else {
    let params = g_ARGV['_'] || false;

    let command = params.length ? params.shift().toLowerCase() : 'info';
    if (command === 'help') {
        help.printHelp();
    }

    else if (command === 'version') {
        help.printVersion();
    }

    else if (command === 'init') {
        let folderName = params.length ? params.shift() : '.';
        service.initFolder(folderName);
    }

    else {
        let serviceConfig = service.loadConfig();
        if (serviceConfig) {
            service.checkConfigSchema(serviceConfig);
        } else {
            serviceConfig = service.createConfig('.');
        }

        plugins.forEach(p => {
            if (!serviceConfig && !p.noConfigRequired) {
                return;
            }
            if (p.onOpen) {
                p.onOpen(serviceConfig);
            }
        });

        let pluginHandled = false;
        plugins.forEach(p => {
            if (!serviceConfig && !p.noConfigRequired) {
                return;
            }
            if (!p.getBaseCommands) {
                return;
            }
            if (p.getBaseCommands().indexOf(command) >= 0) {
                let nextParam = (params[0] || '').toLowerCase();
                if (nextParam === 'help') {
                    help.printPluginHelp(command);
                    pluginHandled = true;
                    return;
                }

                try {
                    let clone = require('clone');
                    if (p.handleCommand(clone(g_ARGV), clone(params), serviceConfig)) {
                        pluginHandled = true;
                        return;
                    }
                } catch (e) {
                    let stack = e.stack.replace(/[\\]/g, '\\$&');
                    if (e instanceof Error) {
                        print.out(cprint.toYellow('An error occured running ') + cprint.toWhite(`svr ${process.argv.slice(2).join(' ')}`) + cprint.toYellow(' ...') + '\n');
                        print.out(cprint.toRed(stack) + '\n');
                        process.exit(1);
                    }

                    _printHeader('AH BUGGER! A BAD ERROR OCCURED', cprint.toBackgroundRed, (content, reset) => cprint.toBold(cprint.toYellow(content, reset), reset));
                    print.out(cprint.toMagenta('Please send the following to') + ' ' + cprint.toBold(cprint.toLightMagenta('joris.coppieters@gmail.com', true)) + '\n');
                    print.out('\n');
                    print.out(cprint.toYellow('Script Command: [' + process.argv.slice(2).join(', ') + ']') + '\n');
                    print.out(cprint.toYellow('Error Stack Trace: '));
                    print.out(cprint.toRed(stack) + '\n');
                    print.out('\n');
                    process.exit(1);
                }
            }
        });

        plugins.forEach(p => {
            if (!serviceConfig && !p.noConfigRequired) {
                return;
            }
            if (p.onClose) {
                p.onClose(serviceConfig);
            }
        });

        if (!pluginHandled) {
            if (serviceConfig) {
                cprint.yellow('Unknown command: ' + command + ' ' + params);
            } else {
                cprint.yellow('Could not find service.json file in this folder');
            }
        }
    }
}

// ******************************

function _printHeader (in_title, in_backgroundFn, in_foregroundFn) {
    print.out('\n');
    print.out(in_backgroundFn(in_foregroundFn(' '.repeat(in_title.length + 4), true), true) + '\n');
    print.out(in_backgroundFn(in_foregroundFn('  ' + in_title + '  ', true), true) + '\n');
    print.out(in_backgroundFn(in_foregroundFn(' '.repeat(in_title.length + 4), true), true) + '\n');
    print.out('\n');
}

// ******************************
