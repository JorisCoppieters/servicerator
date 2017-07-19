#!/usr/bin/env node

'use strict'; // JS: ES6

// ******************************
//
//
// SERVICERATOR v0.2.0
//
// 0.1.0
// - Initial release
//
// ******************************

// ******************************
// Requires:
// ******************************

let cprint = require('color-print');
let minimist = require('minimist');
let path = require('path');

let docker = require('./src/plugins/docker');
let edit = require('./src/plugins/edit');
let info = require('./src/plugins/info');
let summary = require('./src/plugins/summary');

let env = require('./src/utils/env');
let service = require('./src/utils/service');

let help = require('./src/help');
let init = require('./src/init');
let setup = require('./src/setup');

// ******************************
// Constants:
// ******************************

// ******************************
// Globals:
// ******************************

let g_IGNORE_FILES = [
    'docker/*/.aws_cache/*',
    'docker/*/auth/*.crt',
    'docker/*/auth/*.key',
    'docker/*/logs/*',
    'docker/*/model/*',
    'docker/*/node/node_modules/*',
    'docker/*/s3/*',
];

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

    let command = params.length ? params.shift() : 'info';
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
        return;
    }

    if (['docker'].indexOf(command) >= 0 &&
        docker.handleCommand(params, serviceConfig)) {
        return;
    }

    if (['edit'].indexOf(command) >= 0 &&
        edit.handleCommand(params, serviceConfig)) {
        return;
    }

    if (['info', 'service', 'details'].indexOf(command) >= 0 &&
        info.handleCommand(params, serviceConfig)) {
        return;
    }

    if (['summary'].indexOf(command) >= 0 &&
        summary.handleCommand(params, serviceConfig)) {
        return;
    }

    switch(command)
    {
        case 'setup':
            setup.folder(serviceConfig, overwrite);
            break;
        case 'git-setup':
            setup.gitFolder(serviceConfig, overwrite);
            break;
        case 'hg-setup':
            setup.hgFolder(serviceConfig, overwrite);
            break;
        default:
            cprint.yellow('Unknown command: ' + command + ' ' + params);
            break;
    }
}

// ******************************
