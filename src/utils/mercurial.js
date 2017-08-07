'use strict'; // JS: ES6

// ******************************
// Requires:
// ******************************

let service = require('./service');

// ******************************
// Functions:
// ******************************

function getIgnoreFileContents (in_serviceConfig) {
    let serviceConfig = service.accessConfig(in_serviceConfig, {
        auth: {
            certificate: 'STRING',
            disableAutoPopulate: 'BOOLEAN',
            key: 'STRING',
            rootCAKey: 'PATH',
            rootCACertificate: 'PATH',
            type: 'STRING'
        },
        model: {
            disableAutoPopulate: 'BOOLEAN',
            source: 'STRING',
            type: 'STRING',
            version: 'STRING'
        },
        docker: {
            image: {
                language: 'STRING',
                log: 'BOOLEAN'
            }
        },
        build: {
            language: 'STRING'
        }
    });

    let ignoreFiles = [
        'syntax: glob',
        'docker/.aws_cache/*',
        '.cache'
    ];

    if (serviceConfig.docker.image.language === 'node') {
        ignoreFiles.push('docker/node/node_modules/*');
    }

    if (serviceConfig.docker.image.language === 'python') {
        ignoreFiles.push('docker/python/*.pyc');
    }

    if (serviceConfig.docker.image.log) {
        ignoreFiles.push('docker/logs/*');
    }

    if (Object.keys(serviceConfig.model).length) {
        ignoreFiles.push('docker/model/*');
    }

    if (Object.keys(serviceConfig.auth).length) {
        ignoreFiles.push('auth/*.crt');
        ignoreFiles.push('auth/*.key');
        ignoreFiles.push('docker/auth/*.crt');
        ignoreFiles.push('docker/auth/*.key');
    }

    if (serviceConfig.build.language === 'bash') {
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
