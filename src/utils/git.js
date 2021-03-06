'use strict'; // JS: ES6

// ******************************
// Requires:
// ******************************

let service = require('./service');
let docker = require('./docker');

// ******************************
// Functions:
// ******************************

function getIgnoreFileContents (in_serviceConfig) {
    let serviceConfig = service.accessConfig(in_serviceConfig, {
        auth: {},
        model: {},
        docker: {
            image: {
                log: 'BOOLEAN'
            }
        },
        version_control: {
            type: 'STRING',
            ignore: [
                'STRING'
            ]
        },
        cwd: 'STRING'
    });

    let path = require('path');

    let dockerFolder = docker.getFolder(serviceConfig.cwd) || 'docker';
    let dockerRelativePath = path.relative(serviceConfig.cwd, dockerFolder);
    dockerRelativePath = (dockerRelativePath ? dockerRelativePath + '/' : '');

    let ignoreFiles = [
        '.cache'
    ];

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

    ignoreFiles = ignoreFiles.concat(serviceConfig.version_control.ignore || []);

    return ignoreFiles.join('\n');
}

// ******************************
// Exports:
// ******************************

module.exports['getIgnoreFileContents'] = getIgnoreFileContents;

// ******************************
