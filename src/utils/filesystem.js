'use strict'; // JS: ES6

// ******************************
// Requries:
// ******************************

let fs = require('fs');
let path = require('path');
let process = require('process');
let cprint = require('color-print');

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
    return fs.readFileSync(file).toString();
}

// ******************************

function fileExists (in_fileName) {
    var file = path.resolve(process.cwd(), in_fileName);
    return fs.existsSync(file);
}

// ******************************

function isFolder (in_folderName) {
    var folder = path.resolve(process.cwd(), in_folderName);
    return fs.lstatSync(folder).isDirectory();
}

// ******************************

function cwd (in_fileName) {
    return process.cwd();
}

// ******************************

function files (in_folderName) {
    var folder = path.resolve(process.cwd(), in_folderName);
    if (!fs.existsSync(folder)) {
        return [];
    }
    return fs.readdirSync(folder);
}

// ******************************

function getExtensionForType (in_fileType) {
    let extension = '';
    switch (in_fileType)
    {
        case 'bash':
            extension = '.sh';
            break;

        default:
            cprint.yellow('Unknown file type: ' + in_fileType);
            return '';

    }

    return extension;
}

// ******************************
// Exports:
// ******************************

module.exports['createFolder'] = createFolder;
module.exports['cwd'] = cwd;
module.exports['fileExists'] = fileExists;
module.exports['files'] = files;
module.exports['folderExists'] = fileExists;
module.exports['folders'] = files;
module.exports['isFolder'] = isFolder;
module.exports['readFile'] = readFile;
module.exports['writeFile'] = writeFile;
module.exports['getExtensionForType'] = getExtensionForType;

// ******************************
