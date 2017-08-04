'use strict'; // JS: ES6

// ******************************
// Requires:
// ******************************

let cprint = require('color-print');

let print = require('../utils/print');
let init = require('../utils/init');

// ******************************
// Functions:
// ******************************

function getServiceValue (in_serviceConfig, in_keyPath) {
    let serviceConfig = in_serviceConfig || {};

    if (!in_keyPath) {
        cprint.yellow('Specify a key path to set, i.e service.name');
        return;
    }

    let keyPath = in_keyPath;
    let keyPathParts = keyPath
        .split(/\./)
        .filter(k => k.trim());

    if (!keyPathParts.length) {
        cprint.yellow('Specify a valid key path to set, i.e service.name');
        return;
    }

    let keyPathPart;
    let configSubObject = serviceConfig;
    while (keyPathParts.length > 1) {
        keyPathPart = keyPathParts.shift();
        configSubObject = configSubObject[keyPathPart] || {};
    }

    keyPathPart = keyPathParts.shift();
    let keyValue = configSubObject[keyPathPart];

    if (typeof(keyValue) === 'object') {
        keyValue = JSON.stringify(keyValue, null, 4);
    }

    print.keyVal(keyPath, keyValue);
}

// ******************************
// Plugin Functions:
// ******************************

function handleCommand (in_args, in_params, in_serviceConfig) {
    let keyPath = in_params.shift() || '';
    getServiceValue(in_serviceConfig, keyPath);
    return true;
}

// ******************************

function getBaseCommands () {
    return ['get'];
}

// ******************************

function getCommands () {
    return [
        { params: [''], description: 'Get service config value by specifing the key path like: service.name' },
    ];
}

// ******************************

function getTitle () {
    return 'Get';
}

// ******************************
// Exports:
// ******************************

module.exports['handleCommand'] = handleCommand;
module.exports['getBaseCommands'] = getBaseCommands;
module.exports['getCommands'] = getCommands;
module.exports['getTitle'] = getTitle;

// ******************************
