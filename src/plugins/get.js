'use strict'; // JS: ES6

// ******************************
// Requires:
// ******************************

let service = require('../utils/service');

// ******************************
// Plugin Functions:
// ******************************

function handleCommand (in_args, in_params, in_serviceConfig) {
    let keyPath = in_params.shift() || '';
    service.getValue(in_serviceConfig, keyPath);
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
