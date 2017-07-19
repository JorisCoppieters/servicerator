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
let omelette = require('omelette');

let help = require('./src/help');

let docker = require('./src/plugins/docker');
let edit = require('./src/plugins/edit');
let info = require('./src/plugins/info');
let summary = require('./src/plugins/summary');
let setup = require('./src/plugins/setup');

let env = require('./src/utils/env');
let init = require('./src/utils/init');

// ******************************
// Arguments:
// ******************************

let g_ARGV = minimist(process.argv.slice(2));

// ******************************
// Script:
// ******************************

const firstArgument = ({ reply }) => {
  reply([ 'beautiful', 'cruel', 'far' ])
}

const planet = ({ reply }) => {
  reply([ 'world', 'mars', 'pluto' ])
}

omelette`hello|hi ${firstArgument} ${planet}`.init()

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

    if (['setup'].indexOf(command) >= 0 &&
        setup.handleCommand(g_ARGV, params, serviceConfig)) {
        return;
    }

    if (['docker'].indexOf(command) >= 0 &&
        docker.handleCommand(g_ARGV, params, serviceConfig)) {
        return;
    }

    if (['edit'].indexOf(command) >= 0 &&
        edit.handleCommand(g_ARGV, params, serviceConfig)) {
        return;
    }

    if (['info', 'service', 'details'].indexOf(command) >= 0 &&
        info.handleCommand(g_ARGV, params, serviceConfig)) {
        return;
    }

    if (['summary'].indexOf(command) >= 0 &&
        summary.handleCommand(g_ARGV, params, serviceConfig)) {
        return;
    }

    cprint.yellow('Unknown command: ' + command + ' ' + params);
}

// ******************************
