#!/usr/bin/env node

'use strict'; // JS: ES6

// ******************************
//
//
// SERVICERATOR v0.3.0
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
let tests = require('./src/tests');

let env = require('./src/utils/env');
let service = require('./src/utils/service');
let plugins = env.getPlugins();

// ******************************
// Arguments:
// ******************************

let g_ARGV = minimist(process.argv.slice(2));

// ******************************
// Script:
// ******************************

tests.runAllTests();

// ******************************
