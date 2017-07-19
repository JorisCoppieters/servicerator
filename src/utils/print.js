'use strict'; // JS: ES6

// ******************************
// Requries:
// ******************************

let cprint = require('color-print');

// ******************************
// Functions:
// ******************************

function clearLine () {
    out('\r' + ' '.repeat(100) + '\r');
}

// ******************************

function out (in_string) {
    let string = in_string;
    if (typeof(string) !== 'string') {
        string = string.toString();
    }
    process.stdout.write(string);
}

// ******************************

function printKeyVal (in_key, in_val) {
    out(cprint.toGreen(in_key) + ' ' + cprint.toWhite('=>') + ' ' + cprint.toCyan(in_val) + '\n');
}

// ******************************
// Exports:
// ******************************

module.exports['clearLine'] = clearLine;
module.exports['out'] = out;
module.exports['keyVal'] = printKeyVal;

// ******************************
