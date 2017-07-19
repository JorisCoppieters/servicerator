'use strict'; // JS: ES5

// ******************************
// Requries:
// ******************************

var path = require('path');
var cprint = require('color-print');

var init = require('./init');

var nginx = require('./plugins/nginx');
var bash = require('./plugins/bash');
var docker = require('./plugins/docker');

var fs = require('./utils/filesystem');

// ******************************
// Functions:
// ******************************

function gitSetupFolder (in_serviceConfig, in_overwrite) {
    let sourceFolder = setupFolder(in_serviceConfig, in_overwrite);
    if (!sourceFolder) {
        return;
    }
    let gitIgnoreFile = path.resolve(sourceFolder, '.gitignore');
    fs.writeFile(gitIgnoreFile, g_IGNORE_FILES.join('\n'), in_overwrite);
}

// ******************************

function hgSetupFolder (in_serviceConfig, in_overwrite) {
    let sourceFolder = setupFolder(in_serviceConfig, in_overwrite);
    if (!sourceFolder) {
        return;
    }
    let hgIgnoreFile = path.resolve(sourceFolder, '.hgignore');
    fs.writeFile(hgIgnoreFile, ['syntax: glob'].concat(g_IGNORE_FILES).join('\n'), in_overwrite);
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

module.exports['gitFolder'] = gitSetupFolder;
module.exports['hgFolder'] = hgSetupFolder;
module.exports['folder'] = setupFolder;

// ******************************
