'use strict'; // JS: ES6

// ******************************
// Requires:
// ******************************

let cprint = require('color-print');

let date = require('./date');
let env = require('./env');
let exec = require('./exec');
let fs = require('./filesystem');
let hg = require('./mercurial');
let service = require('./service');

// ******************************
// Constants:
// ******************************

const k_STATE_UNKNOWN = 0;
const k_STATE_EXITED = 1;
const k_STATE_FAILED = 5;
const k_STATE_RUNNING = 10;

const k_TEST_TYPE_URL = 'URL';

const knownCmdErrors = [
    new RegExp(/WARNING: Error loading config file:.* - open .*: The process cannot access the file because it is being used by another process\./),
    new RegExp(/WARNING! Using --password via the CLI is insecure\. Use --password-stdin\./),
    new RegExp(/SECURITY WARNING: You are building a Docker image from Windows against a non-Windows Docker host\. All files and directories added to build context will have '-rwxr-xr-x' permissions\. It is recommended to double check and reset permissions for sensitive files and directories\./),
    new RegExp(/Error response from daemon: conflict: unable to delete .* \(cannot be forced\) - image has dependent child images/),
    new RegExp(/Error response from daemon: manifest for .* not found/),
    'Error response from daemon: invalid reference format'
];

// ******************************
// Globals:
// ******************************

let g_DOCKER_INSTALLED = undefined;
let g_DOCKER_RUNNING = undefined;

// ******************************
// Functions:
// ******************************

function getDockerFolder (in_sourceFolder) {
    let path = require('path');

    let sourceFolder = path.resolve(in_sourceFolder);
    if (!sourceFolder) {
        throw new Error('Source folder not set');
    }

    if (fs.fileExists(path.resolve(sourceFolder, 'Dockerfile'))) {
        return sourceFolder;
    }

    let dockerFolder = path.resolve(sourceFolder, 'docker');
    if (fs.fileExists(path.resolve(dockerFolder, 'Dockerfile'))) {
        return dockerFolder;
    }

    if (path.basename(sourceFolder) === 'docker') {
        dockerFolder = sourceFolder;
    }

    let dockerSubFolder = fs.folders(dockerFolder)
        .map(f => path.resolve(dockerFolder, f))
        .filter(fs.folderExists)
        .filter(fs.isFolder)
        .find(f => fs.fileExists(path.resolve(f, 'Dockerfile')));

    return dockerSubFolder;
}

// ******************************

function getDockerfile (in_sourceFolder) {
    let path = require('path');

    let sourceFolder = path.resolve(in_sourceFolder);
    if (!sourceFolder) {
        throw new Error('Source folder not set');
    }

    let dockerFolder = getDockerFolder(in_sourceFolder);
    if (!dockerFolder) {
        return false;
    }

    let dockerfile = path.resolve(dockerFolder, 'Dockerfile');
    return dockerfile;
}

// ******************************

function getDefaultDockerRepositoryStore () {
    return 'index.docker.io';
}

// ******************************

function getDockerPassword (in_serviceConfig) {
    let serviceConfig = service.accessConfig(in_serviceConfig, {
        docker: {
            password: 'STRING'
        }
    });

    let dockerUsername = getDockerUsername(in_serviceConfig);
    if (!dockerUsername) {
        throw new Error('Docker Image username not set');
    }

    let dockerPassword = serviceConfig.docker.password;

    if (!dockerUsername) {
        throw new Error('Docker username not set');
    }

    if (!dockerPassword) {
        dockerPassword = env.getStoredPassword('docker', dockerUsername);
    }

    return dockerPassword;
}

// ******************************

function getDockerUsername (in_serviceConfig) {
    let serviceConfig = service.accessConfig(in_serviceConfig, {
        docker: {
            username: 'STRING'
        }
    });

    let dockerUsername = serviceConfig.docker.username;
    if (!dockerUsername) {
        dockerUsername = env.getStoredValue('docker_trademe_username');
    }

    return dockerUsername;
}

// ******************************

