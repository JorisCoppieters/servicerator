'use strict'; // JS: ES6

// ******************************
// Requires:
// ******************************

let path = require('path');

let service = require('./service');
let docker = require('./docker');

// ******************************
// Functions:
// ******************************

function getIgnoreFileContents (in_serviceConfig) {
    let serviceConfig = service.accessConfig(in_serviceConfig, {
        auth: 'ANY',
        model: 'ANY',
        docker: {
            image: {
                language: 'STRING',
                log: 'BOOLEAN'
            }
        },
        build: {
            language: 'STRING'
        },
        cwd: 'STRING'
    });

    let dockerFolder = docker.getFolder(serviceConfig.cwd) || 'docker';
    let dockerRelativePath = path.relative(serviceConfig.cwd, dockerFolder);
    dockerRelativePath = (dockerRelativePath ? dockerRelativePath + '/' : '');

    let ignoreFiles = [
        'syntax: glob',
        dockerRelativePath + '.cache'
    ];

    if (serviceConfig.docker.image.language === 'node') {
        ignoreFiles.push(dockerRelativePath + 'node/node_modules/*');
    }

    if (serviceConfig.docker.image.language === 'python') {
        ignoreFiles.push(dockerRelativePath + 'python/*.pyc');
    }

    if (serviceConfig.docker.image.log) {
        ignoreFiles.push(dockerRelativePath + 'logs/*');
    }

    if (serviceConfig.model) {
        ignoreFiles.push(dockerRelativePath + 'model/*');
    }

    if (serviceConfig.auth) {
        ignoreFiles.push(dockerRelativePath + 'auth/*.crt');
        ignoreFiles.push(dockerRelativePath + 'auth/*.key');
    }

    if (serviceConfig.build.language === 'bash') {
        ignoreFiles.push(dockerRelativePath + '.aws_cache/*');
        ignoreFiles.push(dockerRelativePath + 'setup-aws-infrastructure.sh');
        ignoreFiles.push(dockerRelativePath + 'create-docker-image.sh');
    }

    return ignoreFiles.join('\n');
}

// ******************************
// Exports:
// ******************************

module.exports['getIgnoreFileContents'] = getIgnoreFileContents;

// ******************************
