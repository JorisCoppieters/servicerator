'use strict'; // JS: ES6

// ******************************
// Requries:
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
        'docker/auth/*.crt',
        'docker/auth/*.key'
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
