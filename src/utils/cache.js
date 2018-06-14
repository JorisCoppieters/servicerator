'use strict'; // JS: ES6

// ******************************
// Requires:
// ******************************

let cprint = require('color-print');

let fs = require('./filesystem');
let date = require('./date');

// ******************************
// Constants:
// ******************************

//A list of helper cache duration periods. Used for when a new cache item is added.
const secondInMilis = 1000;
const minuteInMilis = 60 * secondInMilis;
const tenMinutesInMilis = 10 * minuteInMilis;
const halfHourInMilis = 30 * minuteInMilis;
const hourInMilis = 60 * minuteInMilis;
const dayInMilis = 24 * hourInMilis;
const weekInMilis = 7 * dayInMilis;


// ******************************
// Functions:
// ******************************

function loadCache(in_sourceFolder, in_cacheName) {
    let path = require('path');

    let sourceFolder = path.resolve(in_sourceFolder);
    if (!sourceFolder) {
        cprint.yellow('Source folder not set');
        return [];
    }

    let cacheFolder = path.resolve(sourceFolder, '.cache');
    if (!fs.folderExists(cacheFolder)) {
        return [];
    }

    let cacheFile = path.resolve(cacheFolder, in_cacheName + '.cache');
    if (!fs.fileExists(cacheFile)) {
        return [];
    }

    let cacheContents = fs.readFile(cacheFile);
    let cache = JSON.parse(cacheContents);

    let timestamp = date.getTimestamp();
    let cacheItems = [];

    (cache.items || [])
        .filter(item => {
            return item.expires > timestamp;
        })
        .forEach(item => {
            cacheItems[item.key] = item;
        });

    return cacheItems;
}

// ******************************

function saveCache(in_sourceFolder, in_cacheName, in_cacheItems) {
    let path = require('path');

    let sourceFolder = path.resolve(in_sourceFolder);
    if (!sourceFolder) {
        cprint.yellow('Source folder not set');
        return;
    }

    let cacheFolder = path.resolve(sourceFolder, '.cache');
    if (!fs.folderExists(cacheFolder)) {
        fs.createFolder(cacheFolder);
    }

    let cacheFile = path.resolve(cacheFolder, in_cacheName + '.cache');

    let timestamp = date.getTimestamp();

    let cache = {};
    cache.items = Object.keys(in_cacheItems)
        .map(key => {
            return Object.assign({
                key: key,
            }, in_cacheItems[key]);
        })
        .filter(item => {
            return item.expires > timestamp;
        });

    fs.writeFile(cacheFile, JSON.stringify(cache), true);
}

// ******************************
// Exports:
// ******************************

module.exports['load'] = loadCache;
module.exports['save'] = saveCache;
module.exports['durations'] = {
    second: secondInMilis,
    minute: minuteInMilis,
    tenMinutes: tenMinutesInMilis,
    halfHour: halfHourInMilis,
    hour: hourInMilis,
    day: dayInMilis,
    week: weekInMilis
};

// ******************************
