'use strict'; // JS: ES6

// ******************************
// Requries:
// ******************************

let cprint = require('color-print');
let path = require('path');

let fs = require('./filesystem');
let docker = require('./docker');
let bash = require('./bash');

// ******************************
// Functions:
// ******************************

function getServiceConfig (in_folderName) {
    let bashEnvFile = path.resolve(in_folderName, '_env.sh');
    let sourceFolder = false;

    if (bashEnvFile && fs.fileExists(bashEnvFile)) {
        let dockerFolder = path.resolve(bashEnvFile, '../');
        if (path.dirname(dockerFolder) === 'docker') {
            sourceFolder = path.resolve(dockerFolder, '../');
        } else {
            sourceFolder = path.resolve(dockerFolder, '../../');
        }
    } else {
        let dockerFolder = path.resolve(in_folderName, 'docker');
        if (dockerFolder && fs.fileExists(dockerFolder)) {

            bashEnvFile = path.resolve(dockerFolder, '_env.sh');
            sourceFolder = path.resolve(dockerFolder, '../');

            if (!bashEnvFile || !fs.fileExists(bashEnvFile)) {
                let folders = fs.folders(dockerFolder)
                    .map(f => path.resolve(dockerFolder, f))
                    .filter(fs.folderExists)
                    .filter(fs.isFolder);

                bashEnvFile = folders
                    .map(f => path.resolve(f, '_env.sh'))
                    .find(fs.fileExists);

                sourceFolder = path.resolve(dockerFolder, '../');
            }
        }
    }

    if (bashEnvFile && fs.fileExists(bashEnvFile)) {
        let bashServiceConfig = bash.parseEnvFile(bashEnvFile);
        if (bashServiceConfig) {
            bashServiceConfig.build = {
                language: 'bash'
            };
            bashServiceConfig.cwd = sourceFolder;

            let pythonFolder = path.resolve(in_folderName, 'python');
            if (pythonFolder && fs.folderExists(pythonFolder)) {
                if (!bashServiceConfig.docker || !bashServiceConfig.docker.env) {
                    bashServiceConfig.docker = bashServiceConfig.docker || {};
                    bashServiceConfig.docker.image = bashServiceConfig.docker.image || {};
                    bashServiceConfig.docker.image.language = 'python';
                    bashServiceConfig.docker.image.base = 'trademe/base-python-anaconda:python-version-2.7.13_anaconda-4.3.1';
                }
            }

            checkServiceConfigSchema(bashServiceConfig);

            return bashServiceConfig;
        }
    }

    let serviceFolder = path.resolve(in_folderName);
    let dockerFile = path.resolve(in_folderName, 'Dockerfile');

    if (fs.fileExists(dockerFile)) {
        let dockerFolder = path.resolve(in_folderName, '../');
        if (path.basename(dockerFolder) === 'docker') {
            serviceFolder = path.resolve(dockerFolder, '../');
        } else {
            serviceFolder = path.resolve(dockerFolder, '../../');
        }
    } else {
        let dockerFolder = path.resolve(in_folderName, 'docker');
        if (fs.fileExists(dockerFolder)) {
            dockerFile = path.resolve(dockerFolder, 'Dockerfile');
            if (!fs.fileExists(dockerFile)) {
                let folders = fs.folders(dockerFolder);
                let firstFolder = path.resolve(dockerFolder, folders[0]);
                if (fs.folderExists(firstFolder)) {
                    dockerFile = path.resolve(firstFolder, 'Dockerfile');
                }
            }
        }
    }

    let serviceConfig = _getBaseServiceConfig(in_folderName);

    if (fs.fileExists(dockerFile) && fs.folderExists(serviceFolder)) {
        let dockerServiceConfig = docker.parseDockerfile(dockerFile);
        if (dockerServiceConfig) {
            serviceConfig.docker = serviceConfig.docker || {};
            serviceConfig.docker.image = serviceConfig.docker.image || {};
            serviceConfig.docker.image.name = path.basename(serviceFolder);

            serviceConfig.service = serviceConfig.service || {};
            serviceConfig.service.name = path.basename(serviceFolder);
        }
    }

    let pythonFolder = path.resolve(in_folderName, 'python');
    if (fs.folderExists(pythonFolder)) {
        if (!serviceConfig.docker || !serviceConfig.docker.env) {
            serviceConfig.docker = serviceConfig.docker || {};
            serviceConfig.docker.image = serviceConfig.docker.image || {};
            serviceConfig.docker.image.language = 'python';
            serviceConfig.docker.image.base = 'trademe/base-python-anaconda:python-version-2.7.13_anaconda-4.3.1';
        }
    }

    if (!serviceConfig.service || !serviceConfig.service.name) {
        return false;
    }

    checkServiceConfigSchema(serviceConfig);

    return serviceConfig;
}

// ******************************

function checkServiceConfigSchema (in_serviceConfig) {
    let schema = _getServiceConfigSchema();
    _checkObjectAgainstSchema('ROOT', in_serviceConfig, schema);
}

// ******************************

