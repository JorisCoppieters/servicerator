#!/usr/bin/env node

'use strict'; // JS: ES6

// ******************************
//
//
// SERVICERATOR v0.1.3
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
let process = require('process');

let docker = require('./src/docker');
let help = require('./src/help');
let init = require('./src/init');
let print = require('./src/print');
let service = require('./src/service');
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
    let commands = g_ARGV['_'] || false;
    let overwrite = g_ARGV['overwrite'];

    let command = commands.length ? commands.shift() : false;
    if (!command) {
        help.printHelp();
        return;
    }

    if (['docker', 'git', 'hg'].indexOf(command) >= 0) {
        command = command + '-' + (commands.length ? commands.shift() : '');
    }

    let folderName = commands.length ? commands.shift() : '.';
    if (command === 'init') {
        init.folder(folderName, overwrite);
        return;
    }

    let serviceConfig = init.getConfig(folderName);
    if (!serviceConfig) {
        return;
    }

    switch(command)
    {
        case 'help':
            help.printHelp();
            break;
        case 'version':
            help.printVersion();
            break;

        case 'info':
        case 'service':
        case 'details':
            print.serviceInfo(serviceConfig);
            break;
        case 'setup':
            setup.folder(serviceConfig, overwrite);
            break;
        case 'git-setup':
            setup.gitFolder(serviceConfig, overwrite);
            break;
        case 'hg-setup':
            setup.hgFolder(serviceConfig, overwrite);
            break;
        case 'docker-':
        case 'docker-info':
        case 'docker-list':
        case 'docker-images':
            docker.listImages(serviceConfig);
            break;
        case 'docker-build':
            docker.buildImage(serviceConfig);
            break;
        case 'docker-push':
            docker.pushImage(serviceConfig);
            break;
        case 'docker-clean':
            docker.cleanImages(serviceConfig);
            break;
        case 'docker-purge':
            docker.purgeImages(serviceConfig);
            break;
        default:
            cprint.yellow('Unknown command: ' + command);
            break;
    }
}

// ******************************
