#!/usr/bin/env node

'use strict'; // JS: ES6

// ******************************
//
//
// SERVICERATOR v0.1.2
//
// 0.1.0
// - Initial release
//
// ******************************

// ******************************
// Requires:
// ******************************

let c = require('./src/constants');
let cprint = require('color-print');
let path = require('path');
let process = require('process');
let fs = require('fs');
let help = require('./src/help');
let minimist = require('minimist');

// ******************************
// Constants:
// ******************************

// ******************************
// Globals:
// ******************************

let g_IGNORE_FILES = [
    'node_modules'
];

// ******************************
// Arguments:
// ******************************

let g_ARGV = minimist(process.argv.slice(2));

// ******************************
// Script:
// ******************************

if (g_ARGV['help']) {
    help.printHelp();
} else if (g_ARGV['version']) {
    help.printVersion();
} else {
    let commands = g_ARGV['_'] || false;
    let command = commands.shift();

    let folderName;
    switch(command)
    {
        case 'init':
            folderName = commands.length ? commands.shift() : '.';
            initFolder(folderName);
            break;
        case 'git-init':
            folderName = commands.length ? commands.shift() : '.';
            gitInitFolder(folderName);
            break;
        case 'hg-init':
            folderName = commands.length ? commands.shift() : '.';
            hgInitFolder(folderName);
            break;
        default:
            cprint.yellow('Unknown command: ' + command);
            break;
    }
}

// ******************************
// Functions:
// ******************************

function gitInitFolder (in_folderName) {
    let sourceFolder = initFolder(in_folderName);
    if (!sourceFolder) {
        return;
    }
    let gitIgnoreFile = path.resolve(sourceFolder, '.gitignore');
    writeFile(gitIgnoreFile, g_IGNORE_FILES.join('\n'));
}

// ******************************

function hgInitFolder (in_folderName) {
    let sourceFolder = initFolder(in_folderName);
    if (!sourceFolder) {
        return;
    }
    let hgIgnoreFile = path.resolve(sourceFolder, '.hgignore');
    writeFile(hgIgnoreFile, g_IGNORE_FILES.join('\n'));
}

// ******************************

function initFolder (in_folderName) {
    if (in_folderName.match(/\.\.\/?/)) {
        cprint.yellow('Invalid path: ' + in_folderName);
        return false;
    } else if (in_folderName === '.') {
        cprint.cyan('Initialising folder...');
    } else {
        cprint.cyan('Initialising "' + in_folderName + '"...');
    }

    let sourceFolder = process.cwd();
    if (in_folderName !== '.') {
        sourceFolder = createFolder(in_folderName);
    }

    let serviceConfigFile = path.resolve(sourceFolder, 'service.json');
    writeFile(serviceConfigFile, JSON.stringify(getServiceConfig(sourceFolder), null, 4));

    let bashEnvFile = path.resolve(sourceFolder, 'env.sh');
    writeFile(bashEnvFile, getBaseEnvContents(sourceFolder));

    createFolder(path.resolve(sourceFolder, 'docker'));
    createFolder(path.resolve(sourceFolder, 'corpus'));
    createFolder(path.resolve(sourceFolder, 'model'));
    createFolder(path.resolve(sourceFolder, 'downloads'));

    return sourceFolder;
}

// ******************************

function getServiceConfig (in_folderName) {
    let imageName = path.basename(in_folderName);
    let serviceName =
        imageName
            .replace(/([a-z]+)-.*/g,'$1') + '-' +
        imageName
            .replace(/-([a-z])[a-z]+/g,'-$1')
            .replace(/^[a-z]+-/,'')
            .replace(/-/g,'');

    let serviceTestUrl = 'https://' + serviceName + '.test.my-services-url.com';
    let serviceProdUrl = 'https://' + serviceName + '.my-services-url.com';

    return {
        'model':{
            'version': '1.0.0'
        },
        'service' : {
            'name': serviceName,
            'urls': [
                {'env': 'test', 'value': serviceTestUrl},
                {'env': 'prod', 'value': serviceProdUrl}
            ],
            'cluster': {
                'instance': {
                    'count': 2,
                    'type': 't2.small',
                    'volume_size': 58
                }
            }
        },
        'docker': {
            'username': 'my-docker-username',
            'image': {
                'name': imageName,
                'version': '1.0.0'
            },
            'container': {
                'memory_limit': 1500,
                'cpu_core_count': 1,
                'ports': [
                    {'number':5000, 'description': 'flask_http', 'secure': false},
                    {'number':5100, 'description': 'nginx_http', 'secure': false},
                    {'number':5200, 'description': 'nginx_https','secure': true}
                ],
                'commands': [
                    {'type':'start', 'env':'test', 'value':'./start-test.sh'},
                    {'type':'start', 'env':'prod', 'value':'./start-prod.sh'},
                ]
            }
        }
    };
}

