'use strict'; // JS: ES6

// ******************************
// Requires:
// ******************************

let cprint = require('color-print');

let docker = require('./docker');
let exec = require('./exec');
let service = require('./service');

// ******************************
// Globals:
// ******************************

let g_MERCURIAL_INSTALLED = undefined;

// ******************************
// Functions:
// ******************************

function mercurialCmd (in_args, in_options) {
    let options = in_options || {};
    let hide = options.hide;

    if (!mercurialInstalled()) {
        cprint.yellow('Mercurial isn\'t installed');
        return false;
    }

    if (!in_args) {
        return false;
    }

    if (!Array.isArray(in_args)) {
        in_args = [in_args]
    }

    return exec.cmdSync('hg', in_args, {
        indent: '  ',
        hide: hide
    });
}

// ******************************

function mercurialInstalled () {
    if (g_MERCURIAL_INSTALLED === undefined) {
        g_MERCURIAL_INSTALLED = !!mercurialVersion();
    }
    return g_MERCURIAL_INSTALLED;
}

// ******************************

function mercurialVersion () {
    let cmdResult = exec.cmdSync('hg', ['version'], {
        indent: '',
        hide: true,
        errToOut: true
    });

    if (cmdResult.hasError) {
        return false;
    } else {
        return cmdResult.result;
    }
}

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
        'syntax: glob',
        '**/.idea/**',
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

    ignoreFiles = ignoreFiles.concat(serviceConfig.version_control.ignore || []);

    return ignoreFiles.join('\n');
}

// ******************************

function getRootFolder (in_serviceConfig) {
    let serviceConfig = service.accessConfig(in_serviceConfig, {
        version_control: {
            type: 'STRING',
            root_folder: 'STRING'
        },
    });

    let mercurialRootFolder = serviceConfig.version_control.root_folder || false;
    if (!mercurialRootFolder) {
        cprint.yellow("Mercurial root folder not set");
        return;
    }

    let path = require('path');

    mercurialRootFolder = service.replaceConfigReferences(in_serviceConfig, mercurialRootFolder);
    mercurialRootFolder = path.resolve(mercurialRootFolder);
    mercurialRootFolder = mercurialRootFolder.replace(/\\/g, '/');

    return mercurialRootFolder;
}

// ******************************
// Exports:
// ******************************

module.exports['getIgnoreFileContents'] = getIgnoreFileContents;
module.exports['getRootFolder'] = getRootFolder;
module.exports['cmd'] = mercurialCmd;
module.exports['installed'] = mercurialInstalled;
module.exports['version'] = mercurialVersion;

// ******************************
