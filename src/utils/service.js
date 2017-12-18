'use strict'; // JS: ES6

// ******************************
// Constants:
// ******************************

const k_DEFAULT_PYTHON_IMAGE = 'continuumio/anaconda:4.3.1';
const k_DEFAULT_IMAGE = 'ubuntu:trusty';

// ******************************
// Requires:
// ******************************

let cprint = require('color-print');

let bash = require('./bash');
let docker = require('./docker');
let print = require('./print');
let env = require('./env');
let fs = require('./filesystem');

// ******************************
// Globals:
// ******************************

let _schema = null;
let _schema_version = null;

// ******************************
// Functions:
// ******************************

function createServiceConfig (in_folderName, in_initialise) {
    let sourceFolder = false;

    let path = require('path');

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

    if (!serviceConfig.schema_version) {
        serviceConfig.schema_version = getServiceConfigSchemaVersion();
    }

    let bashEnvFile = path.resolve(sourceFolder, '_env.sh');
    if (bashEnvFile && fs.fileExists(bashEnvFile)) {
        let bashServiceConfig = bash.parseEnvFile(bashEnvFile);
        if (bashServiceConfig) {
            serviceConfig = _copyToServiceConfig(bashServiceConfig, serviceConfig);
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
                    operations: [],
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

            serviceConfig.docker.image.operations.push(
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

            serviceConfig.docker.image.operations.push(
                {
                    'path': '$AUTH_DIR',
                    'type': 'folder'
                }
            );

            if (serviceConfig.auth.certificate && serviceConfig.auth.key) {
                serviceConfig.docker.image.operations.push(
                    {
                        'source': `${serviceConfig.auth.certificate}`,
                        'destination': '$AUTH_DIR',
                        'type': 'copy_file'
                    }
                );
                serviceConfig.docker.image.operations.push(
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
                        fileSystem: []
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

            serviceConfig.docker.image.operations.push({
                path: '/var/log/tm-services/$SERVICE_NAME',
                type: 'folder'
            });

            serviceConfig.docker.image.operations.push({
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

            serviceConfig.docker.image.operations.push(
                {
                    'path': '$PYTHON_DIR',
                    'type': 'folder'
                }
            );
            serviceConfig.docker.image.operations.push(
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

            serviceConfig.docker.image.operations.push(
                {
                    'path': '$NODE_DIR',
                    'type': 'folder'
                }
            );
            serviceConfig.docker.image.operations.push(
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
                    operations: []
                }
            }
        });

        serviceConfig.docker.image.env_variables.push({
            key: 'MODEL_DIR',
            val: '$BASE_DIR/model'
        });

        if (bundledModel) {
            serviceConfig.docker.image.operations.push({
                'path': '$MODEL_DIR',
                'type': 'folder'
            });

            serviceConfig.docker.image.operations.push({
                'source': `${serviceConfig.model.source}`,
                'destination': '$MODEL_DIR',
                'type': 'copy_folder'
            });
        } else {
            serviceConfig.docker.image.operations.push({
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

    if (in_initialise) {
        serviceConfig = _copyToServiceConfig(serviceConfig, {
            service: {
                name: path.basename(path.resolve(sourceFolder)),
            }
        });
    }

    if (!serviceConfig.service || !serviceConfig.service.name) {
        return false;
    }

    if (!_checkObjectAgainstJSONSchema('ROOT', serviceConfig, getServiceConfigSchema())) {
        return false;
    }
    return serviceConfig;
}

// ******************************

function checkServiceConfigSchema (in_serviceConfig) {
    return _checkObjectAgainstJSONSchema('CHECK', in_serviceConfig, getServiceConfigSchema());
}

// ******************************

function accessServiceConfig (in_serviceConfig, in_accessConfig) {
    let accessConfig = _convertToJSONSchema(in_accessConfig);
    _checkObjectAgainstJSONSchema('ACCESS', in_serviceConfig, accessConfig);

    return maskServiceConfig(in_serviceConfig, in_accessConfig);
}

// ******************************

function loadServiceConfig (in_sourceFolder) {
    let path = require('path');

    let serviceConfig = false;
    let serviceConfigFile = env.getServiceConfigFile(in_sourceFolder);
    if (!serviceConfigFile) {
        return false;
    }

    try {
        let serviceConfigContents = fs.readFile(serviceConfigFile);
        if (!serviceConfigContents.trim()) {
            return false;
        }
        serviceConfig = JSON.parse(serviceConfigContents);
    } catch (e) {
        cprint.red('Failed to parse "' + serviceConfigFile + '":\n  ' + e.stack);
        return false;
    }

    serviceConfig.cwd = path.dirname(serviceConfigFile);
    _updateServiceConfig(serviceConfig);

    return serviceConfig;
}

// ******************************

function getServiceConfigSchema () {
    if (!_schema) {
        _schema = require('./service.schema').get();
    }
    return _schema;
}

// ******************************

function getServiceConfigSchemaVersion () {
    if (!_schema_version) {
        _schema_version = require('./service.schema').k_SCHEMA_VERSION;
    }
    return _schema_version;
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

    let fsCore = require('fs');

    let sourceFolder = serviceConfig.cwd || '.';
    sourceFolder = fsCore.realpathSync(sourceFolder);

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

    let path = require('path');

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

    let path = require('path');

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

    let path = require('path');

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

    // let nginxFile = false;

    // let dockerFolder = docker.getFolder(sourceFolder);
    // if (dockerFolder) {
    //     nginxFile = path.resolve(dockerFolder, 'nginx.conf');
    // }

    opt.overwrite = !!serviceFile.overwrite || opt.overwrite;

    let filePath = path.resolve(sourceFolder, serviceFile.path);
    filePath = replaceServiceConfigReferences(in_serviceConfig, filePath);

    // if (filePath === nginxFile) {
    //     if (!opt.suppressOutput) {
    //         cprint.yellow('  WARNING: Use the nginx option in the schema to generate the nginx.conf file')
    //     }
    //     return;
    // }

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

    let path = require('path');

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

    // let nginxFile = false;

    // let dockerFolder = docker.getFolder(sourceFolder);
    // if (dockerFolder) {
    //     nginxFile = path.resolve(dockerFolder, 'nginx.conf');
    // }

    opt.overwrite = !!serviceFile.overwrite || opt.overwrite;

    let source = path.resolve(sourceFolder, serviceFile.source);
    source = replaceServiceConfigReferences(in_serviceConfig, source);

    let destination = path.resolve(sourceFolder, serviceFile.destination);
    destination = replaceServiceConfigReferences(in_serviceConfig, destination);

    // if (destination === nginxFile) {
    //     if (!opt.suppressOutput) {
    //         cprint.yellow('  WARNING: Use the nginx option in the schema to generate the nginx.conf file')
    //     }
    //     return;
    // }

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

    let path = require('path');

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

    // let nginxFile = false;

    // let dockerFolder = docker.getFolder(sourceFolder);
    // if (dockerFolder) {
    //     nginxFile = path.resolve(dockerFolder, 'nginx.conf');
    // }

    opt.overwrite = !!serviceFile.overwrite || opt.overwrite;

    let source = path.resolve(sourceFolder, serviceFile.source);
    source = replaceServiceConfigReferences(in_serviceConfig, source);

    let destination = path.resolve(sourceFolder, serviceFile.destination);
    destination = replaceServiceConfigReferences(in_serviceConfig, destination);

    // if (destination === nginxFile) {
    //     if (!opt.suppressOutput) {
    //         cprint.yellow('  WARNING: Use the nginx option in the schema to generate the nginx.conf file')
    //     }
    //     return;
    // }

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

    let serviceConfig = loadServiceConfig(sourceFolder);
    if (!serviceConfig) {
        if (in_folderName === '.') {
            cprint.cyan('Initialising folder...');
        } else {
            cprint.cyan('Initialising "' + in_folderName + '"...');
        }

        serviceConfig = createServiceConfig(sourceFolder, true) || {};
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
    let path = require('path');

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

function updateServiceConfig (in_serviceConfig, in_newServiceConfig, in_options) {
    let opt = in_options || {};
    let serviceConfig = accessServiceConfig(in_serviceConfig, {
        cwd: 'STRING'
    });

    let sourceFolder = serviceConfig.cwd;
    if (!sourceFolder) {
        cprint.yellow('Invalid source folder: ' + sourceFolder);
        return false;
    }

    let savedServiceConfig = loadServiceConfig(sourceFolder);
    if (savedServiceConfig) {
        let updatedServiceConfig = _copyToServiceConfig(in_newServiceConfig, savedServiceConfig);
        _saveServiceConfig(updatedServiceConfig, opt);
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

function removeServiceConfig (in_serviceConfig, in_removeServiceConfig, in_options) {
    let opt = in_options || {};
    let serviceConfig = accessServiceConfig(in_serviceConfig, {
        cwd: 'STRING'
    });

    let sourceFolder = serviceConfig.cwd;
    if (!sourceFolder) {
        cprint.yellow('Invalid source folder: ' + sourceFolder);
        return false;
    }

    let savedServiceConfig = loadServiceConfig(sourceFolder);
    if (savedServiceConfig) {
        let updatedServiceConfig = _removeFromServiceConfig(in_removeServiceConfig, savedServiceConfig);
        _saveServiceConfig(updatedServiceConfig, opt);
    }

    let updatedServiceConfig = _removeFromServiceConfig(in_removeServiceConfig, in_serviceConfig);
    return updatedServiceConfig;
}

// ******************************

function unsetServiceConfigValue (in_serviceConfig, in_keyPath, in_options) {
    let opt = in_options || {};
    let serviceConfig = in_serviceConfig || {};

    if (!in_keyPath) {
        cprint.yellow('Specify a key path to unset, i.e service.name');
        return;
    }

    let keyPath = in_keyPath;

    let removeConfig = {};
    let keyPathParts = keyPath
        .split(/\./)
        .filter(k => k.trim());

    if (!keyPathParts.length) {
        cprint.yellow('Specify a valid key path to unset, i.e service.name');
        return;
    }

    let keyPathPart;
    let configSubObject = removeConfig;
    while (keyPathParts.length > 1) {
        keyPathPart = keyPathParts.shift();
        configSubObject[keyPathPart] = {};
        configSubObject = configSubObject[keyPathPart];
    }

    keyPathPart = keyPathParts.shift();
    configSubObject[keyPathPart] = false;

    serviceConfig = removeServiceConfig(serviceConfig, removeConfig, opt);
}

// ******************************

function setServiceConfigValue (in_serviceConfig, in_keyPath, in_keyValue, in_options) {
    let opt = in_options || {};
    let serviceConfig = in_serviceConfig || {};

    if (!in_keyPath) {
        cprint.yellow('Specify a key path to set, i.e service.name');
        return;
    }

    let keyPath = in_keyPath;
    let keyPathMatch = keyPath.match(/(.*?)=(.*)/);
    let keyValue = in_keyValue;
    if (keyPathMatch) {
        keyPath = keyPathMatch[1];
        keyValue = keyPathMatch[2];
    }

    if (typeof(keyValue) === 'undefined') {
        cprint.yellow('Specify a value to set');
        return;
    }

    if (typeof(keyValue) === 'string') {
        if (keyValue.trim().toLowerCase() === 'true') {
            keyValue = true;
        } else if (keyValue.trim().toLowerCase() === 'false') {
            keyValue = false;
        } else if (keyValue.trim().match(/^-?[0-9]+\.[0-9]+$/)) {
            keyValue = parseFloat(keyValue);
        } else if (keyValue.trim().match(/^-?[0-9]+$/)) {
            keyValue = parseInt(keyValue);
        }
    }

    let updateConfig = {};
    let keyPathParts = keyPath
        .split(/\./)
        .filter(k => k.trim());

    if (!keyPathParts.length) {
        cprint.yellow('Specify a valid key path to set, i.e service.name');
        return;
    }

    let keyPathPart;
    let configSubObject = updateConfig;
    while (keyPathParts.length > 1) {
        keyPathPart = keyPathParts.shift();
        configSubObject[keyPathPart] = {};
        configSubObject = configSubObject[keyPathPart];
    }

    keyPathPart = keyPathParts.shift();
    configSubObject[keyPathPart] = keyValue;

    serviceConfig = updateServiceConfig(serviceConfig, updateConfig, opt);
}

// ******************************

function getServiceConfigValue (in_serviceConfig, in_keyPath) {
    let serviceConfig = in_serviceConfig || {};

    if (!in_keyPath) {
        cprint.yellow('Specify a key path to set, i.e service.name');
        return;
    }

    let keyPath = in_keyPath;
    let keyPathParts = keyPath
        .split(/\./)
        .filter(k => k.trim());

    if (!keyPathParts.length) {
        cprint.yellow('Specify a valid key path to set, i.e service.name');
        return;
    }

    let keyPathPart;
    let configSubObject = serviceConfig;
    while (keyPathParts.length > 1) {
        keyPathPart = keyPathParts.shift();
        configSubObject = configSubObject[keyPathPart] || {};
    }

    keyPathPart = keyPathParts.shift();
    let keyValue = configSubObject[keyPathPart];

    if (typeof(keyValue) === 'object') {
        keyValue = JSON.stringify(keyValue, null, 4);
    }

    print.keyVal(keyPath, keyValue);
}

// ******************************
// Helper Functions:
// ******************************

function _updateServiceConfig (in_serviceConfig) {
    let serviceConfig = accessServiceConfig(in_serviceConfig, {
        schema_version: 'NUMBER'
    });

    let updatedServiceConfig;
    let hasBeenUpdated = false;

    let schemaVersion = serviceConfig.schema_version || 0;
    if (schemaVersion < 1) {
        updatedServiceConfig = _updateServiceConfigFrom0To1(in_serviceConfig);
        if (updatedServiceConfig) {
            in_serviceConfig = updatedServiceConfig;
            hasBeenUpdated = true;
        }
    }

    if (schemaVersion < 2) {
        updatedServiceConfig = _updateServiceConfigFrom1To2(in_serviceConfig);
        if (updatedServiceConfig) {
            in_serviceConfig = updatedServiceConfig;
            hasBeenUpdated = true;
        }
    }

    if (schemaVersion < 3) {
        updatedServiceConfig = _updateServiceConfigFrom2To3(in_serviceConfig);
        if (updatedServiceConfig) {
            in_serviceConfig = updatedServiceConfig;
            hasBeenUpdated = true;
        }
    }

    // if (schemaVersion < 4) {
    //     updatedServiceConfig = _updateServiceConfigFrom3To4(in_serviceConfig);
    //     if (updatedServiceConfig) {
    //         in_serviceConfig = updatedServiceConfig;
    //         hasBeenUpdated = true;
    //     }
    // }

    if (hasBeenUpdated) {
        cprint.green('Updated service config');
        in_serviceConfig.schema_version = getServiceConfigSchemaVersion();
        _saveServiceConfig(in_serviceConfig);
    }

    return in_serviceConfig;
}

// ******************************

function _updateServiceConfigFrom0To1 (in_serviceConfig) {
    let hasBeenUpdated = false;

    if (in_serviceConfig.service) {
        if (in_serviceConfig.service.task_definition_name) {
            in_serviceConfig.service.task_definition = {
                name: in_serviceConfig.service.task_definition_name
            };

            delete in_serviceConfig.service.task_definition_name;
            hasBeenUpdated = true;
        }

        if (in_serviceConfig.service.run) {
            if (in_serviceConfig.service.run.cwd) {
                in_serviceConfig.service.run.working_directory = in_serviceConfig.service.run.cwd;
                delete in_serviceConfig.service.run.cwd;
                hasBeenUpdated = true;
            }
        }
    }

    return hasBeenUpdated ? in_serviceConfig : false;
}

// ******************************

function _updateServiceConfigFrom1To2 (in_serviceConfig) {
    let hasBeenUpdated = false;

    if (in_serviceConfig.service) {
        if (in_serviceConfig.service.task_definition) {
            if (in_serviceConfig.service.task_definition.environment_variables) {
                in_serviceConfig.docker = in_serviceConfig.docker || {};
                in_serviceConfig.docker.container = in_serviceConfig.docker.container || {};
                in_serviceConfig.docker.container.environment_variables = in_serviceConfig.service.task_definition.environment_variables;
                delete in_serviceConfig.service.task_definition.environment_variables;
                hasBeenUpdated = true;
            }
        }
    }

    return hasBeenUpdated ? in_serviceConfig : false;
}

// ******************************

function _updateServiceConfigFrom2To3 (in_serviceConfig) {
    let hasBeenUpdated = false;

    if (in_serviceConfig.service) {
        if (in_serviceConfig.service.filesystem) {
            in_serviceConfig.service.fileSystem = in_serviceConfig.service.filesystem;
            delete in_serviceConfig.service.filesystem;
            hasBeenUpdated = true;
        }

        if (in_serviceConfig.filesystem) {
            in_serviceConfig.fileSystem = in_serviceConfig.filesystem;
            delete in_serviceConfig.filesystem;
            hasBeenUpdated = true;
        }
    }

    if (!in_serviceConfig.$schema) {
        in_serviceConfig.$schema = "https://raw.githubusercontent.com/JorisCoppieters/servicerator/master/schemas/servicerator-schema-v3.json";
        hasBeenUpdated = true;
    }

    return hasBeenUpdated ? in_serviceConfig : false;
}

// ******************************

function _updateServiceConfigFrom3To4 (in_serviceConfig) {
    let hasBeenUpdated = false;

    if (in_serviceConfig.service) {
    }

    return false;
    //return hasBeenUpdated ? in_serviceConfig : false;
}

// ******************************

function _saveServiceConfig (in_serviceConfig, in_options) {
    let path = require('path');

    let opt = in_options || {};
    let serviceConfig = accessServiceConfig(in_serviceConfig, {
        cwd: 'STRING'
    });

    let sourceFolder = serviceConfig.cwd;
    if (!sourceFolder) {
        cprint.yellow('Invalid source folder: ' + sourceFolder);
        return false;
    }

    if (!opt.suppressOutput) {
        cprint.cyan('Saving service config...');
    }

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

function _checkObjectAgainstSchema (in_path, in_obj, in_schema, in_checkValueAsType, in_fullPath) {
    let fullPath = in_fullPath || '';

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
            let fullKeyPath = fullPath + '.' + k;
            cprint.yellow('  - ' + fullKeyPath);
        });
        return;
    }

    objKeys.forEach(k => {
        let objVal = in_obj[k];
        let schemaVal = in_schema[k];
        return _checkArrayElementAgainstSchema(in_path + ' > ' + k, objVal, schemaVal, in_checkValueAsType, fullPath ? fullPath + '.' + k : k);
    });
}

// ******************************

function _checkObjectAgainstJSONSchema (in_path, in_obj, in_schema) {
    let validate = require('jsonschema').validate;
    let validationResult = validate(in_obj, in_schema);

    let errors = validationResult.errors;
    if (errors && errors.length) {
        errors.forEach((error) => {
            cprint.red(in_path + ' > ' + error);
        });
        // process.exit(-1);
        return false;
    }

    return true;
}

// ******************************

function _checkArrayElementAgainstSchema (in_path, in_objVal, in_schemaVal, in_checkValueAsType, in_fullPath) {
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
            _checkArrayElementAgainstSchema(in_path + '[]', elem, schemaVal[0], in_checkValueAsType, in_fullPath);
        })
        return;
    }

    if (objValType === 'object') {
        return _checkObjectAgainstSchema(in_path, objVal, schemaVal, in_checkValueAsType, in_fullPath);
    }
}

// ******************************

function _convertToJSONSchema (in_schema) {
    let properties = {};
    for (let k in in_schema) {
        let v = in_schema[k];

        if (typeof(v) === "string") {
            if (v === "NUMBER") {
                v = {
                    "type": "number"
                };
            } else if (v === "STRING" || v === "PATH" || v === "URL") {
                v = {
                    "type": "string"
                };
            } else if (v === "BOOLEAN") {
                v = {
                    "type": "boolean"
                };
            }

        } else if (Array.isArray(v)) {
            let list = v;
            let firstItem = list[0];
            v = {
                "type": "array",
                "items": _convertToJSONSchema(firstItem)
            };
        } else {
            v = _convertToJSONSchema(v);
        }

        properties[k] = v;
    }

    return {
        "type": "object",
        "properties": properties
    };
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

module.exports['accessConfig'] = accessServiceConfig;
module.exports['checkConfigSchema'] = checkServiceConfigSchema;
module.exports['combineConfig'] = combineServiceConfig;
module.exports['copyFile'] = copyServiceFile;
module.exports['createFile'] = createServiceFile;
module.exports['createFolder'] = createServiceFolder;
module.exports['createConfig'] = createServiceConfig;
module.exports['getConfigSchema'] = getServiceConfigSchema;
module.exports['getValue'] = getServiceConfigValue;
module.exports['hasConfigFile'] = hasServiceConfigFile;
module.exports['initFolder'] = initFolder;
module.exports['linkFile'] = linkServiceFile;
module.exports['linkFolder'] = linkServiceFolder;
module.exports['loadConfig'] = loadServiceConfig;
module.exports['maskConfig'] = maskServiceConfig;
module.exports['removeConfig'] = removeServiceConfig;
module.exports['replaceConfigReferences'] = replaceServiceConfigReferences;
module.exports['setValue'] = setServiceConfigValue;
module.exports['unsetValue'] = unsetServiceConfigValue;
module.exports['updateConfig'] = updateServiceConfig;

// ******************************
