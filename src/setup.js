'use strict'; // JS: ES5

// ******************************
// Requries:
// ******************************

var path = require('path');
var cprint = require('color-print');

var bash = require('./bash');
var docker = require('./docker');
var init = require('./init');
var nginx = require('./nginx');
var u = require('./utils');

// ******************************
// Functions:
// ******************************

function gitSetupFolder (in_serviceConfig, in_overwrite) {
    let sourceFolder = setupFolder(in_serviceConfig, in_overwrite);
    if (!sourceFolder) {
        return;
    }
    let gitIgnoreFile = path.resolve(sourceFolder, '.gitignore');
    u.writeFile(gitIgnoreFile, g_IGNORE_FILES.join('\n'), in_overwrite);
}

// ******************************

function hgSetupFolder (in_serviceConfig, in_overwrite) {
    let sourceFolder = setupFolder(in_serviceConfig, in_overwrite);
    if (!sourceFolder) {
        return;
    }
    let hgIgnoreFile = path.resolve(sourceFolder, '.hgignore');
    u.writeFile(hgIgnoreFile, ['syntax: glob'].concat(g_IGNORE_FILES).join('\n'), in_overwrite);
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

    u.createFolder(path.resolve(sourceFolder, 'docker'));

    let dockerImageName = serviceConfigDockerImage.name || 'unknown';
    let dockerImageFolder = path.resolve(sourceFolder, 'docker', dockerImageName);
    u.createFolder(path.resolve(dockerImageFolder));

    let dockerFileContents = docker.getDockerFileContents(serviceConfig);
    if (dockerFileContents) {
        u.writeFile(path.resolve(dockerImageFolder, 'Dockerfile'), dockerFileContents, in_overwrite);
    }

    let dockerIgnoreFileContents = docker.getIgnoreDockerContents(serviceConfig);
    if (dockerIgnoreFileContents) {
        u.writeFile(path.resolve(dockerImageFolder, '.dockerignore'), dockerIgnoreFileContents, in_overwrite);
    }

    if (serviceConfigDockerImage.nginx) {
        let nginxFile = path.resolve(dockerImageFolder, 'nginx.conf');
        u.writeFile(nginxFile, nginx.getFileContents(serviceConfig), in_overwrite);
    }

    if (serviceConfigDockerImage.log) {
        u.createFolder(path.resolve(dockerImageFolder, 'logs'));
    }

    if (serviceConfigDockerImage.env === 'python') {
        u.createFolder(path.resolve(dockerImageFolder, 'python'));
    }

    if (serviceConfigDockerBuild.env === 'bash') {
        let bashEnvFile = path.resolve(dockerImageFolder, '_env.sh');
        u.writeFile(bashEnvFile, bash.getEnvContents(serviceConfig), in_overwrite);
    }

    if (serviceConfig.model) {
        u.createFolder(path.resolve(dockerImageFolder, 'model'));
        u.createFolder(path.resolve(sourceFolder, 'model'));

        if (serviceConfig.model.bundled_model) {
            u.createFolder(path.resolve(dockerImageFolder, 'bundled_model'));
        }
    }

    if (serviceConfig.corpus) {
        u.createFolder(path.resolve(sourceFolder, 'corpus'));
    }

    if (serviceConfig.downloads) {
        u.createFolder(path.resolve(sourceFolder, 'downloads'));
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
