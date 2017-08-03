'use strict'; // JS: ES6

// ******************************
// Requires:
// ******************************

let cprint = require('color-print');
let path = require('path');

let date = require('./date');
let env = require('./env');
let exec = require('./exec');
let fs = require('./filesystem');
let test = require('./test');

// ******************************
// Constants:
// ******************************

const k_REPO_TYPE_AWS = 'AWS';
const k_REPO_TYPE_DEFAULT = 'DEFAULT';

const k_STATE_UNKNOWN = 0;
const k_STATE_EXITED = 1;
const k_STATE_FAILED = 5;
const k_STATE_RUNNING = 10;

// ******************************
// Globals:
// ******************************

let g_DOCKER_INSTALLED = undefined;

// ******************************
// Functions:
// ******************************

function getDockerfileContents (in_serviceConfig) {
    let serviceConfig = in_serviceConfig || {};
    let serviceConfigDocker = serviceConfig.docker || {};
    let serviceConfigDockerImage = serviceConfigDocker.image || {};
    let serviceConfigService = serviceConfig.service || {};

    let baseImage = serviceConfigDockerImage.base || 'ubuntu:trusty';
    let envVariables = serviceConfigDockerImage.env_variables || [];
    let imagePorts = serviceConfigDockerImage.ports || [];
    let scripts = (serviceConfigDockerImage.scripts || []);

    let enableS3cmd = serviceConfigDockerImage.s3cmd;
    let enableAuth = serviceConfigDockerImage.auth;

    let aptGetPackages = serviceConfigDockerImage.apt_get_packages || [];
    let aptGetUpdate = serviceConfigDockerImage.apt_get_update || false;
    let pipPackages = serviceConfigDockerImage.pip_packages || [];
    let pipUpdate = serviceConfigDockerImage.pip_update || false;
    let condaPackages = serviceConfigDockerImage.conda_packages || [];
    let condaChannels = serviceConfigDockerImage.conda_channels || [];
    let condaUpdate = serviceConfigDockerImage.conda_update || false;
    let filesystem = serviceConfigDockerImage.filesystem || [];
    let commands = serviceConfigDockerImage.commands || [];
    let workdir = serviceConfigDockerImage.work_directory || '.';

    let firstFilesystem = [];
    let firstEnvVariables = [];

    if (serviceConfigService.name) {
        firstEnvVariables.push({
            key: 'SERVICE_NAME',
            val: serviceConfigService.name
        });
    }

    firstEnvVariables.push({
        key: 'BASE_DIR',
        val: workdir
    });

    if (scripts.length) {
        let dockerScriptsDir = '$BASE_DIR/scripts';
        firstEnvVariables.push({
            key: 'SCRIPTS_DIR',
            val: dockerScriptsDir
        });
        scripts.forEach(s => {
            let scriptKey = s.name.toUpperCase().replace(/[-]/,'_') + '_FILE';
            let scriptPath = '$SCRIPTS_DIR/' + s.name + fs.getExtensionForType(s.language);
            firstEnvVariables.push({
                key: scriptKey,
                val: scriptPath
            });
            s.key = '$' + scriptKey
        });

        firstFilesystem.push(
            {
                'path': '$SCRIPTS_DIR',
                'type': 'folder'
            }
        );
    }

    if (serviceConfig.model && !serviceConfig.model.disableAutoPopulate) {
        firstEnvVariables.push({
            key: 'MODEL_DIR',
            val: '$BASE_DIR/model'
        });

        firstFilesystem.push(
            {
                'path': '$MODEL_DIR',
                'type': 'folder'
            }
        );

        if (serviceConfig.model.type === 'bundled' && serviceConfig.model.source) {
            firstFilesystem.push(
                {
                    'source': `${serviceConfig.model.source}`,
                    'destination': '$MODEL_DIR',
                    'type': 'copy_folder'
                }
            );
        } else if (serviceConfig.model.source) {
            firstFilesystem.push(
                {
                    'source': `${serviceConfig.model.source}`,
                    'destination': '$MODEL_DIR',
                    'type': 'link'
                }
            );
        }
    }

    if (serviceConfig.auth && !serviceConfig.auth.disableAutoPopulate) {
        firstEnvVariables.push({
            key: 'AUTH_DIR',
            val: '$BASE_DIR/auth'
        });

        firstFilesystem.push(
            {
                'path': '$AUTH_DIR',
                'type': 'folder'
            }
        );

        if (serviceConfig.auth.type === 'self-signed' && serviceConfig.auth.certificate && serviceConfig.auth.key) {
            firstFilesystem.push(
                {
                    'source': `${serviceConfig.auth.certificate}`,
                    'destination': '$AUTH_DIR',
                    'type': 'copy_file'
                }
            );
            firstFilesystem.push(
                {
                    'source': `${serviceConfig.auth.key}`,
                    'destination': '$AUTH_DIR',
                    'type': 'copy_file'
                }
            );
        }
    }

    let enableNginx = false;
    if (serviceConfigDockerImage.nginx) {
        enableNginx = true;
        aptGetPackages.push('nginx');
    }

    if (serviceConfigDockerImage.language === 'python') {
        firstEnvVariables.push({
            key: 'PYTHON_DIR',
            val: '$BASE_DIR/python'
        });

        firstFilesystem.push(
            {
                'path': '$PYTHON_DIR',
                'type': 'folder'
            }
        );
        firstFilesystem.push(
            {
                'source': 'python',
                'destination': '$PYTHON_DIR',
                'type': 'copy_folder'
            }
        );
    } else if (serviceConfigDockerImage.language === 'node') {
        firstEnvVariables.push({
            key: 'NODE_DIR',
            val: '$BASE_DIR/node'
        });

        firstFilesystem.push(
            {
                'path': '$NODE_DIR',
                'type': 'folder'
            }
        );
        firstFilesystem.push(
            {
                'source': 'node',
                'destination': '$NODE_DIR',
                'type': 'copy_folder'
            }
        );
    }

    filesystem = firstFilesystem.concat(filesystem);
    envVariables = _uniqueByField(firstEnvVariables.concat(envVariables));

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
        `# ----------------------`].join('\n') +
    (envVariables.length ?
        '\n\n' + envVariables.map(v => `    ENV ${v.key} "${v.val}"`).join('\n') : ''
    ) +
    (imagePorts.length ?
        '\n\n' + imagePorts.map(p => `    EXPOSE ${p}`).join('\n') : ''
    ) +
    (workdir !== './' && workdir !== '.' ?
        [
            ``,
            ``,
            `# ----------------------`,
            `#`,
            `# WORKDIR`,
            `#`,
            `# ----------------------`,
            ``,
            `    WORKDIR $BASE_DIR`].join('\n') : '') +
    (aptGetPackages.length ?
        [
            ``,
            ``,
            `# ----------------------`,
            `#`,
            `# APT-GET PACKAGES`,
            `#`,
            `# ----------------------`,
            ``,
            `    RUN ${aptGetUpdate ? 'apt-get update -y && apt-get upgrade -y && ' : ''}apt-get install -y \\`,
            ``].join('\n') +
        aptGetPackages
            .map(p => {
                return `        "${p}"`;
            }).join(' \\\n')
        : '') +
    (pipPackages.length ?
        [
            ``,
            ``,
            `# ----------------------`,
            `#`,
            `# PIP PACKAGES`,
            `#`,
            `# ----------------------`,
            ``,
            `    RUN ${pipUpdate ? 'pip install pip --upgrade && ' : ''}pip install \\`,
            ``].join('\n') +
        pipPackages
            .map(p => {
                return `        "${p}"`;
            }).join(' \\\n')
        : '') +
    (condaChannels.length ?
        [
            ``,
            ``,
            `# ----------------------`,
            `#`,
            `# CONDA CHANNELS`,
            `#`,
            `# ----------------------`,
            ``,
            ``].join('\n') +
        condaChannels
            .map(c => {
                return `    RUN conda config --add channels "${c}"`;
            }).join(' \\\n')
        : '') +
    (condaPackages.length ?
        [
            ``,
            ``,
            `# ----------------------`,
            `#`,
            `# CONDA PACKAGES`,
            `#`,
            `# ----------------------`,
            ``,
            `    RUN conda install -y \\`,
            ``].join('\n') +
        condaPackages
            .map(p => {
                return `        "${p}"`;
            }).join(' \\\n')
        : '') +
    (commands.length ?
        [
            ``,
            ``,
            `# ----------------------`,
            `#`,
            `# OTHER`,
            `#`,
            `# ----------------------`,
            ``,
            ``].join('\n') + commands.map(c => `    RUN ${c}`).join('\n')
        : '') +
    (enableNginx ?
        [
            ``,
            ``,
            `# ----------------------`,
            `#`,
            `# NGINX`,
            `#`,
            `# ----------------------`,
            ``,
            `    RUN rm -v /etc/nginx/nginx.conf`,
            `    ADD nginx.conf /etc/nginx/`].join('\n') : '') +
    (filesystem.length ?
        [
            ``,
            ``,
            `# ----------------------`,
            `#`,
            `# FILESYSTEM`,
            `#`,
            `# ----------------------`,
            ``,
            ``].join('\n') +
        filesystem
            .map(f => {
                if (f.type === 'folder') {
                    let command = `    RUN mkdir -p "${f.path}"`;

                    if (f.permissions) {
                        command += ` && chmod ${f.permissions} "${f.path}"`;
                    }

                    return command;
                } else if (f.type === 'copy_folder') {
                    return `    COPY "${f.source}" "${f.destination}"`;
                } else if (f.type === 'copy_file') {
                    return `    COPY "${f.source}" "${f.destination}"`;
                } else if (f.type === 'file') {
                    let command = `    RUN touch "${f.path}"`;

                    if (f.permissions) {
                        command += ` && chmod ${f.permissions} "${f.path}"`;
                    }

                    if (f.contents && f.contents.length) {
                        command += '\n    RUN \\' +
                        f.contents
                            .map(c => `\n        echo "${c}" >> "${f.path}"`)
                            .join(' && \\');
                    }

                    return command;
                } else if (f.type === 'link') {
                    return `    RUN ln -s "${f.source}" "${f.destination}"`;
                }
            }).join('\n')
        : '') +
    (scripts.length ?
        [
            ``,
            ``,
            `# ----------------------`,
            `#`,
            `# GENERATE SCRIPTS`,
            `#`,
            `# ----------------------`,
            ``,
            ].join('\n') +

        scripts
            .map(s => {
                if (s.language === 'bash') {
                    return [
                        ``,
                        `    RUN touch ${s.key} && chmod +x ${s.key}`,
                        `    RUN \\`,
                        `        echo "#! /bin/bash" > ${s.key} && \\`,
                    ].join('\n') +
                    s.commands
                        .map(c => `\n        echo "${c}" >> ${s.key}`)
                        .join(' && \\');
                }
            }).join('\n')
        : '') +
    (scripts
        .filter(s => s.language === 'bash')
        .filter(s => s.cmd)
        .map(s => {
            return [
                ``,
                ``,
                `# ----------------------`,
                `#`,
                `# BASH CMD`,
                `#`,
                `# ----------------------`,
                ``,
                `    CMD ${s.key}`,
                ``].join('\n');
        })[0] || '') +
    '\n';
}

