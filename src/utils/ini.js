'use strict'; // JS: ES6

// ******************************
// Requires:
// ******************************

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
    return _converObject(ini.parse(iniFileContents));
}

// ******************************

function writeIniFile(in_iniFile, in_iniFileObj) {
    let iniFileContents = ini.stringify(in_iniFileObj);
    fs.writeFile(_standardizeIniFilePath(in_iniFile),iniFileContents, true);
}

// ******************************

function _converObject(in_object) {
    if (!in_object) {
        return in_object;
    }

    if (!Object.keys(in_object)) {
        return in_object;
    }

    let convertedObject = in_object;

    Object.keys(in_object)
        .forEach(key => {
            let value = in_object[key];
            convertedObject[key] = _convertValue(value);
        });

    return convertedObject;
}

// ******************************

function _convertValue(in_value) {
    if (!in_value) {
        return in_value;
    }

    if (typeof(in_value) === 'object') {
        return _converObject(in_value);
    }

    if (in_value === 'undefined') {
        return undefined;
    }

    return in_value;
}

// ******************************

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
