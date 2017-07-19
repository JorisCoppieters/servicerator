'use strict'; // JS: ES5

// ******************************
// Requries:
// ******************************

let cprint = require('color-print');

let exec = require('./exec');
let env = require('./env');

// ******************************
// Globals:
// ******************************

let g_EDITOR = "D:/Dropbox/System/Utils/Windows/Sublime/sublime_text.exe";

// ******************************
// Functions:
// ******************************

function editServiceFolder () {
    let serviceFolder = env.getServiceFolder();
    if (!serviceFolder) {
        cprint.yellow("No service folder set");
        return;
    }

    _edit(serviceFolder);
}

// ******************************

function editServiceConfigFile () {
    let serviceConfigFile = env.getServiceConfigFile();
    if (!serviceConfigFile) {
        cprint.yellow("No service config file set");
        return;
    }

    _edit(serviceConfigFile);
}

// ******************************

function _edit (in_paths) {
    let editor = _getEditor();
    if (!editor) {
        cprint.yellow("No editor set");
        return;
    }

    exec.cmd(editor, ['-a'].concat(in_paths));
}

// ******************************

function _getEditor () {
    let editor;

    editor = process.env.EDITOR;
    if (editor) {
        return editor;
    }

    editor = g_EDITOR;
    if (editor) {
        return editor;
    }
}

// ******************************
// Exports:
// ******************************

module.exports['serviceFolder'] = editServiceFolder;
module.exports['serviceConfigFile'] = editServiceConfigFile;

// ******************************
