'use strict'; // JS: ES6

// ******************************
// Requires:
// ******************************

let cprint = require('color-print');

let docker = require('../utils/docker');
let fs = require('../utils/filesystem');
let git = require('../utils/git');
let hg = require('../utils/mercurial');
let nginx = require('../utils/nginx');
let object = require('../utils/object');
let service = require('../utils/service');

// ******************************
// Functions:
// ******************************

function setupFolder (in_serviceConfig, in_overwrite) {
    let serviceConfig = service.accessConfig(in_serviceConfig, {
        auth: {},
        model: {
            source: 'STRING',
            type: 'STRING',
            version: 'STRING'
        },
        corpus: {},
        docker: {
            image: {
                nginx: {
                    servers: [
                        {}
                    ],
                    daemon_off: 'BOOLEAN'
                },
                log: 'BOOLEAN',
                language: 'STRING',
                base: 'STRING'
            }
        },
        version_control: {
            type: 'STRING',
            root_folder: 'STRING',
            ignore: [
                'STRING'
            ]
        },
        cwd: 'STRING'
    });

    let path = require('path');

    let sourceFolder = serviceConfig.cwd || false;
    if (!sourceFolder) {
        cprint.yellow('Source folder not set');
        return;
    }

    cprint.cyan('Setting up "' + sourceFolder + '"...');

    let dockerFolder = docker.getFolder(sourceFolder);
    if (!dockerFolder || !fs.folderExists(dockerFolder)) {
        dockerFolder = sourceFolder;
    }

    let repositoryFolder = serviceConfig.version_control.root_folder;
    repositoryFolder = service.replaceConfigReferences(in_serviceConfig, repositoryFolder);
    repositoryFolder = path.resolve(repositoryFolder);

    if (serviceConfig.version_control.type === 'hg' || serviceConfig.version_control.type === 'mercurial') {
        fs.setupFile('.hgignore', path.resolve(repositoryFolder, '.hgignore'), hg.getIgnoreFileContents(in_serviceConfig), {
            overwrite: in_overwrite
        });
    }

    if (serviceConfig.version_control.type === 'git') {
        fs.setupFile('.gitignore', path.resolve(repositoryFolder, '.gitignore'), git.getIgnoreFileContents(in_serviceConfig), {
            overwrite: in_overwrite
        });
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

    // TODO: Shift to global setup file
    if (in_serviceConfig.auth) {
        fs.setupFolder('docker auth', path.resolve(dockerFolder, 'auth'));
    }

    // TODO: Shift to global setup file
    if (serviceConfig.model && !object.isEmpty(serviceConfig.model)) {
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
        fileSystem: [
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

        ],
        cwd: 'STRING'
    });

    let sourceFolder = serviceConfig.cwd || false;
    if (!sourceFolder) {
        cprint.yellow('Source folder not set');
        return;
    }

    let suppressOutput = ['on_open', 'on_close'].indexOf(in_fieldCheck) >= 0;

    let fileSystem = serviceConfig.service.fileSystem;
    fileSystem.forEach(f => {
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
    switch(command)
    {
    case '':
    case 'all':
        setupFolder(in_serviceConfig, overwrite);
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
        { params: ['', 'all'], description: 'Setup this folder', options: [
            {param:'overwrite', description:'Overwrite any files that exist'}
        ] }
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
