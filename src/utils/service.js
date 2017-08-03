'use strict'; // JS: ES6

// ******************************
// Constants:
// ******************************

// TODO - remove TM specific image
const k_DEFAULT_PYTHON_IMAGE = 'trademe/base-python-anaconda:python-version-2.7.13_anaconda-4.3.1';
const k_DEFAULT_IMAGE = 'ubuntu:trusty';

// ******************************
// Requires:
// ******************************

let cprint = require('color-print');
let path = require('path');

let aws = require('./aws');
let bash = require('./bash');
let docker = require('./docker');
let fs = require('./filesystem');

// ******************************
// Functions:
// ******************************

function getServiceConfig (in_folderName) {
    let sourceFolder = false;

    let dockerFolder = docker.getFolder(in_folderName);
    if (dockerFolder) {
        if (path.dirname(dockerFolder) === 'docker') {
            sourceFolder = path.resolve(dockerFolder, '../');
        } else if (path.dirname(path.resolve(dockerFolder, '../')) === 'docker') {
            sourceFolder = path.resolve(dockerFolder, '../../');
        } else {
            sourceFolder = dockerFolder;
        }
    } else {
        sourceFolder = in_folderName;
    }

    let serviceConfig = {};

    if (fs.folderExists(sourceFolder)) {
        serviceConfig.cwd = sourceFolder;
    }

    let bashEnvFile = path.resolve(sourceFolder, '_env.sh');
    if (bashEnvFile && fs.fileExists(bashEnvFile)) {
        let bashServiceConfig = bash.parseEnvFile(bashEnvFile);
        if (bashServiceConfig) {
            serviceConfig = copyServiceConfig(bashServiceConfig, serviceConfig);
            serviceConfig = copyServiceConfig(serviceConfig, {
                build: {
                    language: 'bash'
                }
            });
        }
    }

    let dockerfile = docker.getDockerfile(in_folderName);
    if (dockerfile && fs.fileExists(dockerfile)) {
        let dockerServiceConfig = docker.parseDockerfile(dockerfile);
        if (dockerServiceConfig) {
            serviceConfig = copyServiceConfig(serviceConfig, dockerServiceConfig);
            serviceConfig = copyServiceConfig(serviceConfig, {
                service: {
                    name: path.basename(path.resolve(sourceFolder))
                }
            });
        }
    }

    let pythonFolder = path.resolve(sourceFolder, 'python');
    if (pythonFolder && fs.folderExists(pythonFolder)) {
        serviceConfig = copyServiceConfig(serviceConfig, {
            docker: {
                image: {
                    language: 'python',
                    base: k_DEFAULT_PYTHON_IMAGE
                }
            },
            service: {
                name: path.basename(path.resolve(sourceFolder))
            }
        });
    }

    serviceConfig = copyServiceConfig(serviceConfig, {
        docker: {
            username: 'my-docker-username',
            image: {
                name: path.basename(path.resolve(sourceFolder)),
                base: k_DEFAULT_IMAGE,
                work_directory: '/root',
                tag_with_date: true,
                version: '0.1.0'
            },
            container: {
                memory_limit: 1500,
                cpu_core_count: 1
            }
        }
    });

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

function getServiceConfigSchema () {
    let schema = _getServiceConfigSchema();
    return schema;
}

// ******************************

function copyServiceConfig (in_source, in_destination) {
    let source = in_source || {};
    let destination = in_destination || {};

    if (Array.isArray(source)) {
        destination = source;
    } else {
        Object.keys(source).forEach(k => {
            let v = source[k];
            if (typeof(v) === 'object') {
                destination[k] = copyServiceConfig(v, destination[k]);
                return;
            }

            destination[k] = v;
        });
    }

    return destination;
}

// ******************************

function replaceServiceConfigReferences (in_serviceConfig, in_string) {
    let serviceConfig = in_serviceConfig || {};
    let serviceConfigService = serviceConfig.service || {};
    let serviceConfigModel = serviceConfig.model || {};
    let serviceConfigDocker = serviceConfig.docker || {};
    let serviceConfigDockerImage = serviceConfigDocker.image || {};
    let serviceConfigDockerContainer = serviceConfigDocker.container || {};

    let replacements = {
        'SERVICE_NAME': `${serviceConfigService.name}`,
        'MODEL_VERSION': `${serviceConfigModel.version}`,
        'DOCKER_IMAGE_VERSION': `${serviceConfigDockerImage.version}`,
        'CPU_CORE_COUNT': `${serviceConfigDockerContainer.cpu_core_count}`
    };

    let replaced = in_string || '';

    Object.keys(replacements).forEach(search => {
        let replace = replacements[search];
        replaced = replaced.replace(new RegExp("\\\$" + search), replace);
    });

    return replaced;
}

// ******************************
// Helper Functions:
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

    if (schemaVal === 'PATH') {
        if (typeof(objVal) !== 'string') {
            cprint.yellow('Found incorrect type (' + typeof(objVal) + ') in path "' + in_path + '":');
            return;
        }

        if (!objVal.match(/^([A-Za-z0-9 _:$.*-]*[\/\\]?)*$/)) {
            cprint.yellow('Not a valid filesystem reference format (' + typeof(objVal) + ') in path "' + in_path + '": ' + objVal);
            return;
        }
    }

    if (schemaVal === 'URL') {
        if (typeof(objVal) !== 'string') {
            cprint.yellow('Found incorrect type (' + typeof(objVal) + ') in path "' + in_path + '":');
            return;
        }

        if (!objVal.match(/^https?:\/\/([A-Za-z0-9 _:$.*-]*[\/\\]?)*$/)) {
            cprint.yellow('Not a valid url format (' + typeof(objVal) + ') in path "' + in_path + '": ' + objVal);
            return;
        }
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

function _getServiceConfigSchema () {
    return {
        "auth": {
            "certificate": "STRING",
            "disableAutoPopulate": "BOOLEAN",
            "key": "STRING",
            "rootCAKey": "PATH",
            "rootCACertificate": "PATH",
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
                        "host": "NUMBER",
                        "env": "STRING"
                    }
                ],
                "volumes": [
                    {
                        "container": "STRING",
                        "host": "STRING",
                        "name": "STRING"
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
                        "destination": "PATH",
                        "path": "PATH",
                        "permissions": "STRING",
                        "source": "PATH",
                        "type": "STRING"
                    }
                ],
                "language": "STRING",
                "python": {
                    "constants": [
                        "STRING"
                    ]
                },
                "log": "BOOLEAN",
                "name": "STRING",
                "nginx": {
                    "servers": [
                        {
                            "access_log": "PATH",
                            "error_log": "PATH",
                            "locations": [
                                {
                                    "location": "PATH",
                                    "location_params": [
                                        "STRING"
                                    ],
                                    "pass_through": "URL",
                                    "uwsgi_pass": "STRING"
                                }
                            ],
                            "port": "NUMBER",
                            "ssl": {
                                "certificate": "PATH",
                                "key": "PATH"
                            }
                        }
                    ],
                    "daemon_off": "BOOLEAN"
                },
                "pip_packages": [
                    "STRING"
                ],
                "pip_update": "BOOLEAN",
                "conda_channels": [
                    "STRING"
                ],
                "conda_packages": [
                    "STRING"
                ],
                "conda_update": "BOOLEAN",
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
                "work_directory": "PATH"
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
// Exports:
// ******************************

module.exports['getConfig'] = getServiceConfig;
module.exports['copyConfig'] = copyServiceConfig;
module.exports['getConfigSchema'] = getServiceConfigSchema;
module.exports['checkConfigSchema'] = checkServiceConfigSchema;
module.exports['replaceServiceConfigReferences'] = replaceServiceConfigReferences;

// ******************************
