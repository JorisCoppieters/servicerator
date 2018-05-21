'use strict'; // JS: ES6

// ******************************
// Requires:
// ******************************

let service = require('../utils/service');

// ******************************
// Plugin Functions:
// ******************************

function handleCommand (in_args, in_params, in_serviceConfig) {
    let keyPath = in_params.shift();
    let keyValue = in_params.shift();
    service.setValue(in_serviceConfig, keyPath, keyValue);
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
