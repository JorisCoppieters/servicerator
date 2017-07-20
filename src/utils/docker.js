'use strict'; // JS: ES6

// ******************************
// Requries:
// ******************************

let cprint = require('color-print');

let exec = require('./exec');

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

function getDockerFileContents (in_serviceConfig) {
    let serviceConfig = in_serviceConfig || {};
    let serviceConfigDocker = serviceConfig.docker || {};
    let serviceConfigDockerImage = serviceConfigDocker.image || {};
    let serviceConfigDockerContainer = serviceConfigDocker.container || {};
    let serviceConfigService = serviceConfig.service || {};

    let baseImage = serviceConfigDockerImage.base || 'ubuntu:trusty';
    let serviceName = serviceConfigService.name || 'unknown';
    let envVariables = serviceConfigDockerImage.env_variables || [];
    let containerPorts = serviceConfigDockerContainer.ports || [];
    let pythonStartCommands =
        (serviceConfigDockerContainer.commands || [])
            .filter(c => {
                return c.type==='python_start';
            });

    let enableNginx = serviceConfigDockerImage.nginx;

    let aptGetPackages = serviceConfigDockerImage.apt_get_packages || [];
    let aptGetUpdate = serviceConfigDockerImage.apt_get_update || false;
    let pipPackages = serviceConfigDockerImage.pip_packages || [];
    let pipUpdate = serviceConfigDockerImage.pip_update || false;
    let filesystem = serviceConfigDockerImage.filesystem || [];
    let baseDir = serviceConfigDockerImage.work_directory || false;

    if (enableNginx) {
        aptGetPackages.push('nginx');
    }

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
        '\n\n' +
        envVariables
            .map(v => {
                return `    ENV ${v.key} "${v.val}"`;
            }).join('\n')
        : ''
    ) +
    (pythonStartCommands.length ?
        '\n\n' +
        pythonStartCommands
            .map(c => {
                return `    ENV INIT_${c.env.toUpperCase()}_FILE "${c.val}"`;
            }).join('\n')
        : ''
    ) +
    (containerPorts.length ?
        '\n\n' +
        containerPorts
            .map(p => {
                return `    EXPOSE ${p.container}`;
            }).join('\n')
        : ''
    ) +
    (baseDir ?
        [
            ``,
            ``,
            `# ----------------------`,
            `#`,
            `# WORKDIR`,
            `#`,
            `# ----------------------`,
            ``,
            `    WORKDIR "${baseDir}"`].join('\n') : '') +
    (pythonStartCommands.length ?
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

        pythonStartCommands
            .map(c => {
                let commandFile = `$INIT_${c.env.toUpperCase()}_FILE`;
                return [
                    ``,
                    `    RUN touch ${commandFile} && chmod +x ${commandFile}`,
                    `    RUN \\`,
                    `        echo "#! /bin/bash" > ${commandFile} && \\`,
                ].join('\n') +
                (c.needs_nginx ?
                    `\n        echo "nginx &" >> ${commandFile} && \\`
                    : ''
                ) +
                [
                    ``,
                    `        echo "cd python; python api-${c.env}.py" >> ${commandFile}`,
                ].join('\n')
            }).join('\n')
        : '') +
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
                    return `    RUN mkdir -p "${f.path}"`;
                } else if (f.type === 'copy_folder') {
                    return `    COPY "${f.source}" "${f.destination}"`;
                } else if (f.type === 'file' && !f.contents) {
                    return `    RUN touch "${f.path}"`;
                } else if (f.type === 'file' && f.contents) {
                    return `    ECHO "${f.contents}" > "${f.path}"`;
                } else if (f.type === 'link') {
                    return `    RUN ln -s "${f.source}" "${f.destination}"`;
                }
            }).join('\n')
        : '') +
    (pythonStartCommands
        .filter(c => {
            return c.cmd;
        })
        .map(c => {
            let commandFile = `$INIT_${c.env.toUpperCase()}_FILE`;
            return [
                ``,
                ``,
                `# ----------------------`,
                `#`,
                `# CMD`,
                `#`,
                `# ---------------------`,
                ``,
                `    CMD "${commandFile}"`,
                ``].join('\n');
        })[0] || '') +
    '\n';
}

// ******************************

function getIgnoreDockerContents (in_serviceConfig) {
    let serviceConfig = in_serviceConfig || {};
    let serviceConfigDocker = serviceConfig.docker || {};
    let serviceConfigDockerImage = serviceConfigDocker.image || {};
    let serviceConfigDockerBuild = serviceConfigDocker.build || {};

    let ignoreFiles = [];

    if (serviceConfigDockerImage.env === 'node') {
        ignoreFiles.push('node/node_modules/*');
    }

    if (serviceConfigDockerImage.log) {
        ignoreFiles.push('logs/*');
    }

    if (serviceConfigDockerBuild.env === 'bash') {
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

function dockerLogin (in_username, in_password, in_repository) {
    if (!dockerInstalled()) {
        cprint.yellow('Docker isn\'t installed');
        return false;
    }

    let repository = in_repository || getDefaultDockerRepository();
    let args = ['login', '-u', in_username, '-p', in_password, repository];
    cprint.cyan('Logging into docker...');
    let results = dockerCmd(args);
    if (results.hasError) {
        results.printError();
    } else {
        results.printResult();
    }
    return !results.hasError;
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
module.exports['cmd'] = dockerCmd;
module.exports['getDefaultRepository'] = getDefaultDockerRepository;
module.exports['getDockerFileContents'] = getDockerFileContents;
module.exports['getIgnoreDockerContents'] = getIgnoreDockerContents;

// ******************************
