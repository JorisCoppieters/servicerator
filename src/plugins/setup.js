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
        model: 'ANY',
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
        dockerFolder = path.resolve(sourceFolder, 'docker');
        fs.createFolder(dockerFolder);
    }

    let dockerFileContents = docker.getDockerfileContents(in_serviceConfig);
    if (dockerFileContents) {
        fs.writeFile(path.resolve(dockerFolder, 'Dockerfile'), dockerFileContents, in_overwrite);
    }

    let dockerIgnoreFileContents = docker.getIgnoreDockerContents(in_serviceConfig);
    if (dockerIgnoreFileContents) {
        fs.writeFile(path.resolve(dockerFolder, '.dockerignore'), dockerIgnoreFileContents, in_overwrite);
    }

    if (serviceConfig.docker.image.nginx.servers.length) {
        let nginxFile = path.resolve(dockerFolder, 'nginx.conf');
        fs.writeFile(nginxFile, nginx.getFileContents(in_serviceConfig), in_overwrite);
    }

    if (serviceConfig.docker.image.log) {
        fs.createFolder(path.resolve(dockerFolder, 'logs'));
    }

    if (serviceConfig.docker.image.language === 'python') {
        fs.createFolder(path.resolve(dockerFolder, 'python'));
    }

    if (serviceConfig.auth) {
        fs.createFolder(path.resolve(dockerFolder, 'auth'));
    }

    if (serviceConfig.model) {
        fs.createFolder(path.resolve(dockerFolder, 'model'));
        fs.createFolder(path.resolve(sourceFolder, 'model'));

        if (serviceConfig.model.bundled_model) {
            fs.createFolder(path.resolve(dockerFolder, 'bundled_model'));
        }
    }

    if (serviceConfig.corpus) {
        fs.createFolder(path.resolve(sourceFolder, 'corpus'));
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
