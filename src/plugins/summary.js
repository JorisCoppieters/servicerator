'use strict'; // JS: ES6

// ******************************
// Requires:
// ******************************

let cprint = require('color-print');

let docker = require('../utils/docker');
let print = require('../utils/print');
let service = require('../utils/service');

// ******************************
// Functions:
// ******************************

function printServiceSummary (in_serviceConfig) {
    let serviceConfig = service.accessConfig(in_serviceConfig, {
        docker: {
            image: {
                name: 'STRING'
            }
        },
        service: {
            name: 'STRING'
        }
    });

    let output = '';

    if (serviceConfig.service.name) {
        if (output) { output += ' '; }
        output += cprint.toCyan('[service - ' + serviceConfig.service.name + ']');
    }

    if (serviceConfig.docker.image.name) {
        if (output) { output += ' '; }

        let dockerImageTags = docker.getImageTags(in_serviceConfig);
        let tag = dockerImageTags[0];

        output += cprint.toLightBlue('[image - ' + serviceConfig.docker.image.name + ':' + tag + ']');
    }

    output = cprint.toMagenta('>> ') + output;

    print.out(output);
}

// ******************************
// Plugin Functions:
// ******************************

function handleCommand (in_args, in_params, in_serviceConfig) {
    let command = in_params.length ? in_params.shift().toLowerCase() : '';
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