function _checkObjectAgainstSchema (in_path, in_obj, in_schema) {
    if (!in_obj) {
        cprint.yellow('Object isn\'t set for path "' + in_path + '"');
        return;
    }

    if (!in_schema) {
        cprint.yellow('Schema isn\'t set for path "' + in_path + '"');
        return;
    }

    let objKeys = Object.keys(in_obj);
    let schemaKeys = Object.keys(in_schema);

    let nonSchemaKeys = objKeys.filter(k => schemaKeys.indexOf(k) < 0);
    if (nonSchemaKeys.length) {
        cprint.yellow('Found non-schema keys in path "' + in_path + '":');
        nonSchemaKeys.forEach(k => {
            cprint.yellow('  - ' + k);
        });
        return;
    }

    objKeys.forEach(k => {
        let objVal = in_obj[k];
        let schemaVal = in_schema[k];
        return _checkArrayElementAgainstSchema(in_path + ' > ' + k, objVal, schemaVal);
    });
}

// ******************************

function _checkArrayElementAgainstSchema (in_path, in_objVal, in_schemaVal) {
    if (in_objVal === undefined) {
        cprint.yellow('Object value isn\'t set for path "' + in_path + '"');
        return;
    }

    if (in_schemaVal === undefined) {
        cprint.yellow('Schema value isn\'t set for path "' + in_path + '"');
        return;
    }

    let objVal = in_objVal;
    let schemaVal = in_schemaVal;

    if (schemaVal === 'STRING' && typeof(objVal) !== 'string') {
        cprint.yellow('Found incorrect type (' + typeof(objVal) + ') in path "' + in_path + '":');
        return;
    }

    if (schemaVal === 'NUMBER' && typeof(objVal) !== 'number') {
        cprint.yellow('Found incorrect type (' + typeof(objVal) + ') in path "' + in_path + '":');
        return;
    }

    if (schemaVal === 'BOOLEAN' && typeof(objVal) !== 'boolean') {
        cprint.yellow('Found incorrect type (' + typeof(objVal) + ') in path "' + in_path + '":');
        return;
    }

    if (Array.isArray(schemaVal) && !Array.isArray(objVal)) {
        cprint.yellow('Found incorrect type (' + typeof(objVal) + ') in path "' + in_path + '":');
        return;
    }

    if (Array.isArray(objVal)) {
        objVal.forEach(elem => {
            _checkArrayElementAgainstSchema(in_path + '[]', elem, schemaVal[0]);
        })
        return;
    }

    if (typeof(objVal) === 'object') {
        return _checkObjectAgainstSchema(in_path, objVal, schemaVal);
    }
}

// ******************************
// Helper Functions:
// ******************************

function _getServiceConfigSchema () {
    return {
        "auth": {
            "certificate": "STRING",
            "disableAutoPopulate": "BOOLEAN",
            "key": "STRING",
            "rootCAKey": "STRING",
            "rootCACertificate": "STRING",
            "type": "STRING"
        },
        "aws": {
            "access_key": "STRING",
            "account_id": "NUMBER",
            "region": "STRING",
            "secret_key": "STRING"
        },
        "build": {
            "language": "STRING"
        },
        "corpus": {
            "version": "STRING"
        },
        "cwd": "STRING",
        "docker": {
            "container": {
                "commands": [
                    {
                        "env": "STRING",
                        "val": "STRING"
                    }
                ],
                "cpu_core_count": "NUMBER",
                "memory_limit": "NUMBER",
                "ports": [
                    {
                        "container": "NUMBER",
                        "host": "NUMBER"
                    }
                ],
                "volumes": [
                    {
                        "container": "STRING",
                        "host": "STRING"
                    }
                ]
            },
            "image": {
                "apt_get_packages": [
                    "STRING"
                ],
                "apt_get_update": "BOOLEAN",
                "base": "STRING",
                "commands": [
                    "STRING"
                ],
                "env_variables": [
                    {
                        "key": "STRING",
                        "val": "STRING"
                    }
                ],
                "filesystem": [
                    {
                        "contents": [
                            "STRING"
                        ],
                        "destination": "STRING",
                        "path": "STRING",
                        "permissions": "STRING",
                        "source": "STRING",
                        "type": "STRING"
                    }
                ],
                "language": "STRING",
                "log": "BOOLEAN",
                "name": "STRING",
                "nginx": {
                    "servers": [
                        {
                            "access_log": "STRING",
                            "error_log": "STRING",
                            "locations": [
                                {
                                    "location": "STRING",
                                    "pass_through": "STRING"
                                }
                            ],
                            "port": "NUMBER",
                            "ssl": {
                                "certificate": "STRING",
                                "key": "STRING"
                            }
                        }
                    ]
                },
                "pip_packages": [
                    "STRING"
                ],
                "pip_update": "BOOLEAN",
                "ports": [
                    "NUMBER"
                ],
                "scripts": [
                    {
                        "cmd": "BOOLEAN",
                        "commands": [
                            "STRING"
                        ],
                        "language": "STRING",
                        "name": "STRING"
                    }
                ],
                "tag_with_date": "BOOLEAN",
                "tags": [
                    "STRING"
                ],
                "version": "STRING",
                "work_directory": "STRING"
            },
            "other_repositories": [
                {
                    "type": "STRING"
                }
            ],
            "password": "STRING",
            "username": "STRING"
        },
        "model": {
            "disableAutoPopulate": "BOOLEAN",
            "type": "STRING",
            "version": "STRING"
        },
        "service": {
            "cluster": {
                "instance": {
                    "count": "NUMBER",
                    "type": "STRING",
                    "volume_size": "NUMBER"
                }
            },
            "name": "STRING",
            "urls": [
                {
                    "env": "STRING",
                    "val": "STRING"
                }
            ]
        }
    };
}

