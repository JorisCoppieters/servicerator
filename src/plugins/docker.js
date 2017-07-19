'use strict'; // JS: ES6

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

function handleCommand (in_args, in_params, in_serviceConfig) {
    let command = in_params.length ? in_params.shift() : '';
    switch(command)
    {
        case '':
        case 'info':
        case 'list':
        case 'images':
            listDockerImages(in_serviceConfig);
            break;
        case 'build':
            buildDockerImage(in_serviceConfig);
            break;
        case 'push':
            pushDockerImage(in_serviceConfig);
            break;
        case 'clean':
            cleanDockerImages(in_serviceConfig);
            break;
        case 'purge':
            purgeDockerImages(in_serviceConfig);
            break;
        default:
            return false;
    }
    return true;
}

// ******************************

function getCommands () {
    return [
        { params: ['', 'info', 'list', 'images'], description: 'Print out service docker information' },
        { params: ['build'], description: 'Build the service docker image', options: [{param:'no-cache', description:'Don\'t use cached images'}] },
        { params: ['push'], description: 'Push the service docker image' },
        { params: ['clean'], description: 'Clean up service temporary docker images' },
        { params: ['purge'], description: 'Remove all service docker images' },
    ];
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

module.exports['handleCommand'] = handleCommand;
module.exports['getCommands'] = getCommands;

module.exports['buildImage'] = buildDockerImage;
module.exports['pushImage'] = pushDockerImage;
module.exports['listImages'] = listDockerImages;
module.exports['cleanImages'] = cleanDockerImages;
module.exports['purgeImages'] = purgeDockerImages;

// ******************************
