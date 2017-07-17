#!/usr/bin/env node

'use strict'; // JS: ES6

// ******************************
//
//
// SERVICERATOR v0.1.3
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
    'docker/*/.aws_cache/*',
    'docker/*/auth/*.crt',
    'docker/*/auth/*.key',
    'docker/*/logs/*',
    'docker/*/model/*',
    'docker/*/node/node_modules/*',
    'docker/*/s3/*',
];

let g_DOCKER_IGNORE_FILES = [
    '_env.sh',
    'logs/*',
    'model/*',
    'node/node_modules/*',
    's3/*',
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
    let command = commands.length ? commands.shift() : false;
    if (!command) {
        help.printHelp();
        return;
    }

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
    writeFile(hgIgnoreFile, ['syntax: glob'].concat(g_IGNORE_FILES).join('\n'));
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

    let serviceConfig;
    let serviceConfigFile = path.resolve(sourceFolder, 'service.json');

    if (fs.existsSync(serviceConfigFile)) {
        serviceConfig = JSON.parse(fs.readFileSync(serviceConfigFile));
    } else {
        serviceConfig = getServiceConfig(sourceFolder);
        writeFile(serviceConfigFile, JSON.stringify(serviceConfig, null, 4));
    }

    let serviceConfigDocker = serviceConfig.docker || {};
    let serviceConfigDockerImage = serviceConfigDocker.image || {};

    createFolder(path.resolve(sourceFolder, 'docker'));

    let dockerImageName = serviceConfigDockerImage.name || 'unknown';
    let dockerImageFolder = path.resolve(sourceFolder, 'docker', dockerImageName);
    createFolder(path.resolve(dockerImageFolder));

    let bashEnvFile = path.resolve(dockerImageFolder, '_env.sh');
    writeFile(bashEnvFile, getBaseEnvContents(serviceConfig));

    let dockerFile = path.resolve(dockerImageFolder, 'Dockerfile');
    writeFile(dockerFile, getDockerFileContents(serviceConfig));

    let dockerIgnoreFile = path.resolve(dockerImageFolder, '.dockerignore');
    writeFile(dockerIgnoreFile, g_DOCKER_IGNORE_FILES.join('\n'));

    let nginxFile = path.resolve(dockerImageFolder, 'nginx.conf');
    writeFile(nginxFile, getNginxFileContents(serviceConfig));

    createFolder(path.resolve(dockerImageFolder, 'python'));
    createFolder(path.resolve(dockerImageFolder, 'model'));
    createFolder(path.resolve(dockerImageFolder, 'bundled_model'));
    createFolder(path.resolve(dockerImageFolder, 'logs'));

    createFolder(path.resolve(sourceFolder, 'corpus'));
    createFolder(path.resolve(sourceFolder, 'model'));
    createFolder(path.resolve(sourceFolder, 'downloads'));

    return sourceFolder;
}

// ******************************

function getServiceConfig (in_folderName) {
    let imageName = path.basename(in_folderName);
    // let serviceName =
    //     imageName
    //         .replace(/([a-z]+)-.*/g,'$1') + '-' +
    //     imageName
    //         .replace(/-([a-z])[a-z]+/g,'-$1')
    //         .replace(/^[a-z]+-/,'')
    //         .replace(/-/g,'');


    let serviceName =
        imageName
            .replace(/to/,'2')
            .replace(/-([a-z])[a-z]+/g,'-$1')
            .replace(/^([a-z])[a-z]+-/,'$1-')
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
                'base':'ubuntu:trusty',
                'name': imageName,
                'version': '1.0.0',
                'env_variables': [
                    {key:'BASE_DIR', val:'/root'}
                ]
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
                    {'type':'python_start', 'needs_nginx': true, 'env':'test', 'value':'$BASE_DIR/start-test.sh'},
                    {'type':'python_start', 'needs_nginx': true, 'env':'prod', 'value':'$BASE_DIR/start-prod.sh'},
                ]
            }
        }
    };
}

// ******************************

