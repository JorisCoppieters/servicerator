'use strict'; // JS: ES6

// ******************************
// Requires:
// ******************************

let cprint = require('color-print');

let exec = require('./exec');

// ******************************
// Globals:
// ******************************

let g_OPENSSL_INSTALLED = undefined;

// ******************************
// Functions:
// ******************************

function opensslCmd (in_args, in_options) {
    let opt = in_options || {};

    if (!opensslInstalled()) {
        cprint.yellow('Openssl isn\'t installed');
        return false;
    }

    if (!in_args) {
        return false;
    }

    if (!Array.isArray(in_args)) {
        in_args = [in_args];
    }

    return exec.cmdSync('openssl', in_args, {
        indent: '  ',
        hide: opt.hide,
        errToOut: true
    });
}

// ******************************

function opensslInstalled () {
    if (g_OPENSSL_INSTALLED === undefined) {
        g_OPENSSL_INSTALLED = !!opensslVersion();
    }
    return g_OPENSSL_INSTALLED;
}

// ******************************

function opensslVersion () {
    let cmdResult = exec.cmdSync('openssl', ['version'], {
        indent: '',
        hide: true
    });

    if (cmdResult.hasError) {
        return false;
    } else {
        return cmdResult.result;
    }
}

// ******************************
// Exports:
// ******************************

module.exports['cmd'] = opensslCmd;
module.exports['installed'] = opensslInstalled;
module.exports['version'] = opensslVersion;

// ******************************
