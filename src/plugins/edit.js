'use strict'; // JS: ES6

// ******************************
// Requries:
// ******************************

let cprint = require('color-print');

let edit = require('../utils/edit');
let docker = require('../utils/docker');
let env = require('../utils/env');

// ******************************
// Functions:
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

function editServiceDockerfile (in_serviceConfig) {
    let serviceConfig = in_serviceConfig || {};
    let sourceFolder = serviceConfig.cwd || false;

    let serviceDockerfile = docker.getDockerfile(sourceFolder);
    if (!serviceDockerfile) {
        cprint.yellow("No service Dockerfile set");
        return;
    }

    edit.file(serviceDockerfile);
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
// Plugin Functions:
// ******************************

function handleCommand (in_args, in_params, in_serviceConfig) {
    let command = in_params.length ? in_params.shift() : '';
    switch(command)
    {
        case '':
        case 'config':
            editServiceConfigFile(in_serviceConfig);
            break;
        case 'docker':
        case 'dockerfile':
            editServiceDockerfile(in_serviceConfig);
            break;
        case 'folder':
            editServiceFolder(in_serviceConfig);
            break;
        default:
            return false;
    }
    return true;
}

// ******************************

function getBaseCommands () {
    return ['edit'];
}

// ******************************

function getCommands () {
    return [
        { params: ['', 'config'], description: 'Open the service config file in your editor' },
        { params: ['dockerfile', 'docker'], description: 'Open the Dockerfile in your editor' },
        { params: ['folder'], description: 'Open the service folder in your editor' },
    ];
}

// ******************************

function getTitle () {
    return 'Edit';
}

// ******************************
// Exports:
// ******************************

module.exports['handleCommand'] = handleCommand;
module.exports['getBaseCommands'] = getBaseCommands;
module.exports['getCommands'] = getCommands;
module.exports['getTitle'] = getTitle;

// ******************************