function getDockerFileContents (in_serviceConfig) {
    let serviceConfig = in_serviceConfig;
    let serviceConfigDocker = serviceConfig.docker || {};
    let serviceConfigDockerImage = serviceConfigDocker.image || {};
    let serviceConfigDockerContainer = serviceConfigDocker.container || {};
    let serviceConfigService = serviceConfig.service || {};

    let baseImage = serviceConfigDockerImage.base || 'unknown';
    let serviceName = serviceConfigService.name || 'unknown';
    let envVariables = serviceConfigDockerImage.env_variables || [];
    let containerPorts = serviceConfigDockerContainer.ports || [];
    let pythonStartCommands =
        (serviceConfigDockerContainer.commands || [])
            .filter((c) => {return c.type==='python_start';});

    return [
        `# ----------------------`,
        `#`,
        `# BASE`,
        `#`,
        `# ----------------------`,
        ``,
        `    FROM ${baseImage}`,
        ``,
        `# ----------------------`,
        `#`,
        `# ENVIRONMENT`,
        `#`,
        `# ----------------------`].join('\n') + (
        envVariables.length ?
            '\n\n' +
            envVariables
                .map((v) => {return `    ENV ${v.key} ${v.val}`}).join('\n')
            : ''
        ) + (
        pythonStartCommands.length ?
            '\n\n' +
            pythonStartCommands
                .map((c) => {return `    ENV INIT_${c.env.toUpperCase()}_FILE ${c.value}`}).join('\n')
            : ''
        ) + (
        containerPorts.length ?
            '\n\n' +
            containerPorts
            .map((p) => {return `    EXPOSE ${p.number}`}).join('\n')
            : ''
        ) +
    [
        ``,
        ``,
        `    WORKDIR $BASE_DIR`,
        ``,
        `# ----------------------`,
        `#`,
        `# NGINX`,
        `#`,
        `# ----------------------`,
        ``,
        `    RUN apt-get install -y nginx`,
        `    RUN rm -v /etc/nginx/nginx.conf`,
        `    ADD nginx.conf /etc/nginx/`,
        ``,
        `# ----------------------`,
        `#`,
        `# GENERATE SCRIPTS`,
        `#`,
        `# ----------------------`,].join('\n') + (
        pythonStartCommands.length ?
            '\n' +
            pythonStartCommands
                .map((c) => {
                    let commandFile = `$INIT_${c.env.toUpperCase()}_FILE`;
                    return [
                        ``,
                        `    RUN touch ${commandFile} && chmod +x ${commandFile}`,
                        `    RUN \\`,
                        `        echo "#! /bin/bash" > ${commandFile} && \\`,
                    ].join('\n') + (
                    c.needs_nginx ?
                        `\n        echo "nginx &" >> ${commandFile} && \\`
                        : ''
                    ) +
                    [
                        ``,
                        `        echo "cd python; python api-${c.env}.py" >> ${commandFile}`,
                    ].join('\n')
                }).join('\n')
            : ''
        ) +
    [
        ``,
        ``,
        `# ----------------------`,
        `#`,
        `# COPY FILES/FOLDERS`,
        `#`,
        `# ----------------------`,
        ``,
        `    RUN mkdir -p $PYTHON_DIR`,
        `    COPY python $PYTHON_DIR`,
        ``,
        `    RUN mkdir -p /home/classifier/model`,
        `    COPY bundled_model /home/classifier/model`,
        ``,
        `    RUN mkdir -p /home/classifier/auth`,
        `    COPY auth /home/classifier/auth`,
        ``,
        `    RUN mkdir -p /var/log/tm-services/${serviceName}`,
        `    RUN touch /var/log/tm-services/${serviceName}/api.log`,
        ``,
        `# ----------------------`,
        `#`,
        `# CMD / ENTRYPOINT`,
        `#`,
        `# ---------------------`,
        ``].join('\n') +
        pythonStartCommands
            .filter((c) => {return c.env==='test'})
            .map((c) => `\n    CMD $INIT_TEST_FILE`).join('\n') +
    '\n';
}

// ******************************

function getNginxFileContents (in_serviceConfig) {
    return [
        `worker_processes 4;`,
        ``,
        `events { worker_connections 1024; }`,
        ``,
        `http {`,
        ``,
        `    sendfile on;`,
        ``,
        `    server {`,
        ``,
        `        listen 5100;`,
        ``,
        `        access_log /var/log/nginx/docker.access.log;`,
        `        error_log /var/log/nginx/docker.error.log;`,
        ``,
        `        location / {`,
        `            proxy_pass http://127.0.0.1:5000/v1/status;`,
        `            proxy_set_header X-Real-IP $remote_addr;`,
        `        }`,
        ``,
        `        location /v1/status {`,
        `            proxy_pass http://127.0.0.1:5000/v1/status;`,
        `            proxy_set_header X-Real-IP $remote_addr;`,
        `        }`,
        ``,
        `        location /v1/classify {`,
        `            proxy_pass http://127.0.0.1:5000/v1/predict;`,
        `            proxy_set_header X-Real-IP $remote_addr;`,
        `        }`,
        ``,
        `        location /v1/predict {`,
        `            proxy_pass http://127.0.0.1:5000/v1/predict;`,
        `            proxy_set_header X-Real-IP $remote_addr;`,
        `        }`,
        `    }`,
        ``,
        `    server {`,
        ``,
        `        listen 5200;`,
        ``,
        `        ssl on;`,
        `        ssl_certificate /home/classifier/auth/service.crt;`,
        `        ssl_certificate_key /home/classifier/auth/service.key;`,
        ``,
        `        access_log /var/log/nginx/docker.ssl_access.log;`,
        `        error_log /var/log/nginx/docker.ssl_error.log;`,
        ``,
        `        location / {`,
        `            proxy_pass http://127.0.0.1:5000/v1/status;`,
        `            proxy_set_header X-Real-IP $remote_addr;`,
        `        }`,
        ``,
        `        location /v1/status {`,
        `            proxy_pass http://127.0.0.1:5000/v1/status;`,
        `            proxy_set_header X-Real-IP $remote_addr;`,
        `        }`,
        ``,
        `        location /v1/classify {`,
        `            proxy_pass http://127.0.0.1:5000/v1/predict;`,
        `            proxy_set_header X-Real-IP $remote_addr;`,
        `        }`,
        ``,
        `        location /v1/predict {`,
        `            proxy_pass http://127.0.0.1:5000/v1/predict;`,
        `            proxy_set_header X-Real-IP $remote_addr;`,
        `        }`,
        `    }`,
        `}`,
        ``,
        `daemon off;`,
    ].join('\n');
}

