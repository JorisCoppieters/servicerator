'use strict'; // JS: ES6

// ******************************
// Requires:
// ******************************

let path = require('path');
let cprint = require('color-print');

let bash = require('../utils/bash');
let docker = require('../utils/docker');
let fs = require('../utils/filesystem');
let git = require('../utils/git');
let hg = require('../utils/mercurial');
let init = require('../utils/init');
let nginx = require('../utils/nginx');
let service = require('../utils/service');

// ******************************
// Functions:
// ******************************

function gitSetupFolder (in_serviceConfig, in_overwrite) {
    let sourceFolder = setupFolder(in_serviceConfig, in_overwrite);
    if (!sourceFolder) {
        return;
    }
    let gitIgnoreFile = path.resolve(sourceFolder, '.gitignore');
    fs.writeFile(gitIgnoreFile, git.getIgnoreFileContents(in_serviceConfig), in_overwrite);
}

// ******************************

function hgSetupFolder (in_serviceConfig, in_overwrite) {
    let sourceFolder = setupFolder(in_serviceConfig, in_overwrite);
    if (!sourceFolder) {
        return;
    }
    let hgIgnoreFile = path.resolve(sourceFolder, '.hgignore');
    fs.writeFile(hgIgnoreFile, hg.getIgnoreFileContents(in_serviceConfig), in_overwrite);
}

// ******************************

function setupFolder (in_serviceConfig, in_overwrite) {
    let serviceConfig = service.accessConfig(in_serviceConfig, {
        auth: 'ANY',
        model: {
            source: 'STRING',
            type: 'STRING',
            version: 'STRING'
        },
        corpus: 'ANY',
        docker: {
            image: {
                nginx: {
                    servers: [
                        'ANY'
                    ],
                    daemon_off: 'BOOLEAN'
                },
                log: 'BOOLEAN',
                language: 'STRING'
            }
        },
        service: {
            filesystem: [
                {
                    on_setup: 'BOOLEAN',
                    path: 'PATH',
                    source: 'PATH',
                    destination: 'PATH',
                    path: 'PATH',
                    overwrite: 'BOOLEAN',
                    type: 'STRING',
                    contents: [
                        'STRING'
                    ]
                }

            ]
        },
        cwd: 'STRING'
    });

    let sourceFolder = serviceConfig.cwd || false;
    if (!sourceFolder) {
        cprint.yellow('Source folder not set');
        return;
    }

    cprint.cyan('Setting up "' + sourceFolder + '"...');

    let dockerFolder = docker.getFolder(sourceFolder)
    if (!dockerFolder || !fs.folderExists(dockerFolder)) {
        dockerFolder = sourceFolder;
    }

    let dockerFileContents = docker.getDockerfileContents(in_serviceConfig);
    if (dockerFileContents) {
        fs.setupFile('Dockerfile', path.resolve(dockerFolder, 'Dockerfile'), dockerFileContents, {
            overwrite: in_overwrite
        });
    }

    let dockerIgnoreFileContents = docker.getIgnoreDockerContents(in_serviceConfig);
    if (dockerIgnoreFileContents) {
        fs.setupFile('.dockerignore', path.resolve(dockerFolder, '.dockerignore'), dockerIgnoreFileContents, {
            overwrite: in_overwrite
        });
    }

    let nginxFile = path.resolve(dockerFolder, 'nginx.conf');
    if (serviceConfig.docker.image.nginx.servers.length) {
        let nginxFileContents = nginx.getFileContents(in_serviceConfig);
        fs.setupFile('nginx.conf', nginxFile, nginxFileContents, {
            overwrite: in_overwrite
        });
    }

    serviceConfig.service.filesystem
        .filter(f => f.on_setup)
        .forEach(f => {
            if (f.type === 'folder') {
                service.createFolder(in_serviceConfig, f);
            } else if (f.type === 'link_folder') {
                service.linkFolder(in_serviceConfig, f);

            } else if (f.type === 'file') {
                service.createFile(in_serviceConfig, f, {
                    overwrite: in_overwrite
                });
            } else if (f.type === 'link_file') {
                service.linkFile(in_serviceConfig, f, {
                    overwrite: in_overwrite
                });
            } else if (f.type === 'copy_file') {
                service.copyFile(in_serviceConfig, f, {
                    overwrite: in_overwrite
                });
            }
        });

    // Shift to global setup file
    if (serviceConfig.docker.image.log) {
        fs.setupFolder('docker log', path.resolve(dockerFolder, 'logs'));
    }

    // Shift to global setup file
    if (serviceConfig.docker.image.language === 'python') {
        fs.setupFolder('docker python', path.resolve(dockerFolder, 'python'));
    }

    // Shift to global setup file
    if (serviceConfig.auth) {
        fs.setupFolder('docker auth', path.resolve(dockerFolder, 'auth'));
    }

    // Shift to global setup file
    if (serviceConfig.model) {
        if (serviceConfig.model.type === 'bundled') {
            fs.setupFolder('docker bundled_model', path.resolve(dockerFolder, 'bundled_model'));
        } else if (serviceConfig.model.type === 'model_store') {
            fs.setupFolder('docker model', path.resolve(dockerFolder, 'model'));
        }
    }

    return sourceFolder;
}

// ******************************
// Plugin Functions:
// ******************************

function handleCommand (in_args, in_params, in_serviceConfig) {
    let command = in_params.length ? in_params.shift().toLowerCase() : '';
    let overwrite = in_args['overwrite'];
    switch(command)
    {
        case '':
            setupFolder(in_serviceConfig, overwrite);
            break;
        case 'git':
            gitSetupFolder(in_serviceConfig, overwrite);
            break;
        case 'hg':
        case 'mercurial':
            hgSetupFolder(in_serviceConfig, overwrite);
            break;
        default:
            return false;
    }
    return true;
}

// ******************************

function getBaseCommands () {
    return ['setup'];
}

// ******************************

function getCommands () {
    return [
        { params: [''], description: 'Setup this folder',
            options: [{param:'overwrite', description:'Overwrite any files that exist'}] },
        { params: ['git'], description: 'Setup this folder as a git repository',
            options: [{param:'overwrite', description:'Overwrite any files that exist'}] },
        { params: ['hg'], description: 'Setup this folder as a mercurial repository',
            options: [{param:'overwrite', description:'Overwrite any files that exist'}] },
    ];
}

// ******************************

function getTitle () {
    return 'Setup';
}

// ******************************
// Exports:
// ******************************

module.exports['handleCommand'] = handleCommand;
module.exports['getBaseCommands'] = getBaseCommands;
module.exports['getCommands'] = getCommands;
module.exports['getTitle'] = getTitle;

// ******************************
