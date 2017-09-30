'use strict'; // JS: ES6

// ******************************
// Requires:
// ******************************

let cprint = require('color-print');

let service = require('../utils/service');

// ******************************
// Functions:
// ******************************

function unsetServiceValue (in_serviceConfig, in_keyPath) {
    service.unsetValue(in_serviceConfig, in_keyPath);
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
