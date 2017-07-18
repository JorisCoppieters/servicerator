'use strict'; // JS: ES5

// ******************************
// Requries:
// ******************************

var fs = require('fs');
var path = require('path');
var process = require('process');

// ******************************
// Functions:
// ******************************

function createFolder (in_folderName) {
    var folder = path.resolve(process.cwd(), in_folderName);
    if (!fs.existsSync(folder)) {
        fs.mkdirSync(folder);
    }
    return folder;
}

// ******************************

function writeFile (in_fileName, in_fileContents, in_overwrite) {
    var file = path.resolve(process.cwd(), in_fileName);
    if (!fs.existsSync(file) || in_overwrite) {
        fs.writeFileSync(file, in_fileContents);
    }
    return file;
}

// ******************************

function readFile (in_fileName) {
    var file = path.resolve(process.cwd(), in_fileName);
    if (!fs.existsSync(file)) {
        return '';
    }
    return fs.readFileSync(file);
}

// ******************************

function fileExists (in_fileName) {
    var file = path.resolve(process.cwd(), in_fileName);
    return fs.existsSync(file);
}

// ******************************

function cwd (in_fileName) {
    return process.cwd();
}

// ******************************

function indentContents (in_contents, in_indent) {
    let indent = in_indent || '  ';
    let contents = '';

    if (typeof(in_contents) !== 'string') {
        in_contents = in_contents.toString();
    }

    in_contents
        .split(/(\n|\r\n?)/)
        .forEach(c => {
            if (!c.trim()) {
                return;
            }
            contents += indent + c.trim() + '\n';
        })

    contents = contents
        .replace(/\n$/,'');

    return contents;
}

// ******************************
// Exports:
// ******************************

module.exports['createFolder'] = createFolder;
module.exports['cwd'] = cwd;
module.exports['fileExists'] = fileExists;
module.exports['readFile'] = readFile;
module.exports['writeFile'] = writeFile;
module.exports['indentContents'] = indentContents;

// ******************************