// ******************************

function getDockerFolder (in_sourceFolder) {
    let sourceFolder = path.resolve(in_sourceFolder);
    if (!sourceFolder) {
        cprint.yellow('Source folder not set');
        return;
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
    let sourceFolder = path.resolve(in_sourceFolder);
    if (!sourceFolder) {
        cprint.yellow('Source folder not set');
        return;
    }

    let dockerFolder = getDockerFolder(in_sourceFolder);
    if (!dockerFolder) {
        return false;
    }

    let dockerfile = path.resolve(dockerFolder, 'Dockerfile');
    return dockerfile;
}

// ******************************

function parseDockerfile (in_dockerFile) {
    let dockerfileContents = fs.readFile(in_dockerFile);
    return parseDockerfileContents(dockerfileContents);
}

// ******************************

function parseDockerfileContents (in_dockerFileContents) {
    let serviceConfig = {};
    let dockerFileContentsLines = in_dockerFileContents.split(/(?:\n)|(?:\r\n?)/);

    dockerFileContentsLines.forEach(l => {
        let fromMatch = l.match(/^ *FROM (.*)$/);
        if (fromMatch) {
            serviceConfig.docker = serviceConfig.docker || {};
            serviceConfig.docker.image = serviceConfig.docker.image || {};
            serviceConfig.docker.image.base = fromMatch[1];
        }
    });

    return serviceConfig;
}

// ******************************

function getIgnoreDockerContents (in_serviceConfig) {
    let serviceConfig = in_serviceConfig || {};
    let serviceConfigDocker = serviceConfig.docker || {};
    let serviceConfigDockerImage = serviceConfigDocker.image || {};
    let serviceConfigDockerBuild = serviceConfigDocker.build || {};

    let ignoreFiles = [];

    if (serviceConfigDockerImage.language === 'node') {
        ignoreFiles.push('node/node_modules/*');
    }

    if (serviceConfigDockerImage.language === 'python') {
        ignoreFiles.push('*.pyc');
    }

    if (serviceConfigDockerImage.log) {
        ignoreFiles.push('logs/*');
    }

    if (serviceConfigDockerBuild.language === 'bash') {
        ignoreFiles.push('setup-aws-infrastructure.sh');
        ignoreFiles.push('create-docker-image.sh');
        ignoreFiles.push('_env.sh');
    }

    if (serviceConfig.model) {
        ignoreFiles.push('model/*');
    }

    return ignoreFiles.join('\n');
}

// ******************************

function getDefaultDockerRepository () {
  return 'docker.io';
}

// ******************************

function getDockerPassword (in_serviceConfig) {
    let serviceConfig = in_serviceConfig || {};
    let serviceConfigDocker = serviceConfig.docker || {};

    let dockerUsername = serviceConfigDocker.username;
    let dockerPassword = serviceConfigDocker.password;

    if (!dockerUsername) {
        cprint.yellow('Docker username not set');
        return false;
    }

    if (!dockerPassword) {
        dockerPassword = env.getStoredPassword('docker', dockerUsername);
    }

    return dockerPassword;
}

// ******************************

function getDockerImageTags (in_serviceConfig) {
    let serviceConfig = in_serviceConfig || {};
    let serviceConfigModel = serviceConfig.model || {};
    let serviceConfigCorpus = serviceConfig.corpus || {};
    let serviceConfigDocker = serviceConfig.docker || {};
    let serviceConfigDockerImage = serviceConfigDocker.image || {};

    let dockerImageTags = serviceConfigDockerImage.tags || [];

    let dockerImageVersion = serviceConfigDockerImage.version;
    if (dockerImageVersion) {
        let dockerImageVersionTag = dockerImageVersion;
        if (dockerImageTags.indexOf(dockerImageVersionTag) < 0) {
            dockerImageTags.push(dockerImageVersionTag);
        }
    }

    if (serviceConfigDockerImage.tag_with_date) {
        let dockerImageDateTag = date.getTag();
        if (dockerImageTags.indexOf(dockerImageDateTag) < 0) {
            dockerImageTags.push(dockerImageDateTag);
        }
    }

    let modelVersion = serviceConfigModel.version;
    if (modelVersion) {
        let modelVersionTag = 'model-version-' + modelVersion;
        if (dockerImageTags.indexOf(modelVersionTag) < 0) {
            dockerImageTags.push(modelVersionTag);
        }
    }

    let corpusVersion = serviceConfigCorpus.version;
    if (corpusVersion) {
        let corpusVersionTag = 'corpus-version-' + corpusVersion;
        if (dockerImageTags.indexOf(corpusVersionTag) < 0) {
            dockerImageTags.push(corpusVersionTag);
        }
    }

    if (dockerImageTags.indexOf('latest') < 0) {
        dockerImageTags.push('latest');
    }

    return dockerImageTags;
}

// ******************************

function dockerLogin (in_username, in_password, in_repository) {
    if (!dockerInstalled()) {
        cprint.yellow('Docker isn\'t installed');
        return false;
    }

    if (!in_username) {
        cprint.yellow('Docker username not set');
        return false;
    }

    if (!in_password) {
        cprint.yellow('Docker password not set');
        return false;
    }

    let repository = in_repository || getDefaultDockerRepository();
    let args = ['login', '-u', in_username, '-p', in_password, repository];
    cprint.cyan('Logging into docker...');
    let cmdResult = dockerCmd(args);
    if (cmdResult.hasError) {
        cmdResult.printError();
    } else {
        cmdResult.printResult();
    }
    return !cmdResult.hasError;
}

// ******************************

function dockerInfo () {
    if (!dockerInstalled()) {
        cprint.yellow('Docker isn\'t installed');
        return false;
    }

    let args = ['info'];
    let cmdResult = dockerCmd(args);
    if (cmdResult.hasError) {
        cmdResult.printError();
        return false;
    }
    return cmdResult.results;
}

// ******************************

function dockerCmd (in_args, in_hide) {
    if (!dockerInstalled()) {
        cprint.yellow('Docker isn\'t installed');
        return false;
    }

    if (!in_args) {
        return false;
    }

    if (!Array.isArray(in_args)) {
        in_args = [in_args]
    }

    return exec.cmdSync('docker', in_args, '  ', !in_hide);
}

// ******************************

function dockerInstalled () {
    if (g_DOCKER_INSTALLED === undefined) {
        g_DOCKER_INSTALLED = !!dockerVersion();
    }
    return g_DOCKER_INSTALLED;
}

// ******************************

function dockerVersion () {
    let cmdResult = exec.cmdSync('docker', ['--version'], '', false);
    if (cmdResult.hasError) {
        return false;
    } else {
        return cmdResult.result;
    }
}

// ******************************
// Helper Functions:
// ******************************

function _uniqueByField (in_collection, in_key) {
    if (!in_collection || !in_collection.length) {
        return [];
    }
    let key = in_key || 'key';

    let sortByKey = {};
    in_collection
        .forEach(obj => {
            let keyVal = obj[key];
            sortByKey[keyVal] = obj;
        });

    return Object.keys(sortByKey)
        .filter((elem, pos, self) => { return self.indexOf(elem) === pos; })
        .map(k => sortByKey[k]);
}

// ******************************
// Exports:
// ******************************

module.exports['k_REPO_TYPE_AWS'] = k_REPO_TYPE_AWS;
module.exports['k_REPO_TYPE_DEFAULT'] = k_REPO_TYPE_DEFAULT;

module.exports['k_STATE_UNKNOWN'] = k_STATE_UNKNOWN;
module.exports['k_STATE_RUNNING'] = k_STATE_RUNNING;
module.exports['k_STATE_FAILED'] = k_STATE_FAILED;
module.exports['k_STATE_EXITED'] = k_STATE_EXITED;

module.exports['login'] = dockerLogin;
module.exports['installed'] = dockerInstalled;
module.exports['version'] = dockerVersion;
module.exports['info'] = dockerInfo;
module.exports['cmd'] = dockerCmd;
module.exports['parseDockerfile'] = parseDockerfile;
module.exports['parseDockerfileContents'] = parseDockerfileContents;
module.exports['getFolder'] = getDockerFolder;
module.exports['getDockerfile'] = getDockerfile;
module.exports['getPassword'] = getDockerPassword;
module.exports['getImageTags'] = getDockerImageTags;
module.exports['getDefaultRepository'] = getDefaultDockerRepository;
module.exports['getDockerfileContents'] = getDockerfileContents;
module.exports['getIgnoreDockerContents'] = getIgnoreDockerContents;

// ******************************
