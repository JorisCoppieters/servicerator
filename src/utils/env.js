'use strict'; // JS: ES6

// ******************************
// Requires:
// ******************************

let cprint = require('color-print');

let fs = require('./filesystem');
let service = require('./service');

// ******************************
// Constants:
// ******************************

let SERVICE_CONFIG_FILE_NAME = 'service.json';

// ******************************
// Functions:
// ******************************

function isLinux () {
    let os = require('os');
    return os.platform() === 'linux';
}

// ******************************

function isWindows () {
    let os = require('os');
    return os.platform() === 'win32';
}

// ******************************

function getServiceFolder () {
    let path = require('path');

    let serviceConfigFile = getServiceConfigFile();
    if (!serviceConfigFile) {
        return false;
    }

    let serviceFolder = path.dirname(serviceConfigFile);
    return serviceFolder;
}

// ******************************

function getServiceConfigFile (in_sourceFolder) {
    let path = require('path');

    let serviceConfigFile;

    if (in_sourceFolder) {
        serviceConfigFile = path.resolve(in_sourceFolder, SERVICE_CONFIG_FILE_NAME);
        if (!fs.fileExists(serviceConfigFile)) {
            return false;
        }

        return serviceConfigFile;
    }

    let currentDirectory = './';

    let directory = path.resolve(process.cwd(), currentDirectory);
    let oldDirectory = directory;

    serviceConfigFile = path.resolve(directory, SERVICE_CONFIG_FILE_NAME);

    let maxUpwardsIteration = 100;
    let loopCount = 0;

    while (true) {
        if (fs.fileExists(serviceConfigFile)) {
            break;
        }

        let oldDirectory = directory;
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

    if (!fs.fileExists(serviceConfigFile)) {
        return false;
    }

    return serviceConfigFile;
}

// ******************************

function getStoredValue (in_key) {
    if (!in_key) {
        return false;
    }

    let envKey = in_key.toUpperCase();
    return process.env[envKey] || false;
}

// ******************************

function getStoredPassword (in_application, in_username) {
    if (!in_application || !in_username) {
        return false;
    }

    let envKey = in_application.toUpperCase() + '_' + in_username.toUpperCase() + '_PASSWORD';
    return process.env[envKey] || false;
}

// ******************************

function getStoredSecretKey (in_application, in_access_key) {
    if (!in_application) {
        return false;
    }

    let keyName = (in_access_key) ?  '_' + in_access_key.toUpperCase() : '';

    let envKey = in_application.toUpperCase() + keyName + '_SECRET_KEY';
    return process.env[envKey] || false;
}

// ******************************

function getPlugins () {
    let path = require('path');

    let plugins = [];
    let pluginsFolder = path.resolve(__dirname + '/../plugins');
    let files = fs.files(pluginsFolder);
    files.forEach(f => {
        let pluginFile = path.resolve(pluginsFolder, f);
        let plugin = require(pluginFile);

        if (plugin.onOpen || plugin.onClose) {
            plugins.push(plugin);
            return;
        }

        if (!plugin.getTitle || !plugin.getBaseCommands || !plugin.getCommands || !plugin.handleCommand) {
            cprint.yellow('Invalid plugin: ' + pluginFile);
            return;
        }
        plugins.push(plugin);
    });

    return plugins;
}

// ******************************

function getUserExplorerHome() {
    let home = process.env['USERPROFILE'];
    if (!home && process.platform === 'linux') {
        home = process.env['HOME'];
    }
    return home;
}

// ******************************

function getUserHome() {
    let home = process.env['HOME'];
    if (!home && process.platform === 'win32') {
        home = process.env['USERPROFILE'];
    }
    return home;
}

// ******************************

function getShellHome() {
    let home = process.env['HOME'];
    if (!home && process.platform === 'win32') {
        home = process.env['USERPROFILE'];
    }
    return home;
}

// ******************************

function getTemp() {
    return process.env['TEMP'];
}

// ******************************
// Exports:
// ******************************

module.exports['SERVICE_CONFIG_FILE_NAME'] = SERVICE_CONFIG_FILE_NAME;
module.exports['isWindows'] = isWindows;
module.exports['isLinux'] = isLinux;
module.exports['getServiceFolder'] = getServiceFolder;
module.exports['getServiceConfigFile'] = getServiceConfigFile;
module.exports['getStoredPassword'] = getStoredPassword;
module.exports['getStoredSecretKey'] = getStoredSecretKey;
module.exports['getStoredValue'] = getStoredValue;
module.exports['getPlugins'] = getPlugins;
module.exports['getUserExplorerHome'] = getUserExplorerHome;
module.exports['getUserHome'] = getUserHome;
module.exports['getShellHome'] = getShellHome;
module.exports['getTemp'] = getTemp;

// ******************************
