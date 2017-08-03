#!/usr/bin/env node

'use strict'; // JS: ES6

// ******************************
//
//
// SERVICERATOR v0.4.1
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
let init = require('./src/utils/init');
let service = require('./src/utils/service');
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
    let overwrite = g_ARGV['overwrite'];

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
        init.folder(folderName, overwrite);
        return;
    }

    let serviceConfig = env.getServiceConfig();
    if (!serviceConfig) {
        serviceConfig = service.getConfig('.');
    }

    if (!serviceConfig) {
        return;
    }

    let pluginHandled = false;
    plugins.forEach(p => {
        if (p.getBaseCommands().indexOf(command) >= 0) {
            let nextParam = (params[0] || '').toLowerCase();
            if (nextParam === 'help') {
                help.printPluginHelp(command);
                pluginHandled = true;
                return;
            }

            if (p.handleCommand(clone(g_ARGV), clone(params), serviceConfig)) {
                pluginHandled = true;
                return;
            }
        }
    });

    if (pluginHandled) {
        return;
    }

    cprint.yellow('Unknown command: ' + command + ' ' + params);
}

// ******************************
