'use strict'; // JS: ES6

// ******************************
// Requires:
// ******************************

let cprint = require('color-print');

let cache = require('../utils/cache');
let date = require('../utils/date');
let print = require('../utils/print');
let service = require('../utils/service');

// ******************************
// Functions:
// ******************************

function listCache (in_serviceConfig) {
    let serviceConfig = service.accessConfig(in_serviceConfig, {
        cwd: 'STRING'
    });

    cprint.magenta('-'.repeat(80));
    cprint.magenta('Expires\t\t\t| Cache Key');
    cprint.magenta('-'.repeat(80));

    let awsCache = cache.load(serviceConfig.cwd, 'aws');
    Object.keys(awsCache)
        .forEach(key => {
            let cacheVal = awsCache[key];
            let expires = date.getNiceTimeStamp(new Date(cacheVal.expires));
            print.out(`${cprint.toWhite(expires)}\t${cprint.toMagenta('|')} ${cprint.toCyan(key)}\n`);
        });

    cprint.magenta('-'.repeat(80));
}

// ******************************

function clearCache (in_serviceConfig, in_key, in_all) {
    let serviceConfig = service.accessConfig(in_serviceConfig, {
        cwd: 'STRING'
    });

    let awsCache = cache.load(serviceConfig.cwd, 'aws');

    if (in_all) {
        cprint.green('Clearing whole cache...');
        awsCache = {};
    } else if (!in_key) {
        cprint.yellow('Please use --key [KEY] or --all');
    } else {
        if (awsCache[in_key]) {
            cprint.green(`Clearing cache entry for ${in_key}...`);
            delete awsCache[in_key];
        } else {
            cprint.yellow(`No cache entry for ${in_key}`);
        }
    }

    if (service.hasConfigFile(serviceConfig.cwd)) {
        cache.save(serviceConfig.cwd, 'aws', awsCache);
    }
}

// ******************************
// Plugin Functions:
// ******************************

function handleCommand (in_args, in_params, in_serviceConfig) {
    let command = in_params.length ? in_params.shift().toLowerCase() : '';
    let key = in_args['key'];
    let all = in_args['all'];

    switch(command)
    {
    case '':
    case 'list':
        listCache(in_serviceConfig);
        break;
    case 'clear':
        clearCache(in_serviceConfig, key, all);
        break;
    default:
        return false;
    }
    return true;
}

// ******************************

function getBaseCommands () {
    return ['cache'];
}

// ******************************

function getCommands () {
    return [
        { params: ['', 'list'], description: 'List the cache' },
        { params: ['clear'], description: 'Clear the cache', options: [
            {param:'all', description:'Clear all cache keys'},
            {param:'key', description:'Specify the cache key to clear'}
        ] },
    ];
}

// ******************************

function getTitle () {
    return 'Cache';
}

// ******************************
// Exports:
// ******************************

module.exports['handleCommand'] = handleCommand;
module.exports['getBaseCommands'] = getBaseCommands;
module.exports['getCommands'] = getCommands;
module.exports['getTitle'] = getTitle;

// ******************************
