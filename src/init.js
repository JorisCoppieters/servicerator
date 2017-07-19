'use strict'; // JS: ES5

// ******************************
// Requries:
// ******************************

var cprint = require('color-print');
var path = require('path');

var env = require('./utils/env');
var edit = require('./utils/edit');
var service = require('./utils/service');
var fs = require('./utils/filesystem');

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

    edit.serviceConfigFile(serviceConfig);

    return serviceConfig;
}

// ******************************
// Exports:
// ******************************

module.exports['folder'] = initFolder;

// ******************************
