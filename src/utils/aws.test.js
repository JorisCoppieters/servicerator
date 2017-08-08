'use strict'; // JS: ES6

// ******************************
// Requires:
// ******************************

let path = require('path');
let cprint = require('color-print');

let date = require('./date');
let aws = require('./aws');
let env = require('./env');
let fs = require('./filesystem');
let test = require('./test');

// ******************************
// Functions:
// ******************************

function runTests () {
    cprint.magenta('Running aws util tests...');
}

// ******************************
// Exports:
// ******************************

module.exports['runTests'] = runTests;

// ******************************
