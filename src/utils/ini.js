'use strict'; // JS: ES6

// ******************************
// Requires:
// ******************************

let path = require('path');
let cprint = require('color-print');

let fs = require('./filesystem');

// ******************************
// Functions:
// ******************************

function parseIniFile (in_iniFile) {
    if (!in_iniFile || !fs.fileExists(in_iniFile)) {
        return false;
    }

    let iniFile = path.resolve(in_iniFile).replace(new RegExp('\\\\', 'g'), '/');

    let iniFileContents = fs.readFile(iniFile);
    let iniFileLines = iniFileContents.split(/(?:\n|(?:\r\n?))+/);
    let currentSectionName = 'default';

    let iniContents = {};
    iniContents[currentSectionName] = {};

    iniFileLines.forEach(l => {
        let sectionMatch = l.match(/\[(.*)\]/);
        if (sectionMatch) {
            currentSectionName = sectionMatch[1];
            if (!iniContents[currentSectionName]) {
                iniContents[currentSectionName] = {};
            }
            return;
        }

        let currentSection = iniContents[currentSectionName];

        let keyValMatch = l.match(/(.*)=(.*)/);
        if (keyValMatch) {
            let key = keyValMatch[1].trim();
            let val = keyValMatch[2].trim();
            currentSection[key] = val;
            return;
        }

        if (!l.trim()) {
            return;
        }

        cprint.yellow(`Unhandled line "${l}" in "${iniFile}"`);
    });

    return iniContents;
}

// ******************************
// Exports:
// ******************************

module.exports['parseFile'] = parseIniFile;

// ******************************
