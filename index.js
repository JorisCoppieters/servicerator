#!/usr/bin/env node

'use strict'; // JS: ES6

// ******************************
//
//
// SERVICERATOR v0.6.0
//
// 0.5.4
// - Bug fixes for home folder
//
// 0.1.0
// - Initial release
//
// ******************************

// ******************************
// Requires:
// ******************************

let clone = require('clone');
let cprint = require('color-print');
let minimist = require('minimist');
let path = require('path');

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
        return;
    }

    if (command === 'version') {
        help.printVersion();
        return;
    }

    if (command === 'init') {
        let folderName = params.length ? params.shift() : '.';
        service.initFolder(folderName);
        return;
    }

    let serviceConfig = env.getServiceConfig();
    if (!serviceConfig) {
        serviceConfig = service.getConfig('.');
    }

    if (!serviceConfig) {
        return;
    }

    plugins.forEach(p => {
        if (p.onOpen) {
            p.onOpen(serviceConfig);
        }
    });

    let pluginHandled = false;
    plugins.forEach(p => {
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
                if (p.handleCommand(clone(g_ARGV), clone(params), serviceConfig)) {
                    pluginHandled = true;
                    return;
                }
            } catch (e) {
                let stack = e.stack.replace(/[\\]/g, "\\$&");

                let errorTitle = 'AH BUGGER! AN ERROR OCCURED';
                print.out(cprint.toBackgroundRed(cprint.toBold(cprint.toYellow(' '.repeat(errorTitle.length + 4), true), true)) + '\n');
                print.out(cprint.toBackgroundRed(cprint.toBold(cprint.toYellow('  ' + errorTitle + '  ', true), true)) + '\n');
                print.out(cprint.toBackgroundRed(cprint.toBold(cprint.toYellow(' '.repeat(errorTitle.length + 4), true), true)) + '\n');
                print.out('\n');
                print.out(cprint.toMagenta('Please send the following to') + ' ' + cprint.toBold(cprint.toLightMagenta('joris.coppieters@gmail.com', true)) + '\n');
                print.out('\n');
                print.out(cprint.toYellow('Script Command: [' + process.argv.slice(2).join(', ') + ']') + '\n');
                print.out(cprint.toYellow('Error Stack Trace: '));
                print.out(cprint.toRed(stack) + '\n');
                return;
            }
        }
    });

    plugins.forEach(p => {
        if (p.onClose) {
            p.onClose(serviceConfig);
        }
    });

    if (pluginHandled) {
        return;
    }

    cprint.yellow('Unknown command: ' + command + ' ' + params);
}

// ******************************
