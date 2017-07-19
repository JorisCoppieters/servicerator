'use strict'; // JS: ES6

// ******************************
// Requries:
// ******************************

let cprint = require('color-print');
let path = require('path');

let fs = require('./filesystem');

// ******************************
// Constants:
// ******************************

let SERVICE_CONFIG_FILE_NAME = 'service.json';

// ******************************
// Functions:
// ******************************

function getServiceFolder () {
    let serviceConfigFile = getServiceConfigFile();
    if (!serviceConfigFile) {
        return false;
    }

    let serviceFolder = path.dirname(serviceConfigFile);
    return serviceFolder;
}

// ******************************

function getServiceConfig () {
    let serviceConfigFile = getServiceConfigFile();
    if (!serviceConfigFile) {
        return false;
    }

    let serviceConfig = JSON.parse(fs.readFile(serviceConfigFile));
    serviceConfig.cwd = path.dirname(serviceConfigFile);
    return serviceConfig;
}

// ******************************

function getServiceConfigFile () {
    let currentDirectory = './';

    var directory = path.resolve(process.cwd(), currentDirectory);
    var oldDirectory = directory;
    var serviceConfigFile = path.resolve(directory, SERVICE_CONFIG_FILE_NAME);

    var maxUpwardsIteration = 100;
    var loopCount = 0;

    while (true) {
        if (fs.fileExists(serviceConfigFile)) {
            break;
        }

        var oldDirectory = directory;
        directory = path.dirname(directory);
        if (directory === oldDirectory) {
            break;
        }

        if (loopCount++ > maxUpwardsIteration) {
            cprint.yellow('Too many loop iterations! Invalid top directory: ' + directory);
            break;
        }

        serviceConfigFile = path.resolve(directory, SERVICE_CONFIG_FILE_NAME);
    }

    if (! fs.fileExists(serviceConfigFile)) {
        return false;
    }

    return serviceConfigFile;
}

// ******************************
// Exports:
// ******************************

module.exports['SERVICE_CONFIG_FILE_NAME'] = SERVICE_CONFIG_FILE_NAME;
module.exports['getServiceFolder'] = getServiceFolder;
module.exports['getServiceConfigFile'] = getServiceConfigFile;
module.exports['getServiceConfig'] = getServiceConfig;

// ******************************