// ******************************

function getBaseEnvContents (in_folderName) {
    let serviceConfig = getServiceConfig(in_folderName);
    return [
        `_MODEL_VERSION="${serviceConfig.model.version}"`,
        ``,
        `DOCKER_IMAGE_USERNAME="${serviceConfig.docker.username}";`,
        `DOCKER_IMAGE_NAME="${serviceConfig.docker.image.name}";`,
        `DOCKER_IMAGE_VERSION="${serviceConfig.docker.image.version}";`,
        `DOCKER_IMAGE_MEMORY_LIMIT=${serviceConfig.docker.container.memory_limit};`,
        `DOCKER_CONTAINER_PORT=${
                serviceConfig.docker.container.ports
                    .find((p) => {return p.description==='nginx_http'}).number
            };`,
        `DOCKER_CONTAINER_SECURE_PORT=${
                serviceConfig.docker.container.ports
                    .find((p) => {return p.description==='nginx_https'}).number
            };`,
        `DOCKER_CONTAINER_TEST_START_COMMAND="${
                serviceConfig.docker.container.commands
                    .find((c) => {return c.type==='start' && c.env==='test'}).value
            }";`,
        `DOCKER_CONTAINER_START_COMMAND="${
                serviceConfig.docker.container.commands
                    .find((c) => {return c.type==='start' && c.env==='prod'}).value
            }";`,
        `DOCKER_VERIFY_API_COMMAND="curl -s -k https://localhost:$DOCKER_CONTAINER_SECURE_PORT";`,
        `DOCKER_VERIFY_API_EXPECTED_RESULT='{'*'container_version'*':'*$DOCKER_IMAGE_VERSION*'cpu_count'*'cpu_percent'*'model_version'*':'*$_MODEL_VERSION*'processes'*'}';`,
        `DOCKER_EXTRA_TAG="model-version-"$_MODEL_VERSION;`,
        `DOCKER_CONTAINER_SECURE_URL_TEST="${
                serviceConfig.service.urls
                    .find((u) => {return u.env==='test'}).value
            }";`,
        `DOCKER_CONTAINER_SECURE_URL_PROD="${
                serviceConfig.service.urls
                    .find((u) => {return u.env==='prod'}).value
            }";`,
        `DOCKER_CONTAINER_MOUNT_VOLUMES=true;`,
        `CLUSTER_INSTANCE_COUNT=${serviceConfig.service.cluster.instance.count};`,
        `INSTANCE_CPU_COUNT=${serviceConfig.docker.container.cpu_core_count};`,
        `SERVICE_NAME="${serviceConfig.service.name}";`,
        ``,
        `AWS_SERVICE_INSTANCE_TYPE="${serviceConfig.service.cluster.instance.type}";`,
        `AWS_SERVICE_INSTANCE_VOLUME_SIZE=${serviceConfig.service.cluster.instance.volume_size};`,
        ``,
        `CONSTANTS_FILE="python/constants.py";`,
        `echo "#CONSTANTS" > "$CONSTANTS_FILE";`,
        `echo "service_name = \\\""$SERVICE_NAME"\\\"" >> "$CONSTANTS_FILE";`,
        `echo "log_file = \\\"/var/log/tm-services/%s/api.log\\\" % (service_name)" >> "$CONSTANTS_FILE";`,
        `echo "model_version = \\\""$_MODEL_VERSION"\\\"" >> "$CONSTANTS_FILE";`,
        `echo "container_version = \\\""$DOCKER_IMAGE_VERSION"\\\"" >> "$CONSTANTS_FILE";`,
        `echo "cpu_count = "$INSTANCE_CPU_COUNT >> "$CONSTANTS_FILE";`,
    ].join('\n');
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

function writeFile (in_fileName, in_fileContents) {
    var file = path.resolve(process.cwd(), in_fileName);
    fs.writeFileSync(file, in_fileContents);
    return file;
}

// ******************************
// Exports:
// ******************************
