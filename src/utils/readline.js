'use strict'; // JS: ES6

// ******************************
// Requires:
// ******************************

const cprint = require('color-print');

const env = require('./env');
const print = require('./print');

// ******************************
// Functions:
// ******************************

function readLineSync (in_question) {
    print.out(cprint.toMagenta(in_question));
    let input = '';
    process.stdin.resume();
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (text) => {
        input = text;
    });
    while(!input) {require('deasync').sleep(100);}
    process.stdin.pause();
    if (env.isMinGW()) {
        print.out('\n');
    }
    return input.trim();
}

// ******************************

function readHiddenLineSync (in_question) {
    if (!env.isMinGW()) {
        return readLineSync(in_question);
    }

    const readlineSync = require('readline-sync');
    const input = readlineSync.question(cprint.toMagenta(in_question), {
        hideEchoBack: true
    });
    return input;
}

// ******************************
// Exports:
// ******************************

module.exports['sync'] = readLineSync;
module.exports['hiddenSync'] = readHiddenLineSync;

// ******************************
