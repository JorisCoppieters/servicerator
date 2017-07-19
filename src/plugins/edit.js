'use strict'; // JS: ES6

// ******************************
// Requries:
// ******************************

let cprint = require('color-print');

let edit = require('../utils/edit');
let env = require('../utils/env');

// ******************************
// Functions:
// ******************************

function handleCommand (in_params, in_serviceConfig) {
    let command = in_params.length ? in_params.shift() : '';
    switch(command)
    {
        case '':
        case 'folder':
            editServiceFolder(in_serviceConfig);
            break;
        case 'config':
            editServiceConfigFile(in_serviceConfig);
            break;
        default:
            return false;
    }
    return true;
}

// ******************************

function getCommands () {
    return [
        { params: ['', 'folder'], description: 'Open the service folder in your editor' },
        { params: ['config'], description: 'Open the service config file in your editor' },
    ];
}

// ******************************

function editServiceFolder () {
    let serviceFolder = env.getServiceFolder();
    if (!serviceFolder) {
        cprint.yellow("No service folder set");
        return;
    }

    edit.folder(serviceFolder);
}

// ******************************

function editServiceConfigFile () {
    let serviceConfigFile = env.getServiceConfigFile();
    if (!serviceConfigFile) {
        cprint.yellow("No service config file set");
        return;
    }

    edit.file(serviceConfigFile);
}

// ******************************
// Exports:
// ******************************

module.exports['handleCommand'] = handleCommand;
module.exports['getCommands'] = getCommands;

module.exports['serviceFolder'] = editServiceFolder;
module.exports['serviceConfigFile'] = editServiceConfigFile;

// ******************************