function getDockerImageTags (in_serviceConfig, in_options) {
    let serviceConfig = service.accessConfig(in_serviceConfig, {
        model: {
            version: 'STRING',
            dynamic: 'BOOLEAN'
        },
        corpus: {
            version: 'STRING'
        },
        docker: {
            image: {
                version: 'STRING',
                tags: [
                    'STRING'
                ],
                tag_with_date: 'BOOLEAN'
            }
        }
    });

    let opts = in_options || {};

    let dockerImageTags = [];

    let dockerImageVersion = serviceConfig.docker.image.version;
    if (dockerImageVersion) {
        let dockerImageVersionTag = dockerImageVersion;
        if (dockerImageTags.indexOf(dockerImageVersionTag) < 0) {
            dockerImageTags.push(dockerImageVersionTag);
        }
    }

    if (serviceConfig.docker.image.tag_with_date) {
        let dockerImageDateTag = date.getTag();
        if (dockerImageTags.indexOf(dockerImageDateTag) < 0) {
            dockerImageTags.push(dockerImageDateTag);
        }
    }

    let modelVersion = serviceConfig.model.version;
    let modelDynamic = serviceConfig.model.dynamic;
    if (modelDynamic) {
        let modelVersionTag = 'model-version-dynamic';
        if (dockerImageTags.indexOf(modelVersionTag) < 0) {
            dockerImageTags.push(modelVersionTag);
        }
    } else if (modelVersion) {
        let modelVersionTag = 'model-version-' + modelVersion;
        if (dockerImageTags.indexOf(modelVersionTag) < 0) {
            dockerImageTags.push(modelVersionTag);
        }
    }

    let corpusVersion = serviceConfig.corpus.version;
    if (corpusVersion) {
        let corpusVersionTag = 'corpus-version-' + corpusVersion;
        if (dockerImageTags.indexOf(corpusVersionTag) < 0) {
            dockerImageTags.push(corpusVersionTag);
        }
    }

    if (dockerImageTags.indexOf('latest') < 0) {
        dockerImageTags.push('latest');
    }

    dockerImageTags = dockerImageTags.concat(serviceConfig.docker.image.tags || []);
    if (opts.includeVersionControlTags) {
        dockerImageTags = dockerImageTags.concat(_getDockerImageVersionControlTags(in_serviceConfig) || []);
    }

    return dockerImageTags;
}

// ******************************

function getDockerLoggedInRepositoryStores () {
    let path = require('path');

    let userExplorerHome = env.getUserExplorerHome();
    if (!userExplorerHome || !fs.folderExists(userExplorerHome)) {
        throw new Error('User home folder doesn\'t exist');
    }

    let dockerLoginConfigFile = path.resolve(userExplorerHome, '.docker', 'config.json');
    let dockerLoginConfig = require(dockerLoginConfigFile);

    let auths = dockerLoginConfig.auths || {};
    let authKeys = Object.keys(auths)
        .map(authKey => {
            return authKey.replace(/(https?:\/\/)([^/]*)(\/.*)/, '$2');
        });

    return authKeys;
}

// ******************************

function getDockerImageExecTask (in_dockerUsername, in_dockerPassword, in_dockerImagePath, in_dockerRepositoryStore, in_cmd, in_forceLogin) {
    return (in_onSuccess) => {
        if (!in_dockerUsername) {
            throw new Error('Docker repository username not set');
        }

        if (!in_dockerPassword) {
            throw new Error('Docker repository password not set');
        }

        if (!isDockerLoggedIn(in_dockerRepositoryStore) || in_forceLogin) {
            dockerLogin(in_dockerUsername, in_dockerPassword, in_dockerRepositoryStore);
        }

        if (!in_cmd || !in_cmd.displayName || !in_cmd.value) {
            throw new Error('Invalid command: ' + in_cmd);
        }

        cprint.cyan(in_cmd.displayName + ' Docker image "' + in_dockerImagePath + '" for service...');
        let args = [in_cmd.value];
        args = args.concat(in_dockerImagePath);
        dockerCmd(args, {
            async: true,
            asyncCb: (success) => {
                if (success) {
                    if (in_onSuccess) {
                        in_onSuccess();
                    }
                    return;
                }
            },
            asyncErrorCb: (error) => {
                if (in_forceLogin) {
                    if (in_onSuccess) {
                        in_onSuccess();
                    }
                    return;
                }

                if (error && error.match(/denied:.*/)) {
                    cprint.yellow('Docker push denied, trying again with logging in first');
                    let task = getDockerImageExecTask(in_dockerUsername, in_dockerPassword, in_dockerImagePath, in_dockerRepositoryStore, in_cmd, true);
                    task();
                    return;
                }

                if (in_onSuccess) {
                    in_onSuccess();
                }
                return;
            }
        });
    };
}

// ******************************

function isDockerLoggedIn (in_repositoryStore) {
    let repositoryStores = getDockerLoggedInRepositoryStores() || [];
    return repositoryStores.indexOf(in_repositoryStore) >= 0;
}

// ******************************

function dockerLogin (in_username, in_password, in_repositoryStore) {
    _assertDockerIsInstalled();

    if (!in_username) {
        throw new Error('Docker username not set');
    }

    if (!in_password) {
        throw new Error('Docker password not set');
    }

    let repositoryStore = in_repositoryStore || getDefaultDockerRepositoryStore();
    let args = ['login', '-u', in_username, '-p', in_password, repositoryStore];
    cprint.cyan('Logging into docker...');
    let cmdResult = dockerCmd(args);

    if (cmdResult.hasError) {
        cmdResult.throwError();
    } else {
        cmdResult.printResult();
    }
    return !cmdResult.hasError;
}

// ******************************

function dockerInfo () {
    _assertDockerIsInstalled();

    let cmdResult = dockerCmd(['info'], {
        hide: true
    });

    if (cmdResult.hasError) {
        cmdResult.throwError();
        return false;
    }

    return cmdResult.result;
}

// ******************************

