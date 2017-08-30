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
        ignore: [
            'STRING'
        ],
        docker: {
            image: {
                language: 'STRING',
                log: 'BOOLEAN'
            }
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
        ignoreFiles.push(dockerRelativePath + 'python/**/*.pyc');
    }

    if (serviceConfig.docker.image.log) {
        ignoreFiles.push(dockerRelativePath + 'logs/*');
    }

    if (serviceConfig.model) {
        ignoreFiles.push(dockerRelativePath + 'model/*');
    }

    if (serviceConfig.auth) {
        ignoreFiles.push(dockerRelativePath + 'auth/service.crt');
        ignoreFiles.push(dockerRelativePath + 'auth/service.key');
    }

    ignoreFiles = ignoreFiles.concat(serviceConfig.ignore || []);

    return ignoreFiles.join('\n');
}

// ******************************
// Exports:
// ******************************

module.exports['getIgnoreFileContents'] = getIgnoreFileContents;

// ******************************
