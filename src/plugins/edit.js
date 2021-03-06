'use strict'; // JS: ES6

// ******************************
// Requires:
// ******************************

let docker = require('../utils/docker');
let edit = require('../utils/edit');
let env = require('../utils/env');
let service = require('../utils/service');

// ******************************
// Functions:
// ******************************

function editServiceConfigFile () {
    let serviceConfigFile = env.getServiceConfigFile();
    if (!serviceConfigFile) {
        service.initFolder('.');
        serviceConfigFile = env.getServiceConfigFile();
        if (!serviceConfigFile) {
            throw new Error('No service config file set');
        }
    }

    edit.file(serviceConfigFile);
}

// ******************************

function editServiceDockerfile (in_serviceConfig) {
    let serviceConfig = service.accessConfig(in_serviceConfig, {
        cwd: 'STRING'
    });

    let sourceFolder = serviceConfig.cwd || false;
    if (!sourceFolder) {
        throw new Error('Source folder not set');
    }

    let serviceDockerfile = docker.getDockerfile(sourceFolder);
    if (!serviceDockerfile) {
        throw new Error('Service Dockerfile not set');
    }

    edit.file(serviceDockerfile);
}

// ******************************

function editServiceFolder (in_serviceConfig) {
    let serviceConfig = service.accessConfig(in_serviceConfig, {
        cwd: 'STRING'
    });

    let sourceFolder = serviceConfig.cwd || false;
    if (!sourceFolder) {
        throw new Error('Source folder not set');
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
