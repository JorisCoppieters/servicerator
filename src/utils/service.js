'use strict'; // JS: ES6

// ******************************
// Requires:
// ******************************

let cprint = require('color-print');

let bash = require('./bash');
let docker = require('./docker');
let env = require('./env');
let fs = require('./filesystem');
let object = require('./object');
let print = require('./print');

// ******************************
// Globals:
// ******************************

let _schema = null;
let _schema_url = null;
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

    let scriptSchema = getServiceConfigSchemaUrl();
    let scriptSchemaVersion = getServiceConfigSchemaVersion();

    if (!serviceConfig.schema_version) {
        serviceConfig.schema_version = scriptSchemaVersion;
        serviceConfig.$schema = scriptSchema;
    }

    let bashEnvFile = path.resolve(sourceFolder, '_env.sh');
    if (bashEnvFile && fs.fileExists(bashEnvFile)) {
        let bashServiceConfig = bash.parseEnvFile(bashEnvFile);
        if (bashServiceConfig) {
            serviceConfig = object.setMask(bashServiceConfig, serviceConfig);
        }
    }

    let dockerfile = docker.getDockerfile(in_folderName);
    if (dockerfile && fs.fileExists(dockerfile)) {
        serviceConfig = object.setMask(serviceConfig, {
            service: {
                name: path.basename(path.resolve(sourceFolder))
            }
        });
    }

    let pythonFolder = path.resolve(sourceFolder, 'python');
    if (pythonFolder && fs.folderExists(pythonFolder)) {
        serviceConfig = object.setMask(serviceConfig, {
            service: {
                name: path.basename(path.resolve(sourceFolder))
            }
        });
    }

    let nodeFolder = path.resolve(sourceFolder, 'node');
    if (nodeFolder && fs.folderExists(nodeFolder)) {
        serviceConfig = object.setMask(serviceConfig, {
            service: {
                name: path.basename(path.resolve(sourceFolder))
            }
        });
    }

    if (serviceConfig.docker) {
        if (serviceConfig.aws) {
            serviceConfig = object.setMask(serviceConfig, {
                docker: {
                    image: {
                        log: true
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

            serviceConfig.docker.other_repositories.push({
                type: 'AWS'
            });
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
        serviceConfig = object.setMask(serviceConfig, {
            model: {
                source: path.relative(sourceFolder, modelFolder),
                type: bundledModel ? 'bundled' : 'model_store'
            },
            docker: {
                container: {
                    volumes: []
                }
            }
        });

        if (!bundledModel) {
            serviceConfig.docker.container.volumes.push({
                container: '/model',
                host: 'model',
                name: 'model'
            });
        }
    }

    if (in_initialise) {
        serviceConfig = object.setMask(serviceConfig, {
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
    let warning = true;
    return _checkObjectAgainstJSONSchema('CHECK', in_serviceConfig, getServiceConfigSchema(), warning);
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
    _upgradeServiceConfig(serviceConfig);

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

function getServiceConfigSchemaUrl () {
    if (!_schema_url) {
        _schema_url = require('./service.schema').getUrl();
    }
    return _schema_url;
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
            name: 'STRING',
            bucket: {
                name: 'STRING'
            }
        },
        model: {
            version: 'STRING',
            bucket: 'STRING'
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
        'SERVICE_BUCKET': `${serviceConfig.service.bucket.name}`,
        'MODEL_VERSION': `${serviceConfig.model.version}`,
        'MODEL_BUCKET': `${serviceConfig.model.bucket}`,
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
        replaced = replaced.replace(new RegExp('\\$' + search), replace);
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
        let updatedServiceConfig = object.setMask(in_newServiceConfig, savedServiceConfig);
        _saveServiceConfig(updatedServiceConfig, opt);
    }

    let updatedServiceConfig = object.setMask(in_newServiceConfig, in_serviceConfig);
    return updatedServiceConfig;
}

// ******************************

function combineServiceConfig (in_serviceConfig1, in_serviceConfig2) {
    let combinedServiceConfig = object.setMask(in_serviceConfig1, in_serviceConfig2);
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
        let updatedServiceConfig = object.unsetMask(in_removeServiceConfig, savedServiceConfig);
        _saveServiceConfig(updatedServiceConfig, opt);
    }

    let updatedServiceConfig = object.unsetMask(in_removeServiceConfig, in_serviceConfig);
    return updatedServiceConfig;
}

// ******************************

function unsetServiceConfigValue (in_serviceConfig, in_keyPath, in_options) {
    let opt = in_options || {};

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
    while (keyPathParts.length > 0) {
        keyPathPart = keyPathParts.shift();

        let keyPathPartArrayIndexMatch = keyPathPart.match(/^(.*)\[([0-9]+)\]$/);
        let keyPathPartArrayIndex = -1;

        if (keyPathPartArrayIndexMatch) {
            keyPathPart = keyPathPartArrayIndexMatch[1];
            keyPathPartArrayIndex = parseInt(keyPathPartArrayIndexMatch[2]);
        }

        if (keyPathParts.length === 0) {
            if (keyPathPartArrayIndex >= 0) {
                configSubObject[keyPathPart] = [];
                configSubObject[keyPathPart][keyPathPartArrayIndex] = false;
            } else {
                configSubObject[keyPathPart] = false;
            }
            break;
        }

        if (keyPathPartArrayIndex >= 0) {
            configSubObject[keyPathPart] = [];
            configSubObject[keyPathPart][keyPathPartArrayIndex] = {};
            configSubObject = configSubObject[keyPathPart][keyPathPartArrayIndex];
        } else {
            configSubObject[keyPathPart] = {};
            configSubObject = configSubObject[keyPathPart];
        }
    }

    removeServiceConfig(in_serviceConfig, removeConfig, opt);
}

// ******************************

function setServiceConfigValue (in_serviceConfig, in_keyPath, in_keyValue, in_options) {
    let opt = in_options || {};

    if (!in_keyPath) {
        cprint.yellow('Specify a key path to set, i.e service.name');
        return;
    }

    let keyPath = in_keyPath;
    let keyPathMatch = keyPath.match(/(.*?)[=:](.*)/);
    let keyValue = in_keyValue;
    if (keyPathMatch) {
        keyPath = keyPathMatch[1].trim();
        keyValue = keyPathMatch[2].trim();
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
    while (keyPathParts.length > 0) {
        keyPathPart = keyPathParts.shift();

        let keyPathPartArrayIndexMatch = keyPathPart.match(/^(.*)\[([0-9]+)\]$/);
        let keyPathPartArrayIndex = -1;

        if (keyPathPartArrayIndexMatch) {
            keyPathPart = keyPathPartArrayIndexMatch[1];
            keyPathPartArrayIndex = parseInt(keyPathPartArrayIndexMatch[2]);
        }

        if (keyPathParts.length === 0) {
            if (keyPathPartArrayIndex >= 0) {
                configSubObject[keyPathPart] = [];
                configSubObject[keyPathPart][keyPathPartArrayIndex] = keyValue;
            } else {
                configSubObject[keyPathPart] = keyValue;
            }
            break;
        }

        if (keyPathPartArrayIndex >= 0) {
            configSubObject[keyPathPart] = [];
            configSubObject[keyPathPart][keyPathPartArrayIndex] = {};
            configSubObject = configSubObject[keyPathPart][keyPathPartArrayIndex];
        } else {
            configSubObject[keyPathPart] = {};
            configSubObject = configSubObject[keyPathPart];
        }
    }

    updateServiceConfig(in_serviceConfig, updateConfig, opt);
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

    let keyValue;
    let keyPathPart;
    let configSubObject = serviceConfig;

    while (keyPathParts.length > 0) {
        keyPathPart = keyPathParts.shift();

        let keyPathPartArrayIndexMatch = keyPathPart.match(/^(.*)\[([0-9]+)\]$/);
        let keyPathPartArrayIndex = -1;

        if (keyPathPartArrayIndexMatch) {
            keyPathPart = keyPathPartArrayIndexMatch[1];
            keyPathPartArrayIndex = parseInt(keyPathPartArrayIndexMatch[2]);
        }

        if (keyPathParts.length === 0) {
            if (keyPathPartArrayIndex >= 0) {
                let configSubObjectArray = configSubObject[keyPathPart] || [];
                keyValue = configSubObjectArray[keyPathPartArrayIndex];
            } else {
                keyValue = configSubObject[keyPathPart];            
            }
            break;
        }

        if (keyPathPartArrayIndex >= 0) {
            let configSubObjectArray = configSubObject[keyPathPart] || [];
            configSubObject = configSubObjectArray[keyPathPartArrayIndex] || {};
        } else {
            configSubObject = configSubObject[keyPathPart] || {};
        }
    }

    if (typeof(keyValue) === 'object') {
        keyValue = JSON.stringify(keyValue, null, 4);
    }

    print.keyVal(keyPath, keyValue);
}

// ******************************
// Helper Functions:
// ******************************

function _upgradeServiceConfig (in_serviceConfig) {
    let serviceConfig = accessServiceConfig(in_serviceConfig, {
        schema_version: 'NUMBER'
    });

    let serviceConfigChanged;
    let newServiceConfig = in_serviceConfig;
    let requiresSave = false;

    let schemaVersion = serviceConfig.schema_version || 0;

    _checkSchemaVersion(schemaVersion);

    if (schemaVersion < 1) {
        serviceConfigChanged = _upgradeServiceConfigFrom0To1(newServiceConfig);
        if (serviceConfigChanged) {
            newServiceConfig = serviceConfigChanged;
            requiresSave = true;
        }
    }

    if (schemaVersion < 2) {
        serviceConfigChanged = _upgradeServiceConfigFrom1To2(newServiceConfig);
        if (serviceConfigChanged) {
            newServiceConfig = serviceConfigChanged;
            requiresSave = true;
        }
    }

    if (schemaVersion < 3) {
        serviceConfigChanged = _upgradeServiceConfigFrom2To3(newServiceConfig);
        if (serviceConfigChanged) {
            newServiceConfig = serviceConfigChanged;
            requiresSave = true;
        }
    }

    if (schemaVersion < 3.3) {
        serviceConfigChanged = _upgradeServiceConfigFrom3To3_3(newServiceConfig);
        if (serviceConfigChanged) {
            newServiceConfig = serviceConfigChanged;
            requiresSave = true;
        }
    }

    let scriptSchema = getServiceConfigSchemaUrl();
    let scriptSchemaVersion = getServiceConfigSchemaVersion();

    if (!schemaVersion || schemaVersion < scriptSchemaVersion) {
        newServiceConfig.schema_version = scriptSchemaVersion;
        newServiceConfig.$schema = scriptSchema;
        requiresSave = true;
    }

    if (requiresSave) {
        cprint.green('Updated service config');
        _saveServiceConfig(newServiceConfig);
    }

    return newServiceConfig;
}

// ******************************

function _checkSchemaVersion (in_configSchemaVersion) {
    let currentSchemaVersion = getServiceConfigSchemaVersion();
    if (parseInt(in_configSchemaVersion) > parseInt(currentSchemaVersion)) {
        cprint.red('You are running a majorly out of date servicerator, please update it with: npm install -g servicerator');
        process.exit(-1);
    }

    if (in_configSchemaVersion > currentSchemaVersion) {
        cprint.yellow('You are running a minorly out of date servicerator, please update it with: npm install -g servicerator');
    }
}

function _upgradeServiceConfigFrom0To1 (in_serviceConfig) {
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

function _upgradeServiceConfigFrom1To2 (in_serviceConfig) {
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

function _upgradeServiceConfigFrom2To3 (in_serviceConfig) {
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

    return hasBeenUpdated ? in_serviceConfig : false;
}

// ******************************

function _upgradeServiceConfigFrom3To3_3 (in_serviceConfig) {
    let hasBeenUpdated = false;

    if (in_serviceConfig.service.clusters) {
        in_serviceConfig.service.clusters.forEach(cluster => {
            if (!cluster.role) {
                cluster.role = 'ecsServiceRole';
                hasBeenUpdated = true;
            }
        });
    }

    return hasBeenUpdated ? in_serviceConfig : false;
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

function _checkObjectAgainstJSONSchema (in_path, in_obj, in_schema, in_warning) {
    let validate = require('jsonschema').validate;
    let validationResult = validate(in_obj, in_schema);

    let errors = validationResult.errors;
    if (errors && errors.length) {
        errors.forEach((error) => {
            if (in_warning) {
                cprint.yellow(in_path + ' > ' + error);
            } else {
                cprint.red(in_path + ' > ' + error);
            }
        });
        if (in_warning) {
            return false;
        } else {
            // process.exit(-1);
            return false;
        }
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

        if (!objVal || !objVal.match(/^([A-Za-z0-9 _:$.*-]*[/\\]?)*$/)) {
            cprint.yellow('Not a valid filesystem reference format (' + objVal + ') in path "' + in_path + '": ' + objVal);
            return;
        }
    }

    if (schemaVal === 'URL') {
        if (objValType !== 'string') {
            cprint.yellow('Found incorrect type (' + objValType + ') in path "' + in_path + '":');
            return;
        }

        if (!objVal || !objVal.match(/^https?:\/\/([A-Za-z0-9 _:$.*-]*[/\\]?)*$/)) {
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
        });
        return;
    }

    if (objValType === 'object') {
        return _checkObjectAgainstSchema(in_path, objVal, schemaVal, in_checkValueAsType, in_fullPath);
    }
}

// ******************************

function _convertToJSONSchema (in_value) {
    if (typeof(in_value) === 'string') {
        if (in_value === 'NUMBER') {
            return {
                'type': 'number'
            };
        } else if (in_value === 'STRING' || in_value === 'PATH' || in_value === 'URL') {
            return {
                'type': 'string'
            };
        } else if (in_value === 'BOOLEAN') {
            return {
                'type': 'boolean'
            };
        } else if (in_value === 'ANY') {
            return {
                'type': 'object'
            };
        }

    } else if (Array.isArray(in_value)) {
        let list = in_value;
        let firstItem = list[0];
        return {
            'type': 'array',
            'items': _convertToJSONSchema(firstItem)
        };

    } else if (typeof(in_value) === 'object') {
        let properties = {};
        for (let k in in_value) {
            let v = in_value[k];

            properties[k] = _convertToJSONSchema(v);
        }

        return {
            'type': 'object',
            'properties': properties
        };
    } else {
        cprint.red('Unknown value type:' + in_value);
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
