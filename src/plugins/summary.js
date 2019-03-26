'use strict'; // JS: ES6

// ******************************
// Requires:
// ******************************

let cprint = require('color-print');

let aws = require('../utils/aws');
let env = require('../utils/env');
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
        },
        model: {
            version: 'STRING'
        }
    });

    let output = '';
    if (env.isDevelopment()) {
        output = cprint.toMagenta('>>') + ' ' + cprint.toYellow('[Dev]');
    } else {
        output = cprint.toMagenta('>>');
    }

    if (serviceConfig.service.name) {
        if (output) { output += ' '; }
        output += cprint.toCyan('[service - ' + serviceConfig.service.name + ']');
    }

    let dockerImageName = aws.getDockerImageName(in_serviceConfig);
    if (dockerImageName) {
        if (output) { output += ' '; }

        let dockerImageTags = docker.getImageTags(in_serviceConfig);
        let tag = dockerImageTags[0];

        output += cprint.toLightBlue('[image - ' + dockerImageName + ':' + tag + ']');
    }

    if (serviceConfig.model.version) {
        if (output) { output += ' '; }
        output += cprint.toLightMagenta('[model - ' + serviceConfig.model.version + ']');
    }

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
