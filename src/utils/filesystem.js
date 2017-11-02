'use strict'; // JS: ES6

// ******************************
// Requires:
// ******************************

let cprint = require('color-print');

// ******************************
// Globals:
// ******************************

let _cwd = null;

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

function setupFolderLink (in_folderTitle, in_source, in_destination, in_options) {
    let opt = in_options || {};

    if (!fileExists(in_source)) {
        if (!opt.suppressOutput) {
            cprint.yellow('  Link source "' + in_source + '" doesn\'t exist');
        }
        return;
    }

    if (!fileExists(in_destination)) {
        if (!opt.suppressOutput) {
            cprint.cyan('  Linking ' + in_folderTitle + ' "' + in_source + '" => "' + in_destination + '"...');
        }

        linkFolder(in_source, in_destination);
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

function setupFileLink (in_fileTitle, in_source, in_destination, in_options) {
    let opt = in_options || {};

    if (!fileExists(in_source)) {
        if (!opt.suppressOutput) {
            cprint.yellow('  Link source "' + in_source + '" doesn\'t exist');
        }
        return;
    }

    if (!fileExists(in_destination)) {
        if (!opt.suppressOutput) {
            cprint.cyan('  Linking ' + in_fileTitle + ' "' + in_source + '" => "' + in_destination + '"...');
        }

        linkFile(in_source, in_destination);
    }
}
// ******************************

function setupFileCopy (in_fileTitle, in_source, in_destination, in_options) {
    let opt = in_options || {};

    if (!fileExists(in_source)) {
        if (!opt.suppressOutput) {
            cprint.yellow('  File source "' + in_source + '" doesn\'t exist');
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
    let fs = require('fs');
    let path = require('path');

    let folder = path.resolve(cwd(), in_folderName);
    if (!fs.existsSync(folder)) {
        let parentFolder = path.dirname(folder);
        createFolder(parentFolder);
        fs.mkdirSync(folder);
    }
    return folder;
}

// ******************************

function linkFolder (in_source, in_destination) {
    let fs = require('fs');
    fs.symlinkSync(in_source, in_destination, 'junction');
}

// ******************************

function linkFile (in_source, in_destination) {
    let fs = require('fs');
    fs.symlinkSync(in_source, in_destination, 'file');
}

// ******************************

function deleteFolder (in_folderName) {
    let fs = require('fs');
    let path = require('path');

    let folder = path.resolve(cwd(), in_folderName);
    if (fs.existsSync(folder)) {
        let rimraf = require('rimraf');
        rimraf(folder, () => {});
    }
}

// ******************************

function writeFile (in_fileName, in_fileContents, in_overwrite) {
    let fs = require('fs');
    let path = require('path');

    let file = path.resolve(cwd(), in_fileName);
    if (!fs.existsSync(file) || in_overwrite) {
        fs.writeFileSync(file, in_fileContents);
    }
    return file;
}

// ******************************

function readFile (in_fileName) {
    let fs = require('fs');
    let path = require('path');

    let file = path.resolve(cwd(), in_fileName);
    if (!fs.existsSync(file)) {
        return '';
    }
    return fs.readFileSync(file).toString();
}

// ******************************

function copyFile (in_source, in_destination, in_onSuccess, in_onError) {
    let fs = require('fs');
    let path = require('path');

    let source = path.resolve(cwd(), in_source);
    let destination = path.resolve(cwd(), in_destination);
    if (!fs.existsSync(source)) {
        if (in_onSuccess) {
            in_onSuccess();
        }
        return;
    }

    let readStream = fs.createReadStream(source);
    readStream.once('error', (err) => {
        cprint.red(err);
        if (in_onError) {
            in_onError();
        }
        return;
    });

    readStream.on('close', () => {
        if (in_onSuccess) {
            in_onSuccess();
        }
        return;
    });

    readStream.pipe(fs.createWriteStream(destination));
}

// ******************************

function fileExists (in_fileName) {
    if (!in_fileName) {
        return false;
    }

    let fs = require('fs');
    let path = require('path');

    let file = path.resolve(cwd(), in_fileName);
    return fs.existsSync(file);
}

// ******************************

function isFolder (in_folderName) {
    let fs = require('fs');
    let path = require('path');

    let folder = path.resolve(cwd(), in_folderName);
    return fs.lstatSync(folder).isDirectory();
}

// ******************************

function cwd () {
    if (!_cwd) {
        let process = require('process');
        _cwd = process.cwd();
    }
    return _cwd;
}

// ******************************

function files (in_folderName) {
    let fs = require('fs');
    let path = require('path');

    let folder = path.resolve(cwd(), in_folderName);
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
module.exports['setupFolderLink'] = setupFolderLink;
module.exports['setupFileLink'] = setupFileLink;
module.exports['setupFileCopy'] = setupFileCopy;
module.exports['linkFolder'] = linkFolder;
module.exports['linkFile'] = linkFile;
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
