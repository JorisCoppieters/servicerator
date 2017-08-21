'use strict'; // JS: ES6

// ******************************
// Requires:
// ******************************

let Promise = require('bluebird');
let fs = require('fs');
let path = require('path');
let process = require('process');
let cprint = require('color-print');
let rimraf = require('rimraf');

// ******************************
// Functions:
// ******************************

function setupFolder (in_folderTitle, in_folder, in_options) {
    let opt = in_options || {};
    if (!fileExists(in_folder)) {
        if (!opt.suppressOutput) {
            cprint.cyan('  Creating ' + in_folderTitle + ' folder "' + in_folder + '"...');
        }
        createFolder(in_folder);
    }
}

// ******************************

function setupFile (in_fileTitle, in_file, in_fileContents, in_options) {
    let opt = in_options || {};
    if (!fileExists(in_file)) {
        if (!opt.suppressOutput) {
            cprint.cyan('  Creating ' + in_fileTitle + ' "' + in_file + '"...');
        }
        writeFile(in_file, in_fileContents);
    } else if (opt.overwrite) {
        if (!opt.suppressOutput) {
            cprint.yellow('  Overwriting ' + in_fileTitle + ' "' + in_file + '"...');
        }
        writeFile(in_file, in_fileContents, true);
    }
}

// ******************************

function setupFileCopy (in_fileTitle, in_source, in_destination, in_options) {
    let opt = in_options || {};
    if (!fileExists(in_source)) {
        if (!opt.suppressOutput) {
            cprint.yellow('  Couldn\'t copy ' + in_fileTitle + ' from "' + in_source + '"');
        }
        return;
    }

    if (!fileExists(in_destination)) {
        if (!opt.suppressOutput) {
            cprint.cyan('  Copying ' + in_fileTitle + ' from "' + in_source + '" to "' + in_destination + '"...');
        }
        copyFile(in_source, in_destination);
    } else if (opt.overwrite) {
        if (!opt.suppressOutput) {
            cprint.yellow('  Copying (& overwriting) ' + in_fileTitle + ' from "' + in_source + '" to "' + in_destination + '"...');
        }
        copyFile(in_source, in_destination);
    }
}

// ******************************

function createFolder (in_folderName) {
    var folder = path.resolve(process.cwd(), in_folderName);
    if (!fs.existsSync(folder)) {
        fs.mkdirSync(folder);
    }
    return folder;
}

// ******************************

function deleteFolder (in_folderName) {
    var folder = path.resolve(process.cwd(), in_folderName);
    if (fs.existsSync(folder)) {
        rimraf(folder, () => {});
    }
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

function copyFile (in_source, in_destination) {
    return new Promise((resolve, reject) => {
        var source = path.resolve(process.cwd(), in_source);
        var destination = path.resolve(process.cwd(), in_destination);
        if (!fs.existsSync(source)) {
            return resolve();
        }

        let readStream = fs.createReadStream(source);
        readStream.once('error', (err) => {
            cprint.red(err);
            return reject();
        });

        readStream.on('close', () => {
            return resolve();
        });

        readStream.pipe(fs.createWriteStream(destination));
    });
}

// ******************************

function fileExists (in_fileName) {
    if (!in_fileName) {
        return false;
    }
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

module.exports['setupFile'] = setupFile;
module.exports['setupFolder'] = setupFolder;
module.exports['setupFileCopy'] = setupFileCopy;
module.exports['createFolder'] = createFolder;
module.exports['deleteFolder'] = deleteFolder;
module.exports['cwd'] = cwd;
module.exports['fileExists'] = fileExists;
module.exports['files'] = files;
module.exports['folderExists'] = fileExists;
module.exports['folders'] = files;
module.exports['isFolder'] = isFolder;
module.exports['readFile'] = readFile;
module.exports['copyFile'] = copyFile;
module.exports['writeFile'] = writeFile;
module.exports['getExtensionForType'] = getExtensionForType;

// ******************************
