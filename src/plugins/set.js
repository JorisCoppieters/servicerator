'use strict'; // JS: ES6

// ******************************
// Requires:
// ******************************

let cprint = require('color-print');

let service = require('../utils/service');

// ******************************
// Functions:
// ******************************

function setServiceValue (in_serviceConfig, in_keyPath, in_keyValue) {
    service.setValue(in_serviceConfig, in_keyPath, in_keyValue);
}

// ******************************
// Plugin Functions:
// ******************************

function handleCommand (in_args, in_params, in_serviceConfig) {
    let keyPath = in_params.shift();
    let keyValue = in_params.shift();
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
