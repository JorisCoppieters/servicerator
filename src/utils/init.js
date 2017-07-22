'use strict'; // JS: ES6

// ******************************
// Requries:
// ******************************

let cprint = require('color-print');
let path = require('path');

let env = require('./env');
let edit = require('./edit');
let service = require('./service');
let fs = require('./filesystem');

// ******************************
// Functions:
// ******************************

function initFolder (in_folderName, in_overwrite) {
    if (in_folderName.match(/\.\.\/?/)) {
        cprint.yellow('Invalid path: ' + in_folderName);
        return false;
    }

    let sourceFolder = fs.cwd();
    if (in_folderName !== '.') {
        sourceFolder = fs.createFolder(in_folderName);
    }

    let serviceConfig;
    let serviceConfigFile = path.resolve(sourceFolder, env.SERVICE_CONFIG_FILE_NAME);

    if (fs.fileExists(serviceConfigFile) && !in_overwrite) {
        serviceConfig = JSON.parse(fs.readFile(serviceConfigFile));
    } else {
        if (in_folderName === '.') {
            cprint.cyan('Initialising folder...');
        } else {
            cprint.cyan('Initialising "' + in_folderName + '"...');
        }

        serviceConfig = service.getConfig(sourceFolder);
        fs.writeFile(serviceConfigFile, JSON.stringify(serviceConfig, null, 4), in_overwrite);
    }

    serviceConfig.cwd = sourceFolder;

    edit.file(serviceConfigFile);

    return serviceConfig;
}

// ******************************

function saveServiceConfig (in_serviceConfig) {
    let serviceConfig = in_serviceConfig || {};
    let sourceFolder = serviceConfig.cwd;
    if (!sourceFolder) {
        cprint.yellow('Invalid source folder: ' + sourceFolder);
        return false;
    }

    cprint.cyan('Saving service config...');
    let serviceConfigFile = path.resolve(sourceFolder, env.SERVICE_CONFIG_FILE_NAME);
    fs.writeFile(serviceConfigFile, JSON.stringify(serviceConfig, null, 4), true);
}

// ******************************
// Exports:
// ******************************

module.exports['folder'] = initFolder;
module.exports['saveServiceConfig'] = saveServiceConfig;

// ******************************
