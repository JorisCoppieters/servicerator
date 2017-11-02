'use strict'; // JS: ES6

// ******************************
// Requires:
// ******************************

let cprint = require('color-print');

let service = require('../utils/service');
let exec = require('../utils/exec');

// ******************************
// Functions:
// ******************************

function runService (in_serviceConfig) {
    let serviceConfig = service.accessConfig(in_serviceConfig, {
        service: {
            run: {
                cmd: 'STRING',
                cwd: 'STRING',
                args: [
                    'STRING'
                ]
            }
        },
        cwd: 'STRING'
    });

    let path = require('path');

    let cmd = serviceConfig.service.run.cmd;
    if (!cmd) {
        cprint.yellow('Run cmd not set');
        return;
    }

    let cwd = serviceConfig.service.run.cwd || '/';
    cwd = service.replaceConfigReferences(in_serviceConfig, cwd);
    cwd = path.resolve(cwd);

    let args = serviceConfig.service.run.args || [];
    args = args
        .map(a => service.replaceConfigReferences(in_serviceConfig, a));

    exec.cmd(cmd, args, {
        cwd: cwd
    });
}

// ******************************
// Plugin Functions:
// ******************************

function handleCommand (in_args, in_params, in_serviceConfig) {
    let command = in_params.length ? in_params.shift().toLowerCase() : '';
    switch(command)
    {
        case '':
            runService(in_serviceConfig);
            break;
        default:
            return false;
    }
    return true;
}

// ******************************

function getBaseCommands () {
    return ['run', 'go'];
}

// ******************************

function getCommands () {
    return [
        { params: [''], description: 'Run service' },
    ];
}

// ******************************

function getTitle () {
    return 'Run';
}

// ******************************
// Exports:
// ******************************

module.exports['handleCommand'] = handleCommand;
module.exports['getBaseCommands'] = getBaseCommands;
module.exports['getCommands'] = getCommands;
module.exports['getTitle'] = getTitle;

// ******************************
