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
let nginx = require('../utils/nginx');
let service = require('../utils/service');

// ******************************
// Functions:
// ******************************

function gitSetupFolder (in_serviceConfig, in_overwrite, in_docker, in_nginx) {
    let sourceFolder = setupFolder(in_serviceConfig, in_overwrite, in_docker, in_nginx);
    if (!sourceFolder) {
        return;
    }
    let gitIgnoreFile = path.resolve(sourceFolder, '.gitignore');
    fs.writeFile(gitIgnoreFile, git.getIgnoreFileContents(in_serviceConfig), in_overwrite);
}

// ******************************

function hgSetupFolder (in_serviceConfig, in_overwrite, in_docker, in_nginx) {
    let sourceFolder = setupFolder(in_serviceConfig, in_overwrite, in_docker, in_nginx);
    if (!sourceFolder) {
        return;
    }
    let hgIgnoreFile = path.resolve(sourceFolder, '.hgignore');
    fs.writeFile(hgIgnoreFile, hg.getIgnoreFileContents(in_serviceConfig), in_overwrite);
}

// ******************************

function setupFolder (in_serviceConfig, in_overwrite, in_docker, in_nginx) {
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
        version_control: {
            type: 'STRING'
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

    if (in_docker) {
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
    }

    if (in_nginx) {
        let nginxFile = path.resolve(dockerFolder, 'nginx.conf');
        if (serviceConfig.docker.image.nginx.servers.length) {
            let nginxFileContents = nginx.getFileContents(in_serviceConfig);
            fs.setupFile('nginx.conf', nginxFile, nginxFileContents, {
                overwrite: in_overwrite
            });
        }
    }

    if (serviceConfig.version_control.type === 'mercurial') {
        let hgRootFolder = hg.getRootFolder(in_serviceConfig);
        let hgIgnoreFile = path.resolve(hgRootFolder, '.hgignore');
        let hgIgnoreFileContents = hg.getIgnoreFileContents(in_serviceConfig);
        fs.setupFile('hgignore', hgIgnoreFile, hgIgnoreFileContents, {
            overwrite: in_overwrite
        });
    }

    _createFilesystem(in_serviceConfig, 'on_setup', in_overwrite);

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

function _createFilesystem (in_serviceConfig, in_fieldCheck, in_overwrite) {
    let serviceConfig = service.accessConfig(in_serviceConfig, {
        service: {
            filesystem: [
                {
                    on_open: 'BOOLEAN',
                    on_close: 'BOOLEAN',
                    on_setup: 'BOOLEAN',
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
        cprint.yellow("Source folder not set");
        return;
    }

    let suppressOutput = ['on_open', 'on_close'].indexOf(in_fieldCheck) >= 0;

    let filesystem = serviceConfig.service.filesystem;
    filesystem.forEach(f => {
        if (!f[in_fieldCheck]) {
            return;
        }

        if (f.type === 'folder') {
            service.createFolder(in_serviceConfig, f, {
                suppressOutput: suppressOutput
            });

        } else if (f.type === 'link_folder') {
            service.linkFolder(in_serviceConfig, f, {
                suppressOutput: suppressOutput
            });

        } else if (f.type === 'file') {
            service.createFile(in_serviceConfig, f, {
                suppressOutput: suppressOutput,
                overwrite: in_overwrite
            });

        } else if (f.type === 'link_file') {
            service.linkFile(in_serviceConfig, f, {
                suppressOutput: suppressOutput,
                overwrite: in_overwrite
            });

        } else if (f.type === 'copy_file') {
            service.copyFile(in_serviceConfig, f, {
                suppressOutput: suppressOutput,
                overwrite: in_overwrite
            });

        }
    });
}

// ******************************
// Plugin Functions:
// ******************************

function onOpen (in_serviceConfig) {
    _createFilesystem(in_serviceConfig, 'on_open');
}

// ******************************

function onClose (in_serviceConfig) {
    _createFilesystem(in_serviceConfig, 'on_close');
}

// ******************************

function handleCommand (in_args, in_params, in_serviceConfig) {
    let command = in_params.length ? in_params.shift().toLowerCase() : '';
    let overwrite = in_args['overwrite'];
    let docker = in_args['docker'];
    let nginx = in_args['nginx'];
    switch(command)
    {
        case '':
            setupFolder(in_serviceConfig, overwrite, docker, nginx);
            break;
        case 'git':
            gitSetupFolder(in_serviceConfig, overwrite, docker, nginx);
            break;
        case 'hg':
        case 'mercurial':
            hgSetupFolder(in_serviceConfig, overwrite, docker, nginx);
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
        { params: [''], description: 'Setup this folder', options: [
            {param:'overwrite', description:'Overwrite any files that exist'},
            {param:'docker', description:'Create the Dockerfile'},
            {param:'nginx', description:'Create the nginx config'}
        ] },

        { params: ['git'], description: 'Setup this folder as a git repository', options: [
            {param:'overwrite', description:'Overwrite any files that exist'},
            {param:'docker', description:'Create the Dockerfile'},
            {param:'nginx', description:'Create the nginx config'}
        ] },

        { params: ['hg'], description: 'Setup this folder as a mercurial repository', options: [
            {param:'overwrite', description:'Overwrite any files that exist'},
            {param:'docker', description:'Create the Dockerfile'},
            {param:'nginx', description:'Create the nginx config'}
        ] },
    ];
}

// ******************************

function getTitle () {
    return 'Setup';
}

// ******************************
// Exports:
// ******************************

module.exports['onOpen'] = onOpen;
module.exports['onClose'] = onClose;
module.exports['handleCommand'] = handleCommand;
module.exports['getBaseCommands'] = getBaseCommands;
module.exports['getCommands'] = getCommands;
module.exports['getTitle'] = getTitle;

// ******************************
