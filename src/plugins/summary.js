'use strict'; // JS: ES6

// ******************************
// Requries:
// ******************************

let cprint = require('color-print');
let print = require('../utils/print');

// ******************************
// Functions:
// ******************************

function handleCommand (in_args, in_params, in_serviceConfig) {
    let command = in_params.length ? in_params.shift() : '';
    switch(command)
    {
        case '':
            printServiceSummary(in_serviceConfig);
            break;
        default:
            return false;
    }
    return true;
}

// ******************************

function getCommands () {
    return [
        { params: [''], description: 'Print single line summary of service' },
    ];
}

// ******************************

function printServiceSummary (in_serviceConfig) {
    let serviceConfig = in_serviceConfig;
    let serviceConfigDocker = serviceConfig.docker || {};
    let serviceConfigDockerImage = serviceConfigDocker.image || {};
    let serviceConfigDockerContainer = serviceConfigDocker.container || {};
    let serviceConfigService = serviceConfig.service || {};

    let output = '';
    if (serviceConfigService.name) {
        if (output) { output += ' '; }
        output += cprint.toCyan('[service:' + serviceConfigService.name + ']');
    }

    if (serviceConfigDockerImage.name) {
        if (output) { output += ' '; }
        output += cprint.toCyan('[docker_image:' + serviceConfigDockerImage.name + ']');
    }

    print.out(output);
}

// ******************************
// Exports:
// ******************************

module.exports['handleCommand'] = handleCommand;
module.exports['getCommands'] = getCommands;

module.exports['serviceSummary'] = printServiceSummary;

// ******************************
