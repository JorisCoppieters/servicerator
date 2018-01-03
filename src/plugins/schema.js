'use strict'; // JS: ES6

// ******************************
// Requires:
// ******************************

let service = require('../utils/service');
let print = require('../utils/print');

// ******************************
// Functions:
// ******************************

function printSchema () {
    let schema = service.getConfigSchema();
    print.out(JSON.stringify(schema, null, 4) + '\n');
}

// ******************************
// Plugin Functions:
// ******************************

function handleCommand (in_args, in_params) {
    let command = in_params.length ? in_params.shift().toLowerCase() : '';
    switch(command)
    {
    case '':
        printSchema();
        break;
    default:
        return false;
    }
    return true;
}

// ******************************

function getBaseCommands () {
    return ['schema'];
}

// ******************************

function getCommands () {
    return [
        { params: [''], description: 'Print out the service.json schema' },
    ];
}

// ******************************

function getTitle () {
    return 'Schema';
}

// ******************************
// Exports:
// ******************************

module.exports['handleCommand'] = handleCommand;
module.exports['getBaseCommands'] = getBaseCommands;
module.exports['getCommands'] = getCommands;
module.exports['getTitle'] = getTitle;
module.exports['noConfigRequired'] = true;

// ******************************
