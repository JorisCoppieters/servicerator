'use strict'; // JS: ES6

// ******************************
// Requires:
// ******************************

let cprint = require('color-print');

let exec = require('./exec');

// ******************************
// Globals:
// ******************************

let g_EDITOR = "D:/Dropbox/System/Utils/Windows/Sublime/sublime_text.exe";

// ******************************
// Functions:
// ******************************

function editFiles (in_paths) {
    let editor = getEditor();
    if (!editor) {
        cprint.yellow("No editor set");
        return false;
    }

    exec.cmd(editor, ['-a'].concat(in_paths));
}

// ******************************

function getEditor () {
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

module.exports['files'] = editFiles;
module.exports['file'] = editFiles;
module.exports['folders'] = editFiles;
module.exports['folder'] = editFiles;
module.exports['editor'] = getEditor;

// ******************************
