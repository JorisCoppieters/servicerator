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
let schema = require('./service.schema').get();
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

    let nodeFolder = path.resolve(sourceFolder, 'node');
    if (nodeFolder && fs.folderExists(nodeFolder)) {
        serviceConfig = copyServiceConfig(serviceConfig, {
            docker: {
                image: {
                    language: 'node'
                }
            },
            service: {
                name: path.basename(path.resolve(sourceFolder))
            }
        });
    }

    if (serviceConfig.docker) {
        serviceConfig = copyServiceConfig(serviceConfig, {
            docker: {
                image: {
                    env_variables: [],
                    scripts: [],
                    filesystem: [],
                    working_directory: '/root'
                }
            }
        });

        if (serviceConfig.service.name) {
            serviceConfig.docker.image.env_variables.push({
                key: 'SERVICE_NAME',
                val: serviceConfig.service.name
            });
        }

        serviceConfig.docker.image.env_variables.push({
            key: 'BASE_DIR',
            val: serviceConfig.docker.image.working_directory
        });

        if (serviceConfig.docker.image.scripts) {
            let dockerScriptsDir = '$BASE_DIR/scripts';

            serviceConfig.docker.image.env_variables.push({
                key: 'SCRIPTS_DIR',
                val: dockerScriptsDir
            });

            serviceConfig.docker.image.scripts.forEach(s => {
                let scriptKey = s.name.toUpperCase().replace(/[-]/,'_') + '_FILE';
                let scriptPath = '$SCRIPTS_DIR/' + s.name + fs.getExtensionForType(s.language);
                serviceConfig.docker.image.env_variables.push({
                    key: scriptKey,
                    val: scriptPath
                });
                s.key = scriptKey
            });

            serviceConfig.docker.image.filesystem.push(
                {
                    'path': '$SCRIPTS_DIR',
                    'type': 'folder'
                }
            );
        }

        if (serviceConfig.auth) {
            serviceConfig.docker.image.env_variables.push({
                key: 'AUTH_DIR',
                val: '$BASE_DIR/auth'
            });

            serviceConfig.docker.image.filesystem.push(
                {
                    'path': '$AUTH_DIR',
                    'type': 'folder'
                }
            );

            if (serviceConfig.auth.certificate && serviceConfig.auth.key) {
                serviceConfig.docker.image.filesystem.push(
                    {
                        'source': `${serviceConfig.auth.certificate}`,
                        'destination': '$AUTH_DIR',
                        'type': 'copy_file'
                    }
                );
                serviceConfig.docker.image.filesystem.push(
                    {
                        'source': `${serviceConfig.auth.key}`,
                        'destination': '$AUTH_DIR',
                        'type': 'copy_file'
                    }
                );
            }
        }

        if (serviceConfig.aws) {
            serviceConfig = copyServiceConfig(serviceConfig, {
                docker: {
                    image: {
                        log: true,
                        filesystem: []
                    },
                    other_repositories: [],
                    container: {
                        volumes: []
                    }
                }
            });

            // TODO - Remove TM specific logging path
            serviceConfig.docker.container.volumes.push({
                container: '/var/log/tm-services/$SERVICE_NAME',
                host: 'logs',
                name: '$SERVICE_NAME-logs'
            });

            serviceConfig.docker.image.filesystem.push({
                path: '/var/log/tm-services/$SERVICE_NAME',
                type: 'folder'
            });

            serviceConfig.docker.image.filesystem.push({
                path: '/var/log/tm-services/$SERVICE_NAME/api.log',
                type: 'file'
            });

            serviceConfig.docker.other_repositories.push({
                type: 'AWS'
            })
        }

        if (serviceConfig.docker.image.language === 'python') {
            serviceConfig.docker.image.env_variables.push({
                key: 'PYTHON_DIR',
                val: '$BASE_DIR/python'
            });

            serviceConfig.docker.image.filesystem.push(
                {
                    'path': '$PYTHON_DIR',
                    'type': 'folder'
                }
            );
            serviceConfig.docker.image.filesystem.push(
                {
                    'source': 'python',
                    'destination': '$PYTHON_DIR',
                    'type': 'copy_folder'
                }
            );
        } else if (serviceConfig.docker.image.language === 'node') {
            serviceConfig.docker.image.env_variables.push({
                key: 'NODE_DIR',
                val: '$BASE_DIR/node'
            });

            serviceConfig.docker.image.filesystem.push(
                {
                    'path': '$NODE_DIR',
                    'type': 'folder'
                }
            );
            serviceConfig.docker.image.filesystem.push(
                {
                    'source': 'node',
                    'destination': '$NODE_DIR',
                    'type': 'copy_folder'
                }
            );
        }
    }

    let bundledModel = false;
    let modelFolder = path.resolve(sourceFolder, 'model');
    if (!modelFolder || !fs.folderExists(modelFolder)) {
        let bundledModelFolder = path.resolve(sourceFolder, 'bundled_model');
        if (bundledModelFolder && fs.folderExists(bundledModelFolder)) {
            modelFolder = bundledModelFolder;
            bundledModel = true;
        }
    }

    if (modelFolder && fs.folderExists(modelFolder)) {
        serviceConfig = copyServiceConfig(serviceConfig, {
            model: {
                source: path.relative(sourceFolder, modelFolder),
                type: bundledModel ? 'bundled' : 'model_store'
            },
            docker: {
                container: {
                    volumes: []
                },
                image: {
                    env_variables: [],
                    filesystem: []
                }
            }
        });

        serviceConfig.docker.image.env_variables.push({
            key: 'MODEL_DIR',
            val: '$BASE_DIR/model'
        });

        if (bundledModel) {
            serviceConfig.docker.image.filesystem.push({
                'path': '$MODEL_DIR',
                'type': 'folder'
            });

            serviceConfig.docker.image.filesystem.push({
                'source': `${serviceConfig.model.source}`,
                'destination': '$MODEL_DIR',
                'type': 'copy_folder'
            });
        } else {
            serviceConfig.docker.image.filesystem.push({
                'source': '/model',
                'destination': '$MODEL_DIR',
                'type': 'link'
            });

            serviceConfig.docker.container.volumes.push({
                container: '/model',
                host: 'model',
                name: 'model'
            });
        }
    }

    serviceConfig = copyServiceConfig(serviceConfig, {
        docker: {
            image: {
                name: path.basename(path.resolve(sourceFolder)),
                base: k_DEFAULT_IMAGE,
                tag_with_date: true
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
    _checkObjectAgainstSchema('ROOT', in_serviceConfig, schema);
}

// ******************************

function accessServiceConfig (in_serviceConfig, in_accessConfig) {
    _checkObjectAgainstSchema('ACCESS', in_accessConfig, schema, true);
    return maskServiceConfig(in_serviceConfig, in_accessConfig);
}

// ******************************

function getServiceConfigSchema () {
    return schema;
}

// ******************************

function maskServiceConfig (in_source, in_mask, in_k) {
    let source = in_source;
    let mask = in_mask;
    let result = {};
    let resultIsArray = false;

    if (Array.isArray(mask)) {
        if (!mask.length) {
            return [];
        }

        if (!source || !source.length) {
            return [];
        }

        let mv = mask[0];

        if (Array.isArray(source) && source.length) {
            result = source.map(sv => {
                return maskServiceConfig(sv, mv);
            });
        }
    }

    if (typeof(mask) === 'object' && ! in_source) {
        source = {};
    }

    if (typeof(mask) !== 'object') {
        return source;
    }

    Object.keys(mask).forEach(k => {
        let sv = source[k];
        let mv = mask[k];

        if (typeof(mv) === 'object') {
            result[k] = maskServiceConfig(sv, mv, k);
            return;
        }

        if (sv === 'undefined') {
            cprint.red('Source value undefined for: ' + k);
            return;
        }

        result[k] = sv;
    });

    return result;
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

            if (typeof(destination) !== 'object') {
                destination = {};
            }

            destination[k] = v;
        });
    }

    return destination;
}

