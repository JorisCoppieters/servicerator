'use strict'; // JS: ES6

// ******************************
// Requires:
// ******************************

let cprint = require('color-print');

let init = require('../utils/init');

// ******************************
// Functions:
// ******************************

function unsetServiceValue (in_serviceConfig, in_keyPath) {
    let serviceConfig = in_serviceConfig || {};

    if (!in_keyPath) {
        cprint.yellow('Specify a key path to unset, i.e service.name');
        return;
    }

    let keyPath = in_keyPath;

    let removeConfig = {};
    let keyPathParts = keyPath
        .split(/\./)
        .filter(k => k.trim());

    if (!keyPathParts.length) {
        cprint.yellow('Specify a valid key path to unset, i.e service.name');
        return;
    }

    let keyPathPart;
    let configSubObject = removeConfig;
    while (keyPathParts.length > 1) {
        keyPathPart = keyPathParts.shift();
        configSubObject[keyPathPart] = {};
        configSubObject = configSubObject[keyPathPart];
    }

    keyPathPart = keyPathParts.shift();
    configSubObject[keyPathPart] = false;

    serviceConfig = init.removeServiceConfig(serviceConfig, removeConfig);
}

// ******************************
// Plugin Functions:
// ******************************

function handleCommand (in_args, in_params, in_serviceConfig) {
    let keyPath = in_params.shift() || '';
    unsetServiceValue(in_serviceConfig, keyPath);
    return true;
}

// ******************************

function getBaseCommands () {
    return ['unset'];
}

// ******************************

function getCommands () {
    return [
        { params: [''], description: 'Remove service config value by specifing the key path like: service.name' },
    ];
}

// ******************************

function getTitle () {
    return 'Unset';
}

// ******************************
// Exports:
// ******************************

module.exports['handleCommand'] = handleCommand;
module.exports['getBaseCommands'] = getBaseCommands;
module.exports['getCommands'] = getCommands;
module.exports['getTitle'] = getTitle;

// ******************************
