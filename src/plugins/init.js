'use strict'; // JS: ES6

// ******************************
// Requires:
// ******************************

let cprint = require('color-print');
let path = require('path');

let fs = require('../utils/filesystem');
let service = require('../utils/service');

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
// Helper Functions:
// ******************************

function _createFilesystem (in_serviceConfig, in_fieldCheck) {
    let serviceConfig = service.accessConfig(in_serviceConfig, {
        service: {
            filesystem: [
                {
                    on_open: 'BOOLEAN',
                    on_close: 'BOOLEAN',
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

    let filesystem = serviceConfig.service.filesystem;
    filesystem.forEach(f => {
        if (!f[in_fieldCheck]) {
            return;
        }

        if (f.type === 'folder') {
            service.createFolder(in_serviceConfig, f, {
                suppressOutput: true
            });
        } else if (f.type === 'file') {
            service.createFile(in_serviceConfig, f, {
                suppressOutput: true
            });
        } else if (f.type === 'copy_file') {
            service.copyFile(in_serviceConfig, f, {
                suppressOutput: true
            });
        }
    });
}

// ******************************
// Exports:
// ******************************

module.exports['onOpen'] = onOpen;
module.exports['onClose'] = onClose;

// ******************************
