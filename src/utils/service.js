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

let bash = require('./bash');
let docker = require('./docker');
let env = require('./env');
let fs = require('./filesystem');
let schema = require('./service.schema').get();

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
            serviceConfig = _copyToServiceConfig(bashServiceConfig, serviceConfig);
            serviceConfig = _copyToServiceConfig(serviceConfig, {
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
            serviceConfig = _copyToServiceConfig(serviceConfig, dockerServiceConfig);
            serviceConfig = _copyToServiceConfig(serviceConfig, {
                service: {
                    name: path.basename(path.resolve(sourceFolder))
                }
            });
        }
    }

    let pythonFolder = path.resolve(sourceFolder, 'python');
    if (pythonFolder && fs.folderExists(pythonFolder)) {
        serviceConfig = _copyToServiceConfig(serviceConfig, {
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
        serviceConfig = _copyToServiceConfig(serviceConfig, {
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
        serviceConfig = _copyToServiceConfig(serviceConfig, {
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
            serviceConfig = _copyToServiceConfig(serviceConfig, {
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
        serviceConfig = _copyToServiceConfig(serviceConfig, {
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

    serviceConfig = _copyToServiceConfig(serviceConfig, {
        docker: {
            image: {
                name: path.basename(path.resolve(sourceFolder)),
                base: k_DEFAULT_IMAGE
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

function maskServiceConfig (in_source, in_mask) {
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
            result[k] = maskServiceConfig(sv, mv);
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

function replaceServiceConfigReferences (in_serviceConfig, in_string, in_replacements) {
    let serviceConfig = accessServiceConfig(in_serviceConfig, {
        service: {
            name: 'STRING'
        },
        model: {
            version: 'STRING'
        },
        docker: {
            image: {
                version: 'STRING'
            }
        },
        cwd: 'STRING'
    });

    let sourceFolder = serviceConfig.cwd || '.';
    sourceFolder = sourceFolder.replace(new RegExp('\\\\', 'g'), '/');

    let replacements = {
        'CWD': `${sourceFolder}`,
        'BASE_DIR': `${sourceFolder}`,
        'WORKING_DIR': `${sourceFolder}`,
        'SERVICE_NAME': `${serviceConfig.service.name}`,
        'MODEL_VERSION': `${serviceConfig.model.version}`,
        'DOCKER_IMAGE_VERSION': `${serviceConfig.docker.image.version}`
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

function createServiceFolder (in_serviceConfig, in_serviceFolder, in_options) {
    let opt = in_options || {};
    let serviceConfig = accessServiceConfig(in_serviceConfig, {
        cwd: 'STRING'
    });

    let sourceFolder = serviceConfig.cwd || false;
    if (!sourceFolder) {
        if (!opt.suppressOutput) {
            cprint.yellow('Source folder not set');
        }
        return;
    }

    let serviceFolder = in_serviceFolder || false;
    if (!serviceFolder) {
        if (!opt.suppressOutput) {
            cprint.yellow('Service folder not set');
        }
        return;
    }

    let folderPath = path.resolve(sourceFolder, serviceFolder.path);
    folderPath = replaceServiceConfigReferences(in_serviceConfig, folderPath);

    fs.setupFolder(path.basename(folderPath), folderPath, opt);
}

// ******************************

function linkServiceFolder (in_serviceConfig, in_serviceFolder, in_options) {
    let opt = in_options || {};
    let serviceConfig = accessServiceConfig(in_serviceConfig, {
        cwd: 'STRING'
    });

    let sourceFolder = serviceConfig.cwd || false;
    if (!sourceFolder) {
        if (!opt.suppressOutput) {
            cprint.yellow('Source folder not set');
        }
        return;
    }

    let serviceFolder = in_serviceFolder || false;
    if (!serviceFolder) {
        if (!opt.suppressOutput) {
            cprint.yellow('Service folder not set');
        }
        return;
    }

    let source = path.resolve(sourceFolder, serviceFolder.source);
    source = replaceServiceConfigReferences(in_serviceConfig, source);

    let destination = path.resolve(sourceFolder, serviceFolder.destination);
    destination = replaceServiceConfigReferences(in_serviceConfig, destination);

    let parentFolder = path.dirname(destination);
    if (!fs.folderExists(parentFolder)) {
        return;
    }

    fs.setupFolderLink(path.basename(source), source, destination, opt);
}

// ******************************

function createServiceFile (in_serviceConfig, in_serviceFile, in_options) {
    let opt = in_options || {};
    let serviceConfig = accessServiceConfig(in_serviceConfig, {
        cwd: 'STRING'
    });

    let sourceFolder = serviceConfig.cwd || false;
    if (!sourceFolder) {
        if (!opt.suppressOutput) {
            cprint.yellow('Source folder not set');
        }
        return;
    }

    let serviceFile = in_serviceFile || false;
    if (!serviceFile) {
        if (!opt.suppressOutput) {
            cprint.yellow('Service file not set');
        }
        return;
    }

    let nginxFile = false;

    let dockerFolder = docker.getFolder(sourceFolder);
    if (dockerFolder) {
        nginxFile = path.resolve(dockerFolder, 'nginx.conf');
    }

    opt.overwrite = !!serviceFile.overwrite || opt.overwrite;

    let filePath = path.resolve(sourceFolder, serviceFile.path);
    filePath = replaceServiceConfigReferences(in_serviceConfig, filePath);

    if (filePath === nginxFile) {
        if (!opt.suppressOutput) {
            cprint.yellow('  WARNING: Use the nginx option in the schema to generate the nginx.conf file')
        }
        return;
    }

    let fileFolder = path.dirname(filePath);
    if (!fs.folderExists(fileFolder)) {
        return;
    }

    let fileContents = (serviceFile.contents || [])
        .map(c => replaceServiceConfigReferences(in_serviceConfig, c))
        .join('\n');

    fs.setupFile(path.basename(filePath), filePath, fileContents, opt);
}

// ******************************

function linkServiceFile (in_serviceConfig, in_serviceFile, in_options) {
    let opt = in_options || {};
    let serviceConfig = accessServiceConfig(in_serviceConfig, {
        cwd: 'STRING'
    });


    let sourceFolder = serviceConfig.cwd || false;
    if (!sourceFolder) {
        if (!opt.suppressOutput) {
            cprint.yellow('Source folder not set');
        }
        return;
    }

    let serviceFile = in_serviceFile || false;
    if (!serviceFile) {
        if (!opt.suppressOutput) {
            cprint.yellow('Service file not set');
        }
        return;
    }

    let nginxFile = false;

    let dockerFolder = docker.getFolder(sourceFolder);
    if (dockerFolder) {
        nginxFile = path.resolve(dockerFolder, 'nginx.conf');
    }

    opt.overwrite = !!serviceFile.overwrite || opt.overwrite;

    let source = path.resolve(sourceFolder, serviceFile.source);
    source = replaceServiceConfigReferences(in_serviceConfig, source);

    let destination = path.resolve(sourceFolder, serviceFile.destination);
    destination = replaceServiceConfigReferences(in_serviceConfig, destination);

    if (destination === nginxFile) {
        if (!opt.suppressOutput) {
            cprint.yellow('  WARNING: Use the nginx option in the schema to generate the nginx.conf file')
        }
        return;
    }

    let fileFolder = path.dirname(destination);
    if (!fs.folderExists(fileFolder)) {
        return;
    }

    fs.setupFileLink(path.basename(source), source, destination, opt);
}

// ******************************

function copyServiceFile (in_serviceConfig, in_serviceFile, in_options) {
    let opt = in_options || {};
    let serviceConfig = accessServiceConfig(in_serviceConfig, {
        cwd: 'STRING'
    });


    let sourceFolder = serviceConfig.cwd || false;
    if (!sourceFolder) {
        if (!opt.suppressOutput) {
            cprint.yellow('Source folder not set');
        }
        return;
    }

    let serviceFile = in_serviceFile || false;
    if (!serviceFile) {
        if (!opt.suppressOutput) {
            cprint.yellow('Service file not set');
        }
        return;
    }

    let nginxFile = false;

    let dockerFolder = docker.getFolder(sourceFolder);
    if (dockerFolder) {
        nginxFile = path.resolve(dockerFolder, 'nginx.conf');
    }

    opt.overwrite = !!serviceFile.overwrite || opt.overwrite;

    let source = path.resolve(sourceFolder, serviceFile.source);
    source = replaceServiceConfigReferences(in_serviceConfig, source);

    let destination = path.resolve(sourceFolder, serviceFile.destination);
    destination = replaceServiceConfigReferences(in_serviceConfig, destination);

    if (destination === nginxFile) {
        if (!opt.suppressOutput) {
            cprint.yellow('  WARNING: Use the nginx option in the schema to generate the nginx.conf file')
        }
        return;
    }

    let fileFolder = path.dirname(destination);
    if (!fs.folderExists(fileFolder)) {
        return;
    }

    fs.setupFileCopy(path.basename(source), source, destination, opt);
}

// ******************************

function initFolder (in_folderName) {
    if (in_folderName.match(/\.\.\/?/)) {
        cprint.yellow('Invalid path: ' + in_folderName);
        return false;
    }

    let sourceFolder = fs.cwd();
    if (in_folderName !== '.') {
        sourceFolder = fs.createFolder(in_folderName);
    }

    let serviceConfig = _loadServiceConfig(sourceFolder);
    if (!serviceConfig) {
        if (in_folderName === '.') {
            cprint.cyan('Initialising folder...');
        } else {
            cprint.cyan('Initialising "' + in_folderName + '"...');
        }

        serviceConfig = getServiceConfig(sourceFolder) || {};
        serviceConfig.cwd = sourceFolder;

        _saveServiceConfig(serviceConfig);
    }

    if (!serviceConfig) {
        cprint.yellow('Failed to create service config');
        return;
    }

    return serviceConfig;
}

// ******************************

function hasServiceConfigFile (in_sourceFolder) {
    let serviceConfig = false;
    let serviceConfigFile = path.resolve(in_sourceFolder, env.SERVICE_CONFIG_FILE_NAME);

    if (fs.fileExists(serviceConfigFile)) {
        let serviceConfigContents = fs.readFile(serviceConfigFile);
        if (serviceConfigContents.trim()) {
            return true;
        }
    }

    return false;
}

// ******************************

function updateServiceConfig (in_serviceConfig, in_newServiceConfig) {
    let serviceConfig = accessServiceConfig(in_serviceConfig, {
        cwd: 'STRING'
    });

    let sourceFolder = serviceConfig.cwd;
    if (!sourceFolder) {
        cprint.yellow('Invalid source folder: ' + sourceFolder);
        return false;
    }

    let savedServiceConfig = _loadServiceConfig(sourceFolder);
    if (savedServiceConfig) {
        let updatedServiceConfig = _copyToServiceConfig(in_newServiceConfig, savedServiceConfig);
        _saveServiceConfig(updatedServiceConfig);
    }

    let updatedServiceConfig = _copyToServiceConfig(in_newServiceConfig, in_serviceConfig);
    return updatedServiceConfig;
}

// ******************************

function combineServiceConfig (in_serviceConfig1, in_serviceConfig2) {
    let combinedServiceConfig = _copyToServiceConfig(in_serviceConfig1, in_serviceConfig2);
    return combinedServiceConfig;
}

// ******************************

function removeServiceConfig (in_serviceConfig, in_removeServiceConfig) {
    let serviceConfig = accessServiceConfig(in_serviceConfig, {
        cwd: 'STRING'
    });

    let sourceFolder = serviceConfig.cwd;
    if (!sourceFolder) {
        cprint.yellow('Invalid source folder: ' + sourceFolder);
        return false;
    }

    let savedServiceConfig = _loadServiceConfig(sourceFolder);
    if (savedServiceConfig) {
        let updatedServiceConfig = _removeFromServiceConfig(in_removeServiceConfig, savedServiceConfig);
        _saveServiceConfig(updatedServiceConfig);
    }

    let updatedServiceConfig = _removeFromServiceConfig(in_removeServiceConfig, in_serviceConfig);
    return updatedServiceConfig;
}

// ******************************
// Helper Functions:
// ******************************

function _loadServiceConfig (in_sourceFolder) {
    let serviceConfig = false;
    let serviceConfigFile = path.resolve(in_sourceFolder, env.SERVICE_CONFIG_FILE_NAME);

    if (fs.fileExists(serviceConfigFile)) {
        let serviceConfigContents = fs.readFile(serviceConfigFile);
        if (serviceConfigContents.trim()) {
            serviceConfig = JSON.parse(serviceConfigContents);
            serviceConfig.cwd = in_sourceFolder;
        }
    }

    return serviceConfig;
}

// ******************************

function _saveServiceConfig (in_serviceConfig) {
    let serviceConfig = accessServiceConfig(in_serviceConfig, {
        cwd: 'STRING'
    });

    let sourceFolder = serviceConfig.cwd;
    if (!sourceFolder) {
        cprint.yellow('Invalid source folder: ' + sourceFolder);
        return false;
    }

    cprint.cyan('Saving service config...');
    let serviceConfigFile = path.resolve(sourceFolder, env.SERVICE_CONFIG_FILE_NAME);
    let serviceConfigContents = JSON.stringify(in_serviceConfig, _serviceConfigReplacer, 4);
    fs.writeFile(serviceConfigFile, serviceConfigContents, true);
}

// ******************************

function _removeFromServiceConfig (in_source, in_destination) {
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
                destination[k] = _removeFromServiceConfig(v, destination[k]);
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

function _copyToServiceConfig (in_source, in_destination) {
    let source = in_source || {};
    let destination = in_destination || {};

    if (Array.isArray(source)) {
        destination = source;
    } else {
        Object.keys(source).forEach(k => {
            let v = source[k];
            if (typeof(v) === 'object') {
                destination[k] = _copyToServiceConfig(v, destination[k]);
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

function _serviceConfigReplacer (in_key, in_val) {
    if (in_key === 'cwd') {
        return undefined;
    }
    if (in_key === 'secret_key') {
        return undefined;
    }
    if (in_key === 'password') {
        return undefined;
    }
    return in_val;
}

// ******************************
// Exports:
// ******************************

module.exports['initFolder'] = initFolder;
module.exports['hasConfigFile'] = hasServiceConfigFile;
module.exports['updateConfig'] = updateServiceConfig;
module.exports['combineConfig'] = combineServiceConfig;
module.exports['removeConfig'] = removeServiceConfig;

module.exports['getConfig'] = getServiceConfig;
module.exports['maskConfig'] = maskServiceConfig;
module.exports['getConfigSchema'] = getServiceConfigSchema;
module.exports['accessConfig'] = accessServiceConfig;
module.exports['checkConfigSchema'] = checkServiceConfigSchema;
module.exports['replaceConfigReferences'] = replaceServiceConfigReferences;
module.exports['createFolder'] = createServiceFolder;
module.exports['linkFolder'] = linkServiceFolder;
module.exports['createFile'] = createServiceFile;
module.exports['copyFile'] = copyServiceFile;
module.exports['linkFile'] = linkServiceFile;

// ******************************
