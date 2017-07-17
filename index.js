#!/usr/bin/env node

'use strict'; // JS: ES5

// ******************************
//
//
// SERVICERATOR v0.1.0
//
// 0.1.0
// - Initial release
//
// ******************************

// ******************************
// Requires:
// ******************************

var minimist = require('minimist');
var cprint = require('color-print');
var c = require('./src/constants');
var help = require('./src/help');

// ******************************
// Constants:
// ******************************

// ******************************
// Globals:
// ******************************

// ******************************
// Arguments:
// ******************************

var g_ARGV = minimist(process.argv.slice(2));

// ******************************
// Script:
// ******************************

if (g_ARGV['help']) {
    help.printHelp();
} else if (g_ARGV['version']) {
    help.printVersion();
} else {
    //TODO
}

// ******************************
// Functions:
// ******************************

// ******************************
// Exports:
// ******************************
