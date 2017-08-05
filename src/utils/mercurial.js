'use strict'; // JS: ES6

// ******************************
// Requires:
// ******************************

// ******************************
// Functions:
// ******************************

function getIgnoreFileContents (in_serviceConfig) {
    let serviceConfig = in_serviceConfig || {};
    let serviceConfigDocker = serviceConfig.docker || {};
    let serviceConfigDockerImage = serviceConfigDocker.image || {};
    let serviceConfigDockerBuild = serviceConfigDocker.build || {};

    let ignoreFiles = [
        'syntax: glob',
        'docker/.aws_cache/*',
        '.cache'
    ];

    if (serviceConfigDockerImage.language === 'node') {
        ignoreFiles.push('docker/node/node_modules/*');
    }

    if (serviceConfigDockerImage.language === 'python') {
        ignoreFiles.push('docker/python/*.pyc');
    }

    if (serviceConfigDockerImage.log) {
        ignoreFiles.push('docker/logs/*');
    }

    if (serviceConfig.model) {
        ignoreFiles.push('docker/model/*');
    }

    if (serviceConfig.auth) {
        ignoreFiles.push('auth/*.crt');
        ignoreFiles.push('auth/*.key');
        ignoreFiles.push('docker/auth/*.crt');
        ignoreFiles.push('docker/auth/*.key');
    }

    if (serviceConfigDockerBuild.language === 'bash') {
        ignoreFiles.push('docker/setup-aws-infrastructure.sh');
        ignoreFiles.push('docker/create-docker-image.sh');
    }

    return ignoreFiles.join('\n');
}

// ******************************
// Exports:
// ******************************

module.exports['getIgnoreFileContents'] = getIgnoreFileContents;

// ******************************