// ******************************

function removeServiceConfig (in_source, in_destination) {
    let source = in_source || {};
    let destination = in_destination;
    if (!destination) {
        return undefined;
    }

    if (Array.isArray(source)) {
        destination = [];
    } else {
        Object.keys(source).forEach(k => {
            let v = source[k];
            if (!destination[k]) {
                return;
            }

            if (typeof(v) === 'object') {
                destination[k] = removeServiceConfig(v, destination[k]);
                return;
            }

            if (typeof(destination) !== 'object') {
                return;
            }

            delete destination[k];
        });
    }

    return destination;
}

// ******************************

function replaceServiceConfigReferences (in_serviceConfig, in_string, in_replacements) {
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

    if (in_replacements) {
        Object.keys(in_replacements).forEach(k => {
            replacements[k] = in_replacements[k];
        });
    }

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

function _checkObjectAgainstSchema (in_path, in_obj, in_schema, in_checkValueAsType) {
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
        return _checkArrayElementAgainstSchema(in_path + ' > ' + k, objVal, schemaVal, in_checkValueAsType);
    });
}

// ******************************

function _checkArrayElementAgainstSchema (in_path, in_objVal, in_schemaVal, in_checkValueAsType) {
    if (in_objVal === undefined) {
        cprint.yellow('Object value isn\'t set for path "' + in_path + '"');
        return;
    }

    if (in_schemaVal === undefined) {
        cprint.yellow('Schema value isn\'t set for path "' + in_path + '"');
        return;
    }

    let objVal = in_objVal;
    let objValType = typeof(objVal);
    if (in_checkValueAsType && objValType !== 'object') {
        objValType = objVal.toLowerCase();
        objVal = undefined;
        if (objValType === 'path') {
            objValType = 'string';
            objVal = 'path/';
        }

        if (objValType === 'url') {
            objValType = 'string';
            objVal = 'http://url';
        }
    }

    let schemaVal = in_schemaVal;

    if (schemaVal === 'ANY') {
        return;
    }

    if (schemaVal === 'STRING' && objValType !== 'string') {
        cprint.yellow('Found incorrect type (' + objValType + ') in path "' + in_path + '":');
        return;
    }

    if (schemaVal === 'PATH') {
        if (objValType !== 'string') {
            cprint.yellow('Found incorrect type (' + objValType + ') in path "' + in_path + '":');
            return;
        }

        if (!objVal || !objVal.match(/^([A-Za-z0-9 _:$.*-]*[\/\\]?)*$/)) {
            cprint.yellow('Not a valid filesystem reference format (' + objVal + ') in path "' + in_path + '": ' + objVal);
            return;
        }
    }

    if (schemaVal === 'URL') {
        if (objValType !== 'string') {
            cprint.yellow('Found incorrect type (' + objValType + ') in path "' + in_path + '":');
            return;
        }

        if (!objVal || !objVal.match(/^https?:\/\/([A-Za-z0-9 _:$.*-]*[\/\\]?)*$/)) {
            cprint.yellow('Not a valid url format (' + objVal + ') in path "' + in_path + '": ' + objVal);
            return;
        }
    }

    if (schemaVal === 'NUMBER' && objValType !== 'number') {
        cprint.yellow('Found incorrect type (' + objValType + ') in path "' + in_path + '":');
        return;
    }

    if (schemaVal === 'BOOLEAN' && objValType !== 'boolean') {
        cprint.yellow('Found incorrect type (' + objValType + ') in path "' + in_path + '":');
        return;
    }

    if (Array.isArray(schemaVal) && !Array.isArray(objVal)) {
        cprint.yellow('Found incorrect type (' + objValType + ') in path "' + in_path + '":');
        return;
    }

    if (Array.isArray(objVal)) {
        objVal.forEach(elem => {
            _checkArrayElementAgainstSchema(in_path + '[]', elem, schemaVal[0], in_checkValueAsType);
        })
        return;
    }

    if (objValType === 'object') {
        return _checkObjectAgainstSchema(in_path, objVal, schemaVal, in_checkValueAsType);
    }
}

// ******************************
// Exports:
// ******************************

module.exports['getConfig'] = getServiceConfig;
module.exports['copyConfig'] = copyServiceConfig;
module.exports['maskConfig'] = maskServiceConfig;
module.exports['removeConfig'] = removeServiceConfig;
module.exports['getConfigSchema'] = getServiceConfigSchema;
module.exports['accessConfig'] = accessServiceConfig;
module.exports['checkConfigSchema'] = checkServiceConfigSchema;
module.exports['replaceServiceConfigReferences'] = replaceServiceConfigReferences;

// ******************************
