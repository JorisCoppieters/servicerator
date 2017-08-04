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

    let serviceConfig = loadServiceConfig(sourceFolder);
    if (!serviceConfig) {
        if (in_folderName === '.') {
            cprint.cyan('Initialising folder...');
        } else {
            cprint.cyan('Initialising "' + in_folderName + '"...');
        }

        serviceConfig = service.getConfig(sourceFolder);
        serviceConfig.cwd = sourceFolder;

        if (serviceConfig) {
            fs.writeFile(serviceConfigFile, JSON.stringify(serviceConfig, _serviceConfigReplacer, 4), true);
        }
    }

    if (!serviceConfig) {
        cprint.yellow('Failed to create service config');
        return;
    }

    edit.file(serviceConfigFile);

    return serviceConfig;
}

// ******************************

function loadServiceConfig (in_sourceFolder) {
    let serviceConfig = false;
    let serviceConfigFile = path.resolve(in_sourceFolder, env.SERVICE_CONFIG_FILE_NAME);

    if (fs.fileExists(serviceConfigFile)) {
        let serviceConfigContents = fs.readFile(serviceConfigFile);
        if (serviceConfigContents.trim()) {
            serviceConfig = JSON.parse(serviceConfigContents);
            serviceConfig.cwd = in_sourceFolder;
        }
    }

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

function updateServiceConfig (in_serviceConfig, in_newServiceConfig) {
    let serviceConfig = in_serviceConfig || {};
    let sourceFolder = serviceConfig.cwd;

    let updatedServiceConfig;

    let savedServiceConfig = loadServiceConfig(sourceFolder);
    if (savedServiceConfig) {
        updatedServiceConfig = service.copyConfig(in_newServiceConfig, savedServiceConfig);
        saveServiceConfig(updatedServiceConfig);
        return updatedServiceConfig;
    }

    updatedServiceConfig = service.copyConfig(in_newServiceConfig, serviceConfig);
    return serviceConfig;
}

// ******************************

function removeServiceConfig (in_serviceConfig, in_removeServiceConfig) {
    let serviceConfig = in_serviceConfig || {};
    let sourceFolder = serviceConfig.cwd;

    let updatedServiceConfig;

    let savedServiceConfig = loadServiceConfig(sourceFolder);
    if (savedServiceConfig) {
        updatedServiceConfig = service.removeConfig(in_removeServiceConfig, savedServiceConfig);
        saveServiceConfig(updatedServiceConfig);
        return updatedServiceConfig;
    }

    updatedServiceConfig = service.removeConfig(in_removeServiceConfig, serviceConfig);
    return serviceConfig;
}

// ******************************
// Helper Functions:
// ******************************


// ******************************

function _serviceConfigReplacer (in_key, in_val) {
    if (in_key === 'cwd') {
        return undefined;
    }
    if (in_key === 'secret_key') {
        return undefined;
    }
    if (in_key === 'password') {
        return undefined;
    }
    return in_val;
}
// ******************************
// Exports:
// ******************************

module.exports['folder'] = initFolder;
module.exports['saveServiceConfig'] = saveServiceConfig;
module.exports['updateServiceConfig'] = updateServiceConfig;
module.exports['removeServiceConfig'] = removeServiceConfig;

// ******************************
