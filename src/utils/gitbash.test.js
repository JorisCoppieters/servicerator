'use strict'; // JS: ES6

// ******************************
// Requires:
// ******************************

let cprint = require('color-print');

let gitBash = require('./gitbash');
let test = require('./test');

// ******************************
// Functions:
// ******************************

function runTests () {
    cprint.magenta('Running GitBash util tests...');
}

// ******************************
// Exports:
// ******************************

module.exports['runTests'] = runTests;

// ******************************
