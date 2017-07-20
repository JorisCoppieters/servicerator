'use strict'; // JS: ES6

// ******************************
// Requries:
// ******************************

let cprint = require('color-print');
let print = require('../utils/print');

// ******************************
// Functions:
// ******************************

function printServiceSummary (in_serviceConfig) {
    let serviceConfig = in_serviceConfig || {};
    let serviceConfigDocker = serviceConfig.docker || {};
    let serviceConfigDockerImage = serviceConfigDocker.image || {};
    let serviceConfigDockerContainer = serviceConfigDocker.container || {};
    let serviceConfigService = serviceConfig.service || {};

    let output = '';
    if (serviceConfigService.name) {
        if (output) { output += ' '; }
        output += cprint.toBackgroundDarkGrey(cprint.toWhite('S:' + serviceConfigService.name, true));
    }

    if (serviceConfigDockerImage.name) {
        if (output) { output += ' '; }

        let tag = 'latest';
        if (serviceConfigDockerImage.tags && serviceConfigDockerImage.tags.length) {
            tag = serviceConfigDockerImage.tags[0];
        }

        output += cprint.toBackgroundLightBlue(cprint.toWhite('DI:' + serviceConfigDockerImage.name + ':' + tag, true));
    }

    print.out(output);
}

// ******************************
// Plugin Functions:
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

function getBaseCommands () {
    return ['summary'];
}

// ******************************

function getCommands () {
    return [
        { params: [''], description: 'Print single line summary of service' },
    ];
}

// ******************************

function getTitle () {
    return 'Summary';
}

// ******************************
// Exports:
// ******************************

module.exports['handleCommand'] = handleCommand;
module.exports['getBaseCommands'] = getBaseCommands;
module.exports['getCommands'] = getCommands;
module.exports['getTitle'] = getTitle;

// ******************************
