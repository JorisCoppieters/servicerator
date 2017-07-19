'use strict'; // JS: ES5

// ******************************
// Requries:
// ******************************

let cprint = require('color-print');
let path = require('path');

let print = require('../utils/print');
let exec = require('../utils/exec');

// ******************************
// Functions:
// ******************************

function getDockerFileContents (in_serviceConfig) {
    let serviceConfig = in_serviceConfig;
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
    let pipPackages = serviceConfigDockerImage.pip_packages || [];
    let filesystem = serviceConfigDockerImage.filesystem || [];
    let baseDir = serviceConfigDockerImage.work_directory || [];

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
                return `    EXPOSE ${p.number}`;
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
            `    RUN apt-get install -y nginx`,
            `    RUN rm -v /etc/nginx/nginx.conf`,
            `    ADD nginx.conf /etc/nginx/`].join('\n') : '') +
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
            `    RUN apt-get update -y && apt-get upgrade -y && apt-get install -y \\`,
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
            `    RUN pip install \\`,
            ``].join('\n') +
        pipPackages
            .map(p => {
                return `        "${p}"`;
            }).join(' \\\n')
        : '') +
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
    (pythonStartCommands
        .filter(c => {
            return c.cmd;
        })
        .map(c => {
            return [
                ``,
                ``,
                `# ----------------------`,
                `#`,
                `# CMD`,
                `#`,
                `# ---------------------`,
                ``,
                `    CMD "${c.val}"`,
                ``].join('\n');
        })[0] || '') +
    '\n';
}

// ******************************

function getIgnoreDockerContents (in_serviceConfig) {
    let serviceConfig = in_serviceConfig;
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
        ignoreFiles.push('_env.sh');
    }

    if (serviceConfig.model) {
        ignoreFiles.push('model/*');
    }

    return ignoreFiles.join('\n');
}

// ******************************

function buildDockerImage (in_serviceConfig) {
    let serviceConfig = in_serviceConfig;
    let serviceConfigDocker = serviceConfig.docker || {};
    let serviceConfigDockerImage = serviceConfigDocker.image || {};
    let serviceConfigDockerBuild = serviceConfigDocker.build || {};

    if (!serviceConfigDockerImage.name) {
        cprint.yellow("Docker Image name not set");
        return;
    }

    if (!serviceConfigDocker.username) {
        cprint.yellow("Docker Image username not set");
        return;
    }

    let dockerImagePath = serviceConfigDocker.username + '/' + serviceConfigDockerImage.name;
    let dockerFolder = path.resolve(serviceConfig.cwd, 'docker', serviceConfigDockerImage.name);

    let args = ['build'];
    (serviceConfigDockerImage.tags || []).map(t => {
        args.push('-t');
        args.push(dockerImagePath + ':' + t);
    });
    args.push(dockerFolder);

    cprint.cyan('Building Docker image...');
    exec.cmd('docker', args, '  ');
}

// ******************************

function listDockerImages (in_serviceConfig) {
    let serviceConfig = in_serviceConfig;
    let serviceConfigDocker = serviceConfig.docker || {};
    let serviceConfigDockerImage = serviceConfigDocker.image || {};
    let serviceConfigDockerBuild = serviceConfigDocker.build || {};

    if (!serviceConfigDockerImage.name) {
        cprint.yellow("Docker Image name not set");
        return;
    }

    if (!serviceConfigDocker.username) {
        cprint.yellow("Docker Image username not set");
        return;
    }

    let dockerImagePath = serviceConfigDocker.username + '/' + serviceConfigDockerImage.name;

    let args = ['images', '--format', '{{.Repository}}:{{.Tag}}\t{{.ID}}'];
    let result = exec.cmdSync('docker', args, '  ');

    if (result.hasError) {
        result.printError('  ');
        return;
    }

    cprint.magenta('-- Docker Images --');
    result.rows
        .filter(r => r.match(new RegExp(dockerImagePath)))
        .forEach(r => {
            let c = r.split(/\t/);
            print.out(cprint.toGreen(c[0]) + ' ' + cprint.toWhite('-') + ' ' + cprint.toCyan(c[1]) + '\n');
        });
    cprint.magenta('----');
}

