'use strict'; // JS: ES6

// ******************************
// Requires:
// ******************************

let cprint = require('color-print');

let edit = require('../utils/edit');
let docker = require('../utils/docker');
let env = require('../utils/env');
let init = require('../utils/init');

// ******************************
// Functions:
// ******************************

function editServiceConfigFile () {
    let serviceConfigFile = env.getServiceConfigFile();
    if (!serviceConfigFile) {
        init.folder('.')
        serviceConfigFile = env.getServiceConfigFile();
        if (!serviceConfigFile) {
            cprint.yellow("No service config file set");
            return;
        }
    }

    edit.file(serviceConfigFile);
}

// ******************************

function editServiceDockerfile (in_serviceConfig) {
    let serviceConfig = in_serviceConfig || {};
    let sourceFolder = serviceConfig.cwd || false;
    if (!sourceFolder) {
        cprint.yellow("Source folder not set");
        return;
    }

    let serviceDockerfile = docker.getDockerfile(sourceFolder);
    if (!serviceDockerfile) {
        cprint.yellow("Service Dockerfile not set");
        return;
    }

    edit.file(serviceDockerfile);
}

// ******************************

function editServiceFolder (in_serviceConfig) {
    let serviceConfig = in_serviceConfig || {};
    let sourceFolder = serviceConfig.cwd || false;
    if (!sourceFolder) {
        cprint.yellow("Source folder not set");
        return;
    }

    edit.folder(sourceFolder);
}

// ******************************
// Plugin Functions:
// ******************************

function handleCommand (in_args, in_params, in_serviceConfig) {
    let command = in_params.length ? in_params.shift().toLowerCase().toLowerCase() : '';
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
    return ['edit', 'configure', 'config'];
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