function dockerCmd (in_args, in_options) {
    let options = in_options || {};
    let hide = options.hide;
    let async = options.async;
    let asyncCb = options.asyncCb;
    let asyncErrorCb = options.asyncErrorCb;

    _assertDockerIsInstalled();

    let args = in_args;
    if (!args) {
        return false;
    }

    if (!Array.isArray(args)) {
        args = [args];
    }

    if (async) {
        return exec.cmd('docker', args, {
            indent: '  ',
            hide: hide,
            knownErrors: knownCmdErrors,
            doneCb: asyncCb,
            errorCb: asyncErrorCb
        });
    }

    return exec.cmdSync('docker', args, {
        indent: '  ',
        hide: hide,
        errToOut: false,
        knownErrors: knownCmdErrors
    });
}

// ******************************

function dockerInstalled () {
    if (g_DOCKER_INSTALLED === undefined) {
        g_DOCKER_INSTALLED = !!dockerVersion();
    }
    return g_DOCKER_INSTALLED;
}

// ******************************

function dockerRunning () {
    if (g_DOCKER_RUNNING === undefined) {
        g_DOCKER_RUNNING = !!dockerRunningCommand();
    }
    return g_DOCKER_RUNNING;
}

// ******************************

function dockerVersion () {
    let cmdResult = exec.cmdSync('docker', ['--version'], {
        indent: '',
        hide: true
    });

    if (cmdResult.hasError) {
        return false;
    } else {
        return cmdResult.result;
    }
}

// ******************************

function dockerRunningCommand () {
    let cmdResult = exec.cmdSync('docker', ['info'], {
        indent: '',
        hide: true
    });

    if (cmdResult.hasError) {
        return false;
    } else {
        return cmdResult.result;
    }
}

// ******************************
// Helper Functions:
// ******************************

function _assertDockerIsInstalled () {
    if (!dockerInstalled()) {
        throw new Error('Docker isn\'t installed');
    }
}

// ******************************

function _getDockerImageVersionControlTags (in_serviceConfig) {
    let serviceConfig = service.accessConfig(in_serviceConfig, {
        docker: {
            image: {
                tag_with_branch: 'BOOLEAN',
                tag_with_revision: 'BOOLEAN'
            }
        },
        version_control: {
            type: 'STRING',
            root_folder: 'STRING'
        }
    });

    let dockerImageTags = [];

    if (serviceConfig.docker.image.tag_with_branch) {
        if (serviceConfig.version_control.type === 'mercurial') {

            let hgRootFolder = hg.getRootFolder(in_serviceConfig);
            if (!hgRootFolder) {
                return;
            }

            let cmdResult = hg.cmd(['-R', hgRootFolder, 'branch'], {
                hide: true
            });

            if (cmdResult.hasError) {
                cmdResult.throwError();
                return;
            }

            let hgBranch = cmdResult.result;
            if (!hgBranch) {
                return;
            }

            hgBranch = hgBranch.trim();
            dockerImageTags.push(hgBranch);
        }
    }

    if (serviceConfig.docker.image.tag_with_revision) {
        if (serviceConfig.version_control.type === 'mercurial') {

            let hgRootFolder = hg.getRootFolder(in_serviceConfig);
            if (!hgRootFolder) {
                return;
            }

            let cmdResult = hg.cmd(['-R', hgRootFolder, 'id', '-i'], {
                hide: true
            });

            if (cmdResult.hasError) {
                cmdResult.throwError();
                return;
            }

            let hgChangeSet = cmdResult.result;
            if (!hgChangeSet) {
                return;
            }

            hgChangeSet = hgChangeSet.trim().replace(/\+$/,'');
            dockerImageTags.push(hgChangeSet);
        }
    }

    return dockerImageTags;
}

// ******************************
// Exports:
// ******************************

module.exports['k_STATE_UNKNOWN'] = k_STATE_UNKNOWN;
module.exports['k_STATE_RUNNING'] = k_STATE_RUNNING;
module.exports['k_STATE_FAILED'] = k_STATE_FAILED;
module.exports['k_STATE_EXITED'] = k_STATE_EXITED;

module.exports['k_TEST_TYPE_URL'] = k_TEST_TYPE_URL;

module.exports['cmd'] = dockerCmd;
module.exports['getDefaultRepositoryStore'] = getDefaultDockerRepositoryStore;
module.exports['getDockerfile'] = getDockerfile;
module.exports['getFolder'] = getDockerFolder;
module.exports['getImageExecTask'] = getDockerImageExecTask;
module.exports['getImageTags'] = getDockerImageTags;
module.exports['getLoggedInRepositoryStores'] = getDockerLoggedInRepositoryStores;
module.exports['getPassword'] = getDockerPassword;
module.exports['getUsername'] = getDockerUsername;
module.exports['info'] = dockerInfo;
module.exports['installed'] = dockerInstalled;
module.exports['isLoggedIn'] = isDockerLoggedIn;
module.exports['login'] = dockerLogin;
module.exports['running'] = dockerRunning;
module.exports['version'] = dockerVersion;

// ******************************
