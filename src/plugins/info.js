'use strict'; // JS: ES6

// ******************************
// Requries:
// ******************************

let cprint = require('color-print');
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

    let dockerUsername = serviceConfigDocker.username || 'docker_username';
    let dockerImageName = serviceConfigDockerImage.name || 'docker_image';
    let dockerImagePath = dockerUsername + '/' + (dockerImageName || '');

    cprint.magenta('-- Service Info --');
    print.keyVal('Service Name', serviceConfigService.name || '(Not Set)');
    cprint.magenta('----');
    print.keyVal('Docker Username', dockerUsername);
    print.keyVal('Docker Password', serviceConfigDocker.password ? '*******' : '(Not Set)');
    print.keyVal('Docker Image Name', dockerImageName || '(Not Set)');
    print.keyVal('Docker Image Path', dockerImagePath);
    (serviceConfigDockerImage.tags || []).forEach((t) => {
        print.keyVal('Docker Image Tag', dockerImagePath + ':' + t);
    });
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
