'use strict'; // JS: ES5

// ******************************
// Requries:
// ******************************

var cprint = require('color-print');
var fs = require('fs');
var path = require('path');

var service = require('./service');
var u = require('./utils');

// ******************************
// Functions:
// ******************************

function initFolder (in_folderName, in_overwrite) {
    if (in_folderName.match(/\.\.\/?/)) {
        cprint.yellow('Invalid path: ' + in_folderName);
        return false;
    }

    let sourceFolder = u.cwd();
    if (in_folderName !== '.') {
        sourceFolder = u.createFolder(in_folderName);
    }

    let serviceConfig;
    let serviceConfigFile = path.resolve(sourceFolder, 'service.json');

    if (u.fileExists(serviceConfigFile) && !in_overwrite) {
        serviceConfig = JSON.parse(u.readFile(serviceConfigFile));
    } else {
        if (in_folderName === '.') {
            cprint.cyan('Initialising folder...');
        } else {
            cprint.cyan('Initialising "' + in_folderName + '"...');
        }

        serviceConfig = service.getConfig(sourceFolder);
        u.writeFile(serviceConfigFile, JSON.stringify(serviceConfig, null, 4), in_overwrite);
    }

    serviceConfig.cwd = sourceFolder;
    return serviceConfig;
}

// ******************************

function getConfig (in_folderName) {
    if (in_folderName.match(/\.\.\/?/)) {
        cprint.yellow('Invalid path: ' + in_folderName);
        return false;
    }

    let currentDirectory = in_folderName;
    if (!currentDirectory) {
        currentDirectory = './';
    }

    var directory = path.resolve(process.cwd(), currentDirectory);
    var oldDirectory = directory;
    var serviceConfigFile = path.resolve(directory, 'service.json');

    var maxUpwardsIteration = 100;
    var loopCount = 0;

    while (true) {
        if (fs.existsSync(serviceConfigFile)) {
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

        serviceConfigFile = path.resolve(directory, 'service.json');
    }

    if (! fs.existsSync(serviceConfigFile)) {
        return false;
    }

    let serviceConfig = JSON.parse(u.readFile(serviceConfigFile));
    serviceConfig.cwd = directory;
    return serviceConfig;
}


// ******************************
// Exports:
// ******************************

module.exports['folder'] = initFolder;
module.exports['getConfig'] = getConfig;

// ******************************