// ******************************

function cleanDockerImages (in_serviceConfig) {
    let serviceConfig = in_serviceConfig;
    let serviceConfigDocker = serviceConfig.docker || {};
    let serviceConfigDockerImage = serviceConfigDocker.image || {};
    let serviceConfigDockerBuild = serviceConfigDocker.build || {};

    if (!serviceConfigDockerImage.name) {
        cprint.yellow("Docker Image name not set");
        return;
    }

    if (!serviceConfigDocker.username) {
        cprint.yellow("Docker Image username not set");
        return;
    }

    let dockerImagePath = serviceConfigDocker.username + '/' + serviceConfigDockerImage.name;

    let args = ['images', '--format', '{{.ID}}\t{{.Tag}}\t{{.Repository}}'];
    let result = exec.cmdSync('docker', args, '  ');

    if (result.hasError) {
        result.printError('  ');
        return;
    }

    let rows = result.rows
        .filter(r => r.match(new RegExp(dockerImagePath)))
        .filter(r => r.match(/<none>/))
        .map(r => r.split(/\t/)[0]);

    if (!rows || !rows.length) {
        cprint.green('Nothing to be cleaned');
        return;
    }

    args = ['rmi'].concat(rows);
    cprint.cyan('Removing old Docker images for service...');
    exec.cmd('docker', args, '  ');
}

// ******************************

function purgeDockerImages (in_serviceConfig, in_force) {
    let serviceConfig = in_serviceConfig;
    let serviceConfigDocker = serviceConfig.docker || {};
    let serviceConfigDockerImage = serviceConfigDocker.image || {};
    let serviceConfigDockerBuild = serviceConfigDocker.build || {};

    if (!serviceConfigDockerImage.name) {
        cprint.yellow("Docker Image name not set");
        return;
    }

    if (!serviceConfigDocker.username) {
        cprint.yellow("Docker Image username not set");
        return;
    }

    let dockerImagePath = serviceConfigDocker.username + '/' + serviceConfigDockerImage.name;

    let args = ['images', '--format', '{{.Repository}}:{{.Tag}}\t{{.ID}}'];
    let result = exec.cmdSync('docker', args, '  ');

    if (result.hasError) {
        result.printError('  ');
        return;
    }

    let imageTags = result.rows
        .filter(r => r.match(new RegExp(dockerImagePath)))
        .map(r => r.split(/\t/)[0])
        .filter((elem, pos, self) => { return self.indexOf(elem) === pos; });

    if (!imageTags || !imageTags.length) {
        cprint.green('Nothing to be purged');
        return;
    }

    args = ['rmi'];
    if (in_force) {
        args.push('-f');
    }
    args = args.concat(imageTags);
    cprint.red('Removing ALL Docker images for service...');
    exec.cmd('docker', args, '  ');
}

// ******************************

function pushDockerImage (in_serviceConfig) {
    let serviceConfig = in_serviceConfig;
    let serviceConfigDocker = serviceConfig.docker || {};
    let serviceConfigDockerImage = serviceConfigDocker.image || {};
    let serviceConfigDockerBuild = serviceConfigDocker.build || {};

    if (!serviceConfigDockerImage.name) {
        cprint.yellow("Docker Image name not set");
        return;
    }

    if (!serviceConfigDocker.username) {
        cprint.yellow("Docker Image username not set");
        return;
    }

    let dockerImagePath = serviceConfigDocker.username + '/' + serviceConfigDockerImage.name;

    let args = ['push'];
    args = args.concat(dockerImagePath);
    cprint.cyan('Pushing Docker images for service...');
    exec.cmd('docker', args, '  ');
}

// ******************************
// Exports:
// ******************************

module.exports['getDockerFileContents'] = getDockerFileContents;
module.exports['getIgnoreDockerContents'] = getIgnoreDockerContents;
module.exports['buildImage'] = buildDockerImage;
module.exports['pushImage'] = pushDockerImage;
module.exports['listImages'] = listDockerImages;
module.exports['cleanImages'] = cleanDockerImages;
module.exports['purgeImages'] = purgeDockerImages;

// ******************************
