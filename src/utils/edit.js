'use strict'; // JS: ES6

// ******************************
// Requires:
// ******************************

let env = require('./env');
let exec = require('./exec');
let fs = require('./filesystem');

// ******************************
// Globals:
// ******************************

let g_EDITOR = undefined;

// ******************************
// Functions:
// ******************************

function editFiles (in_paths) {
    let editor = getEditor();
    if (!editor) {
        throw new Error('No editor set');
    }

    let isSublime = editor.match(/sublime/i);
    let args = in_paths;

    if (!Array.isArray(args)) {
        args = [args];
    }

    if (isSublime) {
        args = ['-a'].concat(args);
        exec.cmdSync(editor, args, {
            indent: ''
        });
    } else {
        exec.cmd(editor, args, {
            indent: '',
            detached: true
        });
    }
}

// ******************************

function getEditor () {
    let path = require('path');

    let editor;

    editor = g_EDITOR;
    if (editor) {
        return editor;
    }

    editor = process.env.EDITOR;
    if (editor) {
        g_EDITOR = editor;
        return editor;
    }

    let editorPaths = [];

    if (env.isWindows()) {
        editorPaths = editorPaths.concat([
            'C:/Program Files/Microsoft VS Code/Code.exe',
            'C:/Program Files/Sublime Text/sublime_text.exe',
            'C:/Program Files/Sublime Text 2/sublime_text.exe',
            'C:/Program Files/Sublime Text 3/sublime_text.exe',
            'C:/Program Files (x86)/Sublime Text/sublime_text.exe',
            'C:/Program Files (x86)/Sublime Text 2/sublime_text.exe',
            'C:/Program Files (x86)/Sublime Text 3/sublime_text.exe'
        ]);
    }

    editor = editorPaths
        .map(p => path.resolve(p))
        .filter(p => fs.fileExists(p))
        .find(() => true);

    if (editor) {
        g_EDITOR = editor;
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
