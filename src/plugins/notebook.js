'use strict'; // JS: ES6

// ******************************
// Requires:
// ******************************

let cprint = require('color-print');

let notebook = require('../utils/notebook');
let service = require('../utils/service');

// ******************************
// Functions:
// ******************************

function generatePythonFiles (in_serviceConfig) {
    let serviceConfig = service.accessConfig(in_serviceConfig, {
        cwd: 'STRING'
    });

    let sourceFolder = serviceConfig.cwd || false;

    let notebookFile = notebook.getFile(sourceFolder);
    if (notebookFile) {
        cprint.cyan('Creating python training file...');
        notebook.createTrainingFile(sourceFolder);

        cprint.cyan('Creating python cli file...');
        notebook.createCLIFile(sourceFolder);

        cprint.cyan('Creating python api file...');
        notebook.createAPIFile(sourceFolder);
    }
}

// ******************************
// Plugin Functions:
// ******************************

function handleCommand (in_args, in_params, in_serviceConfig) {
    let command = in_params.length ? in_params.shift().toLowerCase() : '';
    switch(command)
    {
    case '':
        generatePythonFiles(in_serviceConfig);
        break;
    default:
        return false;
    }
    return true;
}

// ******************************

function getBaseCommands () {
    return ['notebook', 'nb', 'jypter'];
}

// ******************************

function getCommands () {
    return [
        { params: [''], description: 'Generate service parts from a python notebook' },
    ];
}

// ******************************

function getTitle () {
    return 'Notebook';
}

// ******************************
// Exports:
// ******************************

module.exports['handleCommand'] = handleCommand;
module.exports['getBaseCommands'] = getBaseCommands;
module.exports['getCommands'] = getCommands;
module.exports['getTitle'] = getTitle;

// ******************************
