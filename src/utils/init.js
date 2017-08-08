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

        serviceConfig = service.getConfig(sourceFolder) || {};
        serviceConfig.cwd = sourceFolder;

        saveServiceConfig(serviceConfig);
    }

    if (!serviceConfig) {
        cprint.yellow('Failed to create service config');
        return;
    }

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

function hasServiceConfigFile (in_sourceFolder) {
    let serviceConfig = false;
    let serviceConfigFile = path.resolve(in_sourceFolder, env.SERVICE_CONFIG_FILE_NAME);

    if (fs.fileExists(serviceConfigFile)) {
        let serviceConfigContents = fs.readFile(serviceConfigFile);
        if (serviceConfigContents.trim()) {
            return true;
        }
    }

    return false;
}

// ******************************

function saveServiceConfig (in_serviceConfig) {
    let serviceConfig = service.accessConfig(in_serviceConfig, {
        cwd: 'STRING'
    });

    let sourceFolder = serviceConfig.cwd;
    if (!sourceFolder) {
        cprint.yellow('Invalid source folder: ' + sourceFolder);
        return false;
    }

    cprint.cyan('Saving service config...');
    let serviceConfigFile = path.resolve(sourceFolder, env.SERVICE_CONFIG_FILE_NAME);
    let serviceConfigContents = JSON.stringify(in_serviceConfig, _serviceConfigReplacer, 4);
    fs.writeFile(serviceConfigFile, serviceConfigContents, true);
}

// ******************************

function updateServiceConfig (in_serviceConfig, in_newServiceConfig) {
    let serviceConfig = service.accessConfig(in_serviceConfig, {
        cwd: 'STRING'
    });

    let sourceFolder = serviceConfig.cwd;
    if (!sourceFolder) {
        cprint.yellow('Invalid source folder: ' + sourceFolder);
        return false;
    }

    let savedServiceConfig = loadServiceConfig(sourceFolder);
    if (savedServiceConfig) {
        let updatedServiceConfig = service.copyConfig(in_newServiceConfig, savedServiceConfig);
        saveServiceConfig(updatedServiceConfig);
    }

    let updatedServiceConfig = service.copyConfig(in_newServiceConfig, in_serviceConfig);
    return updatedServiceConfig;
}

// ******************************

function removeServiceConfig (in_serviceConfig, in_removeServiceConfig) {
    let serviceConfig = service.accessConfig(in_serviceConfig, {
        cwd: 'STRING'
    });

    let sourceFolder = serviceConfig.cwd;
    if (!sourceFolder) {
        cprint.yellow('Invalid source folder: ' + sourceFolder);
        return false;
    }

    let savedServiceConfig = loadServiceConfig(sourceFolder);
    if (savedServiceConfig) {
        let updatedServiceConfig = service.removeConfig(in_removeServiceConfig, savedServiceConfig);
        saveServiceConfig(updatedServiceConfig);
    }

    let updatedServiceConfig = service.removeConfig(in_removeServiceConfig, in_serviceConfig);
    return updatedServiceConfig;
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
module.exports['hasServiceConfigFile'] = hasServiceConfigFile;
module.exports['saveServiceConfig'] = saveServiceConfig;
module.exports['updateServiceConfig'] = updateServiceConfig;
module.exports['removeServiceConfig'] = removeServiceConfig;

// ******************************
