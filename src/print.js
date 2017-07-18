'use strict'; // JS: ES5

// ******************************
// Requries:
// ******************************

var cprint = require('color-print');

// ******************************
// Functions:
// ******************************

function printServiceInfo (in_serviceConfig) {
    let serviceConfig = in_serviceConfig;
    let serviceConfigDocker = serviceConfig.docker || {};
    let serviceConfigDockerImage = serviceConfigDocker.image || {};
    let serviceConfigDockerContainer = serviceConfigDocker.container || {};
    let serviceConfigService = serviceConfig.service || {};

    let dockerUsername = serviceConfigDocker.username || 'docker_username';
    let dockerImageName = serviceConfigDockerImage.name || 'docker_image';
    let dockerImagePath = dockerUsername + '/' + (dockerImageName || '');

    cprint.magenta('-- Service Info --');
    _printKeyVal('Service Name', serviceConfigService.name || '(Not Set)');
    cprint.magenta('----');
    _printKeyVal('Docker Username', dockerUsername);
    _printKeyVal('Docker Password', serviceConfigDocker.password ? '*******' : '(Not Set)');
    _printKeyVal('Docker Image Name', dockerImageName || '(Not Set)');
    _printKeyVal('Docker Image Path', dockerImagePath);
    (serviceConfigDockerImage.tags || []).forEach((t) => {
        _printKeyVal('Docker Image Tag', dockerImagePath + ':' + t);
    });
    cprint.magenta('----');
}

// ******************************

function clearLine () {
    out('\r' + ' '.repeat(100) + '\r');
}

// ******************************

function out (in_string) {
    let string = in_string;
    if (typeof(string) !== 'string') {
        string = string.toString();
    }
    process.stdout.write(string);
}

// ******************************

function _printKeyVal (in_key, in_val) {
    console.log(cprint.toGreen(in_key) + ' ' + cprint.toWhite('=>') + ' ' + cprint.toCyan(in_val));
}

// ******************************
// Exports:
// ******************************

module.exports['clearLine'] = clearLine;
module.exports['out'] = out;
module.exports['serviceInfo'] = printServiceInfo;

// ******************************
