'use strict'; // JS: ES6

// ******************************
// Requries:
// ******************************

let path = require('path');
let cprint = require('color-print');

let init = require('../utils/init');
let nginx = require('../utils/nginx');
let bash = require('../utils/bash');
let docker = require('../utils/docker');
let git = require('../utils/git');
let hg = require('../utils/mercurial');
let fs = require('../utils/filesystem');

// ******************************
// Functions:
// ******************************

function handleCommand (in_args, in_params, in_serviceConfig) {
    let command = in_params.length ? in_params.shift() : '';
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
    let serviceConfig = in_serviceConfig || {};
    let sourceFolder = serviceConfig.cwd || false;
    if (!sourceFolder) {
        cprint.yellow('Source folder not set');
        return;
    }

    cprint.cyan('Setting up "' + sourceFolder + '"...');

    let serviceConfigModel = serviceConfig.model || {};
    let serviceConfigCorpus = serviceConfig.corpus || {};
    let serviceConfigDocker = serviceConfig.docker || {};
    let serviceConfigDockerImage = serviceConfigDocker.image || {};
    let serviceConfigDockerBuild = serviceConfigDocker.build || {};

    fs.createFolder(path.resolve(sourceFolder, 'docker'));

    let dockerImageName = serviceConfigDockerImage.name || 'unknown';
    let dockerImageFolder = path.resolve(sourceFolder, 'docker', dockerImageName);
    fs.createFolder(path.resolve(dockerImageFolder));

    let dockerFileContents = docker.getDockerFileContents(serviceConfig);
    if (dockerFileContents) {
        fs.writeFile(path.resolve(dockerImageFolder, 'Dockerfile'), dockerFileContents, in_overwrite);
    }

    let dockerIgnoreFileContents = docker.getIgnoreDockerContents(serviceConfig);
    if (dockerIgnoreFileContents) {
        fs.writeFile(path.resolve(dockerImageFolder, '.dockerignore'), dockerIgnoreFileContents, in_overwrite);
    }

    if (serviceConfigDockerImage.nginx) {
        let nginxFile = path.resolve(dockerImageFolder, 'nginx.conf');
        fs.writeFile(nginxFile, nginx.getFileContents(serviceConfig), in_overwrite);
    }

    if (serviceConfigDockerImage.log) {
        fs.createFolder(path.resolve(dockerImageFolder, 'logs'));
    }

    if (serviceConfigDockerImage.env === 'python') {
        fs.createFolder(path.resolve(dockerImageFolder, 'python'));
    }

    if (serviceConfigDockerBuild.env === 'bash') {
        let bashEnvFile = path.resolve(dockerImageFolder, '_env.sh');
        fs.writeFile(bashEnvFile, bash.getEnvContents(serviceConfig), in_overwrite);
    }

    if (serviceConfig.model) {
        fs.createFolder(path.resolve(dockerImageFolder, 'model'));
        fs.createFolder(path.resolve(sourceFolder, 'model'));

        if (serviceConfig.model.bundled_model) {
            fs.createFolder(path.resolve(dockerImageFolder, 'bundled_model'));
        }
    }

    if (serviceConfig.corpus) {
        fs.createFolder(path.resolve(sourceFolder, 'corpus'));
    }

    if (serviceConfig.downloads) {
        fs.createFolder(path.resolve(sourceFolder, 'downloads'));
    }

    return sourceFolder;
}

// ******************************
// Exports:
// ******************************

module.exports['handleCommand'] = handleCommand;
module.exports['getBaseCommands'] = getBaseCommands;
module.exports['getCommands'] = getCommands;
module.exports['getTitle'] = getTitle;

// ******************************
