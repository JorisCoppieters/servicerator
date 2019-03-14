'use strict'; // JS: ES6

// ******************************
// Requires:
// ******************************

let cprint = require('color-print');

let aws = require('../utils/aws');
let docker = require('../utils/docker');
let env = require('../utils/env');
let print = require('../utils/print');
let service = require('../utils/service');

// ******************************
// Functions:
// ******************************

function printServiceInfo (in_serviceConfig) {
    let serviceConfig = service.accessConfig(in_serviceConfig, {
        docker: {
            username: 'STRING',
            image: {
                name: 'STRING',
                version: 'STRING'
            }
        },
        service: {
            name: 'STRING'
        },
        cwd: 'STRING'
    });

    let sourceFolder = serviceConfig.cwd || false;

    let serviceConfigFile = env.getServiceConfigFile();

    let serviceName = serviceConfig.service.name || false;
    let dockerImageName = aws.getDockerImageName(in_serviceConfig);
    let dockerUsername = serviceConfig.docker.username || false;
    let dockerImageVersion = serviceConfig.docker.image.version || false;
    let dockerImageTags = docker.getImageTags(in_serviceConfig);
    let dockerfile = docker.getDockerfile(sourceFolder);

    let dockerImagePath = false;
    if (dockerUsername && dockerImageName) {
        dockerImagePath = dockerUsername + '/' + dockerImageName;
    }

    cprint.magenta('-- Service Info --');
    print.keyVal('Service Name', serviceName || '(Not Set)');
    print.keyVal('Docker File', dockerfile || '(Not Set)');
    print.keyVal('Docker Image Name', dockerImageName || '(Not Set)');
    print.keyVal('Docker Image Version', dockerImageVersion || '(Not Set)');
    if (dockerImagePath) {
        dockerImageTags.slice(0,1).forEach((t) => {
            print.keyVal('Docker Image Tag', dockerImagePath + ':' + t);
        });
    }
    print.keyVal('Config File', serviceConfigFile || '(Not Set)');
    print.keyVal('Source Folder', sourceFolder || '(Not Set)');
    cprint.magenta('----');
}

// ******************************
// Plugin Functions:
// ******************************

function handleCommand (in_args, in_params, in_serviceConfig) {
    let command = in_params.length ? in_params.shift().toLowerCase() : '';
    switch(command)
    {
    case '':
        printServiceInfo(in_serviceConfig);
        break;
    default:
        return false;
    }
    return true;
}

// ******************************

function getBaseCommands () {
    return ['info', 'service', 'details'];
}

// ******************************

function getCommands () {
    return [
        { params: [''], description: 'Print out service information' },
    ];
}

// ******************************

function getTitle () {
    return 'Info';
}

// ******************************
// Exports:
// ******************************

module.exports['handleCommand'] = handleCommand;
module.exports['getBaseCommands'] = getBaseCommands;
module.exports['getCommands'] = getCommands;
module.exports['getTitle'] = getTitle;

// ******************************
