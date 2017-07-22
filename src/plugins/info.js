'use strict'; // JS: ES6

// ******************************
// Requries:
// ******************************

let cprint = require('color-print');

let docker = require('../utils/docker');
let print = require('../utils/print');

// ******************************
// Functions:
// ******************************

function printServiceInfo (in_serviceConfig) {
    let serviceConfig = in_serviceConfig || {};
    let serviceConfigDocker = serviceConfig.docker || {};
    let serviceConfigDockerImage = serviceConfigDocker.image || {};
    let serviceConfigDockerContainer = serviceConfigDocker.container || {};
    let serviceConfigService = serviceConfig.service || {};
    let sourceFolder = serviceConfig.cwd || false;

    let serviceName = serviceConfigService.name || false;
    let dockerUsername = serviceConfigDocker.username || false;
    let dockerImageName = serviceConfigDockerImage.name || false;
    let dockerImageVersion = serviceConfigDockerImage.version || false;
    let dockerImageLanguage = serviceConfigDockerImage.language || false;
    let dockerImageTags = docker.getImageTags(in_serviceConfig);

    let dockerImagePath = false;
    if (dockerUsername && dockerImageName) {
        dockerImagePath = dockerUsername + '/' + dockerImageName;
    }

    cprint.magenta('-- Service Info --');
    print.keyVal('Service Name', serviceName || '(Not Set)');
    print.keyVal('Docker Image Name', dockerImageName || '(Not Set)');
    print.keyVal('Docker Image Language', dockerImageLanguage || '(Not Set)');
    print.keyVal('Docker Image Version', dockerImageVersion || '(Not Set)');
    dockerImageTags.slice(0,1).forEach((t) => {
        print.keyVal('Docker Image Tag', dockerImagePath + ':' + t);
    });
    print.keyVal('Source Folder', sourceFolder || '(Not Set)');
    cprint.magenta('----');
}

// ******************************
// Plugin Functions:
// ******************************

function handleCommand (in_args, in_params, in_serviceConfig) {
    let command = in_params.length ? in_params.shift() : '';
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
