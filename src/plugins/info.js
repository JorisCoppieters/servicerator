'use strict'; // JS: ES5

// ******************************
// Requries:
// ******************************

var cprint = require('color-print');
var print = require('../utils/print');

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
    print.keyVal('Service Name', serviceConfigService.name || '(Not Set)');
    cprint.magenta('----');
    print.keyVal('Docker Username', dockerUsername);
    print.keyVal('Docker Password', serviceConfigDocker.password ? '*******' : '(Not Set)');
    print.keyVal('Docker Image Name', dockerImageName || '(Not Set)');
    print.keyVal('Docker Image Path', dockerImagePath);
    (serviceConfigDockerImage.tags || []).forEach((t) => {
        print.keyVal('Docker Image Tag', dockerImagePath + ':' + t);
    });
    cprint.magenta('----');
}

// ******************************

function printServiceSummary (in_serviceConfig) {
    let serviceConfig = in_serviceConfig;
    let serviceConfigDocker = serviceConfig.docker || {};
    let serviceConfigDockerImage = serviceConfigDocker.image || {};
    let serviceConfigDockerContainer = serviceConfigDocker.container || {};
    let serviceConfigService = serviceConfig.service || {};

    let output = '';
    if (serviceConfigService.name) {
        if (output) { output += ' '; }
        output += cprint.toCyan('[service:' + serviceConfigService.name + ']');
    }

    if (serviceConfigDockerImage.name) {
        if (output) { output += ' '; }
        output += cprint.toCyan('[docker_image:' + serviceConfigDockerImage.name + ']');
    }

    print.out(output);
}

// ******************************
// Exports:
// ******************************

module.exports['serviceSummary'] = printServiceSummary;
module.exports['serviceInfo'] = printServiceInfo;

// ******************************
