'use strict'; // JS: ES6

// ******************************
// Requires:
// ******************************

let cprint = require('color-print');
let path = require('path');
let os = require('os');

let fs = require('./filesystem');
let service = require('./service');

// ******************************
// Constants:
// ******************************

let SERVICE_CONFIG_FILE_NAME = 'service.json';

// ******************************
// Functions:
// ******************************

function isWindows () {
    return os.platform() === 'win32';
}

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

    let serviceConfig;
    try {
        let serviceConfigContents = fs.readFile(serviceConfigFile);
        if (!serviceConfigContents.trim()) {
            return false;
        }
        serviceConfig = JSON.parse(serviceConfigContents);
    } catch (e) {
        cprint.red('Failed to parse "' + serviceConfigFile + '":\n  ' + e);
        return false;
    }
    serviceConfig.cwd = path.dirname(serviceConfigFile);

    service.checkConfigSchema(serviceConfig);

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

function getStoredPassword (in_application, in_username) {
    if (!in_application || !in_username) {
        return false;
    }

    let envKey;
    let envVal;

    envKey = in_application.toUpperCase() + '_' + in_username.toUpperCase() + '_PASSWORD';
    envVal = process.env[envKey] || false;
    if (envVal) {
        return envVal;
    }
}

// ******************************

function getStoredSecretKey (in_application, in_access_key) {
    if (!in_application) {
        return false;
    }

    let keyName = (in_access_key) ?  '_' + in_access_key.toUpperCase() : '';

    let envKey;
    let envVal;

    envKey = in_application.toUpperCase() + keyName + '_SECRET_KEY';
    envVal = process.env[envKey] || false;
    if (envVal) {
        return envVal;
    }
}

// ******************************

function getPlugins () {
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

function getUserHome() {
  return process.env[(process.platform == 'win32') ? 'HOME' : 'HOME'];
}

// ******************************

function getShellHome() {
  return process.env['HOME'];
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
module.exports['getServiceFolder'] = getServiceFolder;
module.exports['getServiceConfigFile'] = getServiceConfigFile;
module.exports['getServiceConfig'] = getServiceConfig;
module.exports['getStoredPassword'] = getStoredPassword;
module.exports['getStoredSecretKey'] = getStoredSecretKey;
module.exports['getPlugins'] = getPlugins;
module.exports['getUserHome'] = getUserHome;
module.exports['getShellHome'] = getShellHome;
module.exports['getTemp'] = getTemp;

// ******************************
