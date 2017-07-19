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
        'docker/*/.aws_cache/*',
        'docker/*/auth/*.crt',
        'docker/*/auth/*.key'
    ];

    if (serviceConfigDockerImage.env === 'node') {
        ignoreFiles.push('docker/*/node/node_modules/*');
    }

    if (serviceConfigDockerImage.log) {
        ignoreFiles.push('docker/*/logs/*');
    }

    if (serviceConfig.model) {
        ignoreFiles.push('docker/*/model/*');
    }

    if (serviceConfigDockerBuild.env === 'bash') {
        ignoreFiles.push('docker/*/setup-aws-infrastructure.sh');
        ignoreFiles.push('docker/*/create-docker-image.sh');
    }

    return ignoreFiles.join('\n');
}

// ******************************
// Exports:
// ******************************

module.exports['getIgnoreFileContents'] = getIgnoreFileContents;

// ******************************
