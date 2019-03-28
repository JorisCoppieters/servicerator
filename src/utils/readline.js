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

function _readLineSync (in_question) {
    print.out(in_question);
    let input = '';
    process.stdin.resume();
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (text) => {
        input = text;
    });
    while(!input) {require('deasync').sleep(100);}
    process.stdin.pause();
    return input.trim();
}

// ******************************

function readLineSync (in_question) {
    return _readLineSync(cprint.toMagenta(in_question + ':') + ' ');
}

// ******************************

function readHiddenLineSync (in_question, in_username) {
    if (env.isMinGW()) {
        return _readHiddenLineSyncMinGW(in_question);
    }

    if (env.isWindows()) {
        try {
            return _readHiddenLineSyncWindows(in_question, in_username);
        } catch (e) {
            return _readHiddenLineSyncInClear(in_question);
        }
    }

    return _readHiddenLineSyncInClear(in_question);
}

// ******************************

function _readHiddenLineSyncMinGW (in_question) {
    const readlineSync = require('readline-sync');
    const input = readlineSync.question(cprint.toMagenta(in_question + ': '), {
        hideEchoBack: true
    });
    return input;
}

// ******************************

function _readHiddenLineSyncWindows (in_question, in_username) {
    const exec = require('./exec');
    const fs = require('./filesystem');
    const path = require('path');

    print.out(cprint.toMagenta(in_question) + ' ' + cprint.toYellow('(in Windows Credential Window)') + '\n');

    const bundledScriptPath = path.join(__dirname, 'readPassword.ps1');
    const copiedScriptPath = path.join(env.getTemp(), 'svr-read-password.ps1');
    fs.writeFile(copiedScriptPath, fs.readFile(bundledScriptPath));
    const cmdResult = exec.cmdSync('powershell', ['-f', copiedScriptPath, '-prompt', in_username], {
        hide: true
    });
    fs.deleteFile(copiedScriptPath);
    if (cmdResult.hasError) {
        throw cmdResult.error;
    }
    return cmdResult.result;
}

// ******************************

function _readHiddenLineSyncInClear (in_question) {
    return _readLineSync(cprint.toMagenta(in_question) + cprint.toYellow(' (due to shell incompatibility, the input cannot be hidden): '));
}

// ******************************
// Exports:
// ******************************

module.exports['sync'] = readLineSync;
module.exports['hiddenSync'] = readHiddenLineSync;

// ******************************
