'use strict'; // JS: ES6

// ******************************
// Requires:
// ******************************

let env = require('./env');
let exec = require('./exec');
let fs = require('./filesystem');

// ******************************
// Globals:
// ******************************

let g_SHELL = undefined;
let g_SHELL_INSTALLED = undefined;

// ******************************
// Functions:
// ******************************

function shellCmd (in_args, in_options) {
    let options = in_options || {};
    let hide = options.hide;

    if (!shellInstalled()) {
        throw new Error('No supported shell installed');
    }

    let args = in_args;

    if (!args) {
        return false;
    }

    if (!Array.isArray(args)) {
        args = [args];
    }

    let afterArgs = [];
    if (options.checkReturnCode) {
        afterArgs = afterArgs.concat([
            ';',
            'RET=$?; if [[ $RET -ne 0 && $RET -lt 129 ]]; then echo "Error return code ($RET) - hit enter to close..."; read; fi;'
        ]);
    }

    let shell = getShell();
    if (shell.match(/git-bash/)) {
        args = [
            '-c',
            ['winpty'].concat(args).concat(afterArgs).join(' ')
        ];
    }

    if (shell.match(/mintty/)) {
        args = [
            'bash',
            '-c',
            ['winpty'].concat(args).join(' ')
        ];
    }

    if (shell.match(/^\/bin\/bash$/)) {
        shell = args[0];
        args = args.slice(1);
    }

    return exec.cmdSync(shell, args, {
        indent: '  ',
        hide: hide
    });
}

// ******************************

function shellInstalled () {
    if (g_SHELL_INSTALLED === undefined) {
        g_SHELL_INSTALLED = !!getShell();
    }
    return g_SHELL_INSTALLED;
}

// ******************************

function getShell () {
    let shell;

    shell = g_SHELL;
    if (shell) {
        return shell;
    }

    let path = require('path');

    let shellPaths = [];

    if (env.isWindows()) {
        shellPaths = shellPaths.concat([
            'C:/Program Files/Git/git-bash.exe',
            'C:/Program Files (x86)/Git/git-bash.exe'
        ]);
    }

    if (env.isMinGW()) {
        shellPaths = shellPaths.concat([
            'C:/Program Files/Git/usr/bin/mintty.exe'
        ]);
    }

    if (env.isLinux()) {
        shellPaths = shellPaths.concat([
            '/bin/bash'
        ]);
    }

    shell = shellPaths
        .map(p => path.resolve(p))
        .filter(p => fs.fileExists(p))
        .find(() => true);

    if (shell) {
        g_SHELL = shell;
        return shell;
    }
}

// ******************************
// Exports:
// ******************************

module.exports['cmd'] = shellCmd;
module.exports['installed'] = shellInstalled;

// ******************************
