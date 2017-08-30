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
let service = require('./service');

// ******************************
// Constants:
// ******************************

const k_REPO_TYPE_AWS = 'AWS';
const k_REPO_TYPE_DEFAULT = 'DEFAULT';

const k_STATE_UNKNOWN = 0;
const k_STATE_EXITED = 1;
const k_STATE_FAILED = 5;
const k_STATE_RUNNING = 10;

const k_TEST_TYPE_URL = 'URL';

const knownCmdErrors = [
    new RegExp(/WARNING: Error loading config file:.* - open .*: The process cannot access the file because it is being used by another process./),
    new RegExp(/Error response from daemon: conflict: unable to delete .* \(cannot be forced\) - image has dependent child images/),
    new RegExp(/Error response from daemon: manifest for .* not found/),
    'Error response from daemon: invalid reference format'
];

// ******************************
// Globals:
// ******************************

let g_WINPTY_INSTALLED = undefined;

let g_DOCKER_INSTALLED = undefined;
let g_DOCKER_RUNNING = undefined;

// ******************************
// Functions:
// ******************************

function getDockerfileContents (in_serviceConfig) {
    let serviceConfig = service.accessConfig(in_serviceConfig, {
        auth: {
            type: 'STRING',
            certificate: 'PATH',
            key: 'PATH'
        },
        model: {
            type: 'STRING',
            source: 'STRING'
        },
        docker: {
            image: {
                base: 'STRING',
                working_directory: 'PATH',
                nginx: 'ANY',
                language: 'STRING',
                env_variables: [
                    {
                        key: 'STRING',
                        val: 'STRING'
                    }
                ],
                scripts: [
                    {
                        key: 'STRING',
                        cmd: 'BOOLEAN',
                        contents: [
                            'STRING'
                        ],
                        name: 'STRING',
                        language: 'STRING'
                    }
                ],

                operations: [
                    {
                        type: 'STRING',
                        packages_source: 'STRING',
                        contents: [
                            'STRING'
                        ],
                        packages: [
                            'STRING'
                        ],
                        channels: [
                            'STRING'
                        ],
                        description: 'STRING',
                        commands: [
                            'STRING'
                        ],
                        update: 'BOOLEAN',
                        destination: 'PATH',
                        path: 'PATH',
                        source: 'PATH',
                        permissions: 'STRING'
                    },
                ]
            },
            container: {
                ports: [
                    {
                        "container": 'NUMBER',
                        "description": 'STRING'
                    }
                ]
            }
        },
        service: {
            name: 'STRING'
        }
    });

    let baseImage = serviceConfig.docker.image.base || 'ubuntu:trusty';
    let envVariables = serviceConfig.docker.image.env_variables || [];
    let imagePorts = (serviceConfig.docker.container.ports || []);
    let scripts = (serviceConfig.docker.image.scripts || []);

    let generateScripts = scripts
        .filter(s => (s.language && s.contents && s.contents.length));

    let operations = serviceConfig.docker.image.operations || [];
    let workdir = serviceConfig.docker.image.working_directory || '.';

    let enableNginx = false;

    if (serviceConfig.docker.image.nginx) {
        enableNginx = true;
    }

    let exposedPorts = [];
    let exposePortsLines = [];

    imagePorts
        .forEach(p => {
            if (exposedPorts.indexOf(p.container) >= 0) {
                return;
            }

            exposedPorts.push(p.container);
            if (p.description) {
                exposePortsLines.push(`# ${p.description}`);
            }
            exposePortsLines.push(`EXPOSE ${p.container}\n`);
        });

    return [
        `# ----------------------`,
        `#`,
        `# BASE`,
        `#`,
        `# ----------------------`,
        ``,
        `    FROM ${baseImage}`].join('\n') +
    (envVariables.length || exposePortsLines.length ?
        [
            ``,
            ``,
            `# ----------------------`,
            `#`,
            `# ENVIRONMENT`,
            `#`,
            `# ----------------------`].join('\n') : ''
    ) +
    (envVariables.length ?
        '\n\n' + envVariables.map(v => `    ENV ${v.key} "${v.val}"`).join('\n') : ''
    ) +
    (exposePortsLines.length ?
        '\n\n    ' + exposePortsLines.join('\n    ') : ''
    ) +
    (workdir !== './' && workdir !== '.' && envVariables.filter(v => v.key === 'BASE_DIR').length ?
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
    (operations.length ?
        [
            ``,
            ``,
            `# ----------------------`,
            `#`,
            `# OPERATIONS`,
            `#`,
            `# ----------------------`,
            ``].join('\n') +
        operations
            .map(f => {
                let description = f.description || false;

                if (f.type === 'packages') {
                    description = description || `Install ${f.packages_source} packages...`;
                    let command = `\n    # ${description}\n`;

                    switch (f.packages_source) {
                        case 'conda':
                            command += f.channels
                                .map(c => {
                                    return `    RUN conda config --add channels "${c}"`;
                                }).join(' \\\n') + `\n`;
                            command += `    RUN conda install -y \\\n`;
                            command += f.packages
                                .map(p => {
                                    return `        "${p}"`;
                                }).join(' \\\n');
                            break;

                        case 'pip':
                            command += `    RUN ${f.update ? 'pip install pip --upgrade && ' : ''}pip install \\\n`;
                            command += f.packages
                                .map(p => {
                                    return `        "${p}"`;
                                }).join(' \\\n');
                            break;

                        case 'npm':
                            command += `    RUN npm install --prefix ./node \\\n`;
                            command += f.packages
                                .map(p => {
                                    return `        "${p}"`;
                                }).join(' \\\n');
                            break;

                        case 'apt-get':
                            command += `    RUN ${f.update ? 'apt-get update -y && apt-get upgrade -y && ' : ''}apt-get install -y \\\n`;
                            command += f.packages
                                .map(p => {
                                    return `        "${p}"`;
                                }).join(' \\\n');
                            break;
                    }
                    return command;

                } else if (f.type === 'folder') {
                    description = description || `Create folder "${f.path}"`;
                    let command = `\n    # ${description}\n`;
                    command += `    RUN mkdir -p "${f.path}"`;

                    if (f.permissions) {
                        command += ` && chmod ${f.permissions} "${f.path}"`;
                    }

                    return command;
                } else if (f.type === 'copy_folder') {
                    description = description || `Copy from contents of "${f.source}" into "${f.destination}"`;
                    let command = `\n    # ${description}\n`;
                    command += `    COPY "${f.source}" "${f.destination}"`;

                    if (f.permissions) {
                        command += `\n    RUN chmod ${f.permissions} "${f.destination}"`;
                    }

                    return command;
                } else if (f.type === 'copy_file') {
                    description = description || `Copy file from "${f.source}" to "${f.destination}"`;
                    let command = `\n    # ${description}\n`;
                    command += `    COPY "${f.source}" "${f.destination}"`;

                    if (f.permissions) {
                        command += `\n    RUN chmod ${f.permissions} "${f.destination}"`;
                    }

                    return command;
                } else if (f.type === 'file') {
                    description = description || `Create file "${f.path}"`;
                    let command = `\n    # ${description}\n`;
                    command += `    RUN touch "${f.path}"`;

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
                    description = description || `Create link "${f.destination}" with source" ${f.source}"`;
                    let command = `\n    # ${description}\n`;
                    command += `    RUN ln -s "${f.source}" "${f.destination}"`
                    return command;

                } else if (f.type === 'commands') {
                    description = description || `Running custom commands...`;
                    let command = `\n    # ${description}\n`;
                    command += f.commands
                        .map(c => {
                            return `    RUN ${c}`;
                        }).join('\n');
                    return command;
                }
            }).join('\n')
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
    (generateScripts.length ?
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
        generateScripts
            .map(s => {
                if (s.language === 'bash') {
                    return [
                        ``,
                        `    RUN touch $${s.key} && chmod +x $${s.key}`,
                        `    RUN \\`,
                        `        echo "#! /bin/bash" > $${s.key} && \\`,
                    ].join('\n') +
                    (s.contents || [])
                        .map(c => `\n        echo "${c}" >> $${s.key}`)
                        .join(' && \\');
                }
            }).join('\n')
        : '') +
    (scripts
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
                `    CMD $${s.key}`].join('\n');
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
    let serviceConfig = service.accessConfig(in_serviceConfig, {
        model: 'ANY',
        docker: {
            image: {
                ignore: [
                    'STRING'
                ],
                language: 'STRING',
                log: 'BOOLEAN'
            }
        }
    });

    let ignoreFiles = [];

    if (serviceConfig.docker.image.language === 'node') {
        ignoreFiles.push('node/node_modules/*');
    }

    if (serviceConfig.docker.image.language === 'python') {
        ignoreFiles.push('*.pyc');
    }

    if (serviceConfig.docker.image.log) {
        ignoreFiles.push('logs/*');
    }

    if (serviceConfig.model) {
        ignoreFiles.push('model/*');
    }

    ignoreFiles = ignoreFiles.concat(serviceConfig.docker.image.ignore || []);

    return ignoreFiles.join('\n');
}

// ******************************

function getDefaultDockerRepository () {
  return 'docker.io';
}

// ******************************

function getDockerPassword (in_serviceConfig) {
    let serviceConfig = service.accessConfig(in_serviceConfig, {
        docker: {
            username: 'STRING',
            password: 'STRING'
        }
    });

    let dockerUsername = serviceConfig.docker.username;
    let dockerPassword = serviceConfig.docker.password;

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
    let serviceConfig = service.accessConfig(in_serviceConfig, {
        model: {
            version: 'STRING'
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
    if (modelVersion) {
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

    let cmdResult = dockerCmd(['info'], {
        hide: true
    });

    if (cmdResult.hasError) {
        cmdResult.printError();
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

    if (!dockerInstalled()) {
        cprint.yellow('Docker isn\'t installed');
        return false;
    }

    let args = in_args;

    if (!args) {
        return false;
    }

    if (!Array.isArray(args)) {
        args = [args]
    }

    let command = 'docker';

    let errToOut = false;

    if (async) {
        return exec.cmd(command, args, '  ', !hide, knownCmdErrors, asyncCb);
    }

    return exec.cmdSync(command, args, '  ', !hide, errToOut, knownCmdErrors);
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
    let cmdResult = exec.cmdSync('docker', ['--version'], '', false);
    if (cmdResult.hasError) {
        return false;
    } else {
        return cmdResult.result;
    }
}

// ******************************

function dockerRunningCommand () {
    let cmdResult = exec.cmdSync('docker', ['info'], '', false);
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

module.exports['k_TEST_TYPE_URL'] = k_TEST_TYPE_URL;

module.exports['login'] = dockerLogin;
module.exports['installed'] = dockerInstalled;
module.exports['running'] = dockerRunning;
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