// ******************************

function getBaseEnvContents (in_serviceConfig) {
    let serviceConfig = in_serviceConfig;
    let serviceConfigModel = serviceConfig.model || {};
    let serviceConfigDocker = serviceConfig.docker || {};
    let serviceConfigDockerImage = serviceConfigDocker.image || {};
    let serviceConfigDockerContainer = serviceConfigDocker.container || {};
    let serviceConfigService = serviceConfig.service || {};
    let serviceConfigServiceCluster = serviceConfigService.cluster || {};
    let serviceConfigServiceClusterInstance = serviceConfigServiceCluster.instance || {};

    let containerPorts = serviceConfigDockerContainer.ports || [];
    let serviceConfigServiceUrls = serviceConfigService.urls || [];
    let pythonStartCommands =
        (serviceConfigDockerContainer.commands || [])
            .filter((c) => {return c.type==='python_start';});

    return [
        `_MODEL_VERSION="${serviceConfigModel.version}"`,
        ``,
        `DOCKER_IMAGE_USERNAME="${serviceConfigDocker.username}";`,
        `DOCKER_IMAGE_NAME="${serviceConfigDockerImage.name}";`,
        `DOCKER_IMAGE_VERSION="${serviceConfigDockerImage.version}";`,
        `DOCKER_IMAGE_MEMORY_LIMIT=${serviceConfigDockerContainer.memory_limit};`,
        `DOCKER_CONTAINER_PORT=${
                (containerPorts
                    .find((p) => {return p.description==='nginx_http'}) || {}).number
            };`,
        `DOCKER_CONTAINER_SECURE_PORT=${
                (containerPorts
                    .find((p) => {return p.description==='nginx_https'}) || {}).number
            };`,
        `DOCKER_CONTAINER_TEST_START_COMMAND="${
                (pythonStartCommands
                    .find((c) => {return c.env==='test'}) || {}).value
            }";`,
        `DOCKER_CONTAINER_START_COMMAND="${
                (pythonStartCommands
                    .find((c) => {return c.env==='prod'}) || {}).value
            }";`,
        `DOCKER_VERIFY_API_COMMAND="curl -s -k https://localhost:$DOCKER_CONTAINER_SECURE_PORT";`,
        `DOCKER_VERIFY_API_EXPECTED_RESULT='{'*'container_version'*':'*$DOCKER_IMAGE_VERSION*'cpu_count'*'cpu_percent'*'model_version'*':'*$_MODEL_VERSION*'processes'*'}';`,
        `DOCKER_EXTRA_TAG="model-version-"$_MODEL_VERSION;`,
        `DOCKER_CONTAINER_SECURE_URL_TEST="${
                (serviceConfigServiceUrls
                    .find((u) => {return u.env==='test'}) || {}).value
            }";`,
        `DOCKER_CONTAINER_SECURE_URL_PROD="${
                (serviceConfigServiceUrls
                    .find((u) => {return u.env==='prod'}) || {}).value
            }";`,
        `DOCKER_CONTAINER_MOUNT_VOLUMES=true;`,
        `CLUSTER_INSTANCE_COUNT=${serviceConfigServiceClusterInstance.count};`,
        `INSTANCE_CPU_COUNT=${serviceConfigDockerContainer.cpu_core_count};`,
        `SERVICE_NAME="${serviceConfigService.name}";`,
        ``,
        `AWS_SERVICE_INSTANCE_TYPE="${serviceConfigServiceClusterInstance.type}";`,
        `AWS_SERVICE_INSTANCE_VOLUME_SIZE=${serviceConfigServiceClusterInstance.volume_size};`,
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
