'use strict'; // JS: ES6

// ******************************
// Requires:
// ******************************

let cprint = require('color-print');

let init = require('../utils/init');

// ******************************
// Functions:
// ******************************

function setServiceValue (in_serviceConfig, in_keyPath, in_keyValue) {
    let serviceConfig = in_serviceConfig || {};

    if (!in_keyPath) {
        cprint.yellow('Specify a key path to set, i.e service.name');
        return;
    }

    let keyPath = in_keyPath;
    let keyPathMatch = keyPath.match(/(.*?)=(.*)/);
    let keyValue = in_keyValue;
    if (keyPathMatch) {
        keyPath = keyPathMatch[1];
        keyValue = keyPathMatch[2];
    }

    if (!keyValue) {
        cprint.yellow('Specify a value to set');
        return;
    }

    let updateConfig = {};
    let keyPathParts = keyPath
        .split(/\./)
        .filter(k => k.trim());

    if (!keyPathParts.length) {
        cprint.yellow('Specify a valid key path to set, i.e service.name');
        return;
    }

    let keyPathPart;
    let configSubObject = updateConfig;
    while (keyPathParts.length > 1) {
        keyPathPart = keyPathParts.shift();
        configSubObject[keyPathPart] = {};
        configSubObject = configSubObject[keyPathPart];
    }

    keyPathPart = keyPathParts.shift();
    configSubObject[keyPathPart] = keyValue;

    serviceConfig = init.updateServiceConfig(serviceConfig, updateConfig);
}

// ******************************
// Plugin Functions:
// ******************************

function handleCommand (in_args, in_params, in_serviceConfig) {
    let keyPath = in_params.shift() || '';
    let keyValue = in_params.shift() || '';
    setServiceValue(in_serviceConfig, keyPath, keyValue);
    return true;
}

// ******************************

function getBaseCommands () {
    return ['set'];
}

// ******************************

function getCommands () {
    return [
        { params: [''], description: 'Set service config value by specifing the key path and value like: service.name=my-service' },
    ];
}

// ******************************

function getTitle () {
    return 'Set';
}

// ******************************
// Exports:
// ******************************

module.exports['handleCommand'] = handleCommand;
module.exports['getBaseCommands'] = getBaseCommands;
module.exports['getCommands'] = getCommands;
module.exports['getTitle'] = getTitle;

// ******************************
