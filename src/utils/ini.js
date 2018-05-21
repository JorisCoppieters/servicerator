'use strict'; // JS: ES6

// ******************************
// Requires:
// ******************************

let cprint = require('color-print');

let fs = require('./filesystem');
let ini = require('ini');

// ******************************
// Functions:
// ******************************

function parseIniFile(in_iniFile) {
    if (!in_iniFile || !fs.fileExists(in_iniFile)) {
        return false;
    }

    let iniFileContents = fs.readFile(_standardizeIniFilePath(in_iniFile));

    return ini.parse(iniFileContents);
}

function writeIniFile(in_iniFile, in_iniFileObj) {

    let iniFileContents = ini.stringify(in_iniFileObj);

    fs.writeFile(_standardizeIniFilePath(in_iniFile),iniFileContents, true);

}

function _standardizeIniFilePath(in_iniFile) {
    let path = require('path');

    return path.resolve(in_iniFile).replace(new RegExp('\\\\', 'g'), '/');
}

// ******************************
// Exports:
// ******************************

module.exports['parseFile'] = parseIniFile;
module.exports['writeFile'] = writeIniFile;

// ******************************
