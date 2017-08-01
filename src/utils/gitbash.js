'use strict'; // JS: ES6

// ******************************
// Requires:
// ******************************

let cprint = require('color-print');

let fs = require('./filesystem');
let exec = require('./exec');

// ******************************
// Globals:
// ******************************

let g_GIT_BASH_INSTALLED = undefined;
let g_GIT_BASH_PATH = "C:/Program Files/Git/git-bash.exe";

// ******************************
// Functions:
// ******************************

function gitBashCmd (in_args, in_hide) {
    if (!gitBashInstalled()) {
        cprint.yellow('Openssl isn\'t installed');
        return false;
    }

    if (!in_args) {
        return false;
    }

    if (!Array.isArray(in_args)) {
        in_args = [in_args]
    }

    return exec.cmdSync(g_GIT_BASH_PATH, in_args, '  ', !in_hide, true);
}

// ******************************

function gitBashInstalled () {
    if (g_GIT_BASH_INSTALLED === undefined) {
        g_GIT_BASH_INSTALLED = fs.fileExists(g_GIT_BASH_PATH);
    }
    return g_GIT_BASH_INSTALLED;
}

// ******************************
// Exports:
// ******************************

module.exports['cmd'] = gitBashCmd;
module.exports['installed'] = gitBashInstalled;

// ******************************
