'use strict'; // JS: ES6

// ******************************
// Requires:
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

    let serviceConfig = false;
    let serviceConfigFile = path.resolve(sourceFolder, env.SERVICE_CONFIG_FILE_NAME);

    if (fs.fileExists(serviceConfigFile) && !in_overwrite) {
        let serviceConfigContents = fs.readFile(serviceConfigFile);
        if (serviceConfigContents.trim()) {
            serviceConfig = JSON.parse(serviceConfigContents);
        }
    }

    if (!serviceConfig) {
        if (in_folderName === '.') {
            cprint.cyan('Initialising folder...');
        } else {
            cprint.cyan('Initialising "' + in_folderName + '"...');
        }

        serviceConfig = service.getConfig(sourceFolder);
        if (serviceConfig) {
            fs.writeFile(serviceConfigFile, JSON.stringify(serviceConfig, _serviceConfigReplacer, 4), true);
        }
    }

    if (!serviceConfig) {
        cprint.yellow('Failed to create service config');
        return;
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
    fs.writeFile(serviceConfigFile, JSON.stringify(serviceConfig, _serviceConfigReplacer, 4), true);
}

// ******************************
// Helper Functions:
// ******************************


// ******************************

function _serviceConfigReplacer (in_key, in_val) {
    if (in_key === 'cwd') {
        return undefined;
    }
    return in_val;
}
// ******************************
// Exports:
// ******************************

module.exports['folder'] = initFolder;
module.exports['saveServiceConfig'] = saveServiceConfig;

// ******************************
