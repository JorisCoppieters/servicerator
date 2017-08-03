'use strict'; // JS: ES6

// ******************************
// Requires:
// ******************************

let cprint = require('color-print');
let os = require('os');

let fs = require('./filesystem');
let exec = require('./exec');

// ******************************
// Constants:
// ******************************

const k_GIT_BASH_WIN32_PATH = "C:/Program Files/Git/git-bash.exe";

// ******************************
// Globals:
// ******************************

let g_GIT_BASH_INSTALLED = undefined;
let g_GIT_BASH_PATH = undefined;

// ******************************
// Functions:
// ******************************

function gitBashCmd (in_args, in_hide) {
    if (!gitBashInstalled()) {
        cprint.yellow('GitBash isn\'t installed');
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
        if (os.platform() !== 'win32') {
            g_GIT_BASH_INSTALLED = false;
        } else {
            g_GIT_BASH_PATH = k_GIT_BASH_WIN32_PATH;
            g_GIT_BASH_INSTALLED = fs.fileExists(g_GIT_BASH_PATH);
        }
    }
    return g_GIT_BASH_INSTALLED;
}

// ******************************
// Exports:
// ******************************

module.exports['cmd'] = gitBashCmd;
module.exports['installed'] = gitBashInstalled;

// ******************************