// ******************************

function _getBaseServiceConfig (in_folderName) {
    let imageName = path.basename(in_folderName);

    let serviceName =
        imageName
            .replace(/to/,'2')
            .replace(/-([a-z])[a-z]+/g,'-$1')
            .replace(/^([a-z])[a-z]+-/,'$1-')
            .replace(/-/g,'');

    let serviceTestUrl = 'https://' + serviceName + '.test.my-services-url.com';
    let serviceProdUrl = 'https://' + serviceName + '.my-services-url.com';

    return {
        model: {
            version: '1.0.0',
            type: 'bundled'
        },
        corpus: {
            version: '1.0.0'
        },
        service: {
            name: '',
            urls: [
                {env: 'test', val: serviceTestUrl},
                {env: 'prod', val: serviceProdUrl}
            ],
            cluster: {
                instance: {
                    count: 2,
                    type: 't2.small',
                    volume_size: 8
                }
            }
        },
        auth: {
            type: 'self-signed',
            certificate: './auth/service.crt',
            key: './auth/service.key',
        },
        docker: {
            username: 'my-docker-username',
            image: {
                name: imageName,
                nginx: {
                    servers: [
                        {
                            port: 5100,
                            access_log: '/var/log/nginx/access_log',
                            error_log: '/var/log/nginx/error_log',
                            locations: [
                                {location: '/', pass_through: 'http://127.0.0.1:5000/v1/status'},
                                {location: '/v1/status', pass_through: 'http://127.0.0.1:5000/v1/status'},
                                {location: '/v1/classify', pass_through: 'http://127.0.0.1:5000/v1/predict'},
                                {location: '/v1/predict', pass_through: 'http://127.0.0.1:5000/v1/predict'}
                            ]
                        },
                        {
                            port: 5200,
                            ssl: {
                                certificate: '$AUTH_DIR/service.crt',
                                key: '$AUTH_DIR/service.key'
                            },
                            access_log: '/var/log/nginx/ssl.access_log',
                            error_log: '/var/log/nginx/ssl.error_log',
                            locations: [
                                {location: '/', pass_through: 'http://127.0.0.1:5000/v1/status'},
                                {location: '/v1/status', pass_through: 'http://127.0.0.1:5000/v1/status'},
                                {location: '/v1/classify', pass_through: 'http://127.0.0.1:5000/v1/predict'},
                                {location: '/v1/predict', pass_through: 'http://127.0.0.1:5000/v1/predict'}
                            ]
                        }
                    ]
                },
                ports: [
                    5100,
                    5200
                ],
                base: 'ubuntu:trusty',
                language: 'none',
                work_directory: './',
                tags: [
                ],
                tag_with_date: true,
                apt_get_update: false,
                apt_get_packages: [
                    'htop',
                    'unzip',
                    'nano',
                    'jp2a'
                ],
                pip_update: true,
                pip_packages: [
                    'psutil',
                    'flask',
                    'flask_cors'
                ],
                version: '1.0.0',
                env_variables: [
                    {key: 'SERVICE_NAME', val: serviceName},
                    {key: 'PYTHON_DIR', val: './python'},
                    {key: 'MODEL_DIR', val: './model'},
                    {key: 'AUTH_DIR', val: './auth'}
                ],
                filesystem: [
                    {
                        source: 'python',
                        destination: '$PYTHON_DIR',
                        type: 'copy_folder'
                    },
                    {
                        path: '/var/log/tm-services/$SERVICE_NAME',
                        type: 'folder'
                    },
                    {
                        path: '/var/log/tm-services/$SERVICE_NAME/api.log',
                        type: 'file'
                    }
                ],
                scripts: [
                    {
                        name: 'start-test',
                        language: 'bash',
                        commands: [
                            'nginx &',
                            'cd python; python api-test.py'
                        ],
                        cmd: true
                    },
                    {
                        name: 'start-prod',
                        language: 'bash',
                        commands: [
                            'nginx &',
                            'cd python; python api-prod.py'
                        ]
                    }
                ],
                log: true
            },
            container: {
                memory_limit: 1500,
                cpu_core_count: 1,
                ports: [
                    {host: 5100, container: 5100},
                    {host: 5200, container: 5200},
                ],
                commands: [
                    {env: 'test', val: './scripts/start-test.sh'},
                    {env: 'prod', val: './scripts/start-prod.sh'}
                ]
            }
        }
    };
}

// ******************************
// Exports:
// ******************************

module.exports['getConfig'] = getServiceConfig;
module.exports['checkConfigSchema'] = checkServiceConfigSchema;

// ******************************
