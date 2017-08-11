'use strict'; // JS: ES6

// ******************************
// Requires:
// ******************************

let path = require('path');

let fs = require('../utils/filesystem');
let service = require('../utils/service');

// ******************************
// Plugin Functions:
// ******************************

function onClose (in_serviceConfig) {
    let serviceConfig = service.accessConfig(in_serviceConfig, {
        service: {
            filesystem: [
                {
                    path: 'PATH',
                    type: 'STRING',
                    contents: [
                        'STRING'
                    ]
                }

            ]
        }
    });

    let filesystem = serviceConfig.service.filesystem;

    filesystem.forEach(f => {
        if (f.type === 'folder') {
            fs.createFolder(f.path);
        } else if (f.type === 'file') {
            let filePath = f.path;
            let fileFolder = path.dirname(filePath);
            if (!fs.folderExists(fileFolder)) {
                return;
            }
            let fileContents = (f.contents || [])
                .map(c => service.replaceServiceConfigReferences(in_serviceConfig, c))
                .join('\n');
            fs.writeFile(filePath, fileContents, true);
        }
    });
}

// ******************************
// Exports:
// ******************************

module.exports['onClose'] = onClose;

// ******************************
