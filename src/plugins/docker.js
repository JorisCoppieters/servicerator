'use strict'; // JS: ES6

// ******************************
// Requries:
// ******************************

let cprint = require('color-print');
let path = require('path');
let Promise = require('bluebird');

let aws = require('../utils/aws');
let docker = require('../utils/docker');
let env = require('../utils/env');
let exec = require('../utils/exec');
let print = require('../utils/print');
let sync = require('../utils/sync');

// ******************************
// Globals:
// ******************************

let g_CURRENT_DOCKER_USERNAME = null;
let g_AWS_DOCKER_CREDENTIALS = [];

// ******************************
// Image Functions:
// ******************************

function listDockerImages (in_serviceConfig) {
    let serviceConfig = in_serviceConfig || {};
    let serviceConfigDocker = serviceConfig.docker || {};
    let serviceConfigDockerImage = serviceConfigDocker.image || {};
    let serviceConfigDockerBuild = serviceConfigDocker.build || {};

    if (!serviceConfigDockerImage.name) {
        cprint.yellow('Docker Image name not set');
        return;
    }

    if (!serviceConfigDocker.username) {
        cprint.yellow('Docker Image username not set');
        return;
    }

    let args = ['images', '--format', '{{.Repository}}:{{.Tag}}\t{{.ID}}'];
    let cmdResult = docker.cmd(args, true);

    if (cmdResult.hasError) {
        cmdResult.printError('  ');
        return;
    }

    let dockerImageTags = serviceConfigDockerImage.tags || [];
    if (dockerImageTags.indexOf('latest') < 0) {
        dockerImageTags.push('latest');
    }
    let dockerImagePaths = _getDockerImagePaths(in_serviceConfig);

    let dockerImageTaggedPaths = [];
    dockerImagePaths.forEach(p => {
        dockerImageTags.forEach(t => {
            dockerImageTaggedPaths.push(p + ':' + t);
        });
    });

    cprint.magenta('-- Docker Images --');
    cmdResult.rows
        .filter(r => dockerImagePaths.find(p => r.match(new RegExp('^' + p + ':'))))
        .forEach(r => {
            let c = r.split(/\t/);
            let dockerImage = c[0];
            let currentDockerImage = (dockerImageTaggedPaths.indexOf(dockerImage) >= 0);
            if (currentDockerImage) {
                print.out(cprint.toGreen(dockerImage) + ' ' + cprint.toWhite('-') + ' ' + cprint.toCyan(c[1]) + '\n');
            } else {
                print.out(cprint.toYellow(dockerImage) + ' ' + cprint.toWhite('-') + ' ' + cprint.toYellow(c[1]) + '\n');
            }
        });
    cprint.magenta('----');
}

// ******************************

function pullDockerImage (in_serviceConfig) {
    let serviceConfig = in_serviceConfig || {};
    let serviceConfigAws = serviceConfig.aws || {};
    let serviceConfigDocker = serviceConfig.docker || {};
    let serviceConfigDockerImage = serviceConfigDocker.image || {};
    let serviceConfigDockerBuild = serviceConfigDocker.build || {};

    if (!serviceConfigDockerImage.name) {
        cprint.yellow('Docker Image name not set');
        return;
    }

    let repos = [
        {
            type: docker.k_REPO_TYPE_DEFAULT,
            username: serviceConfigDocker.username,
            password: serviceConfigDocker.password
        }
    ].concat(serviceConfigDocker.other_repositories || []);

    let tasks = [];

    repos.forEach(repo => {
        let details = _getDockerImageDetails(in_serviceConfig, repo.type, repo.username, repo.password, serviceConfigDockerImage.name);
        let tags = (serviceConfigDockerImage.tags || []);
        if (tags.indexOf('latest') < 0) {
            tags.push('latest');
        }
        tags.forEach(tag => {
            tasks.push(_execCmdOnDockerImageForRepository(details.username, details.password, details.imagePath + ':' + tag, details.repository, {
                value: 'pull',
                displayName: 'Pulling'
            }));
        });
    });

    sync.runTasks(tasks);
}

// ******************************

function buildDockerImage (in_serviceConfig, in_noCache) {
    let serviceConfig = in_serviceConfig || {};
    let serviceConfigDocker = serviceConfig.docker || {};
    let serviceConfigDockerImage = serviceConfigDocker.image || {};
    let serviceConfigDockerBuild = serviceConfigDocker.build || {};

    if (!serviceConfigDockerImage.name) {
        cprint.yellow('Docker Image name not set');
        return;
    }

    if (!serviceConfigDocker.username) {
        cprint.yellow('Docker Image username not set');
        return;
    }

    let dockerFolder = path.resolve(serviceConfig.cwd, 'docker', serviceConfigDockerImage.name);

    let dockerImageTags = serviceConfigDockerImage.tags || [];
    if (dockerImageTags.indexOf('latest') < 0) {
        dockerImageTags.push('latest');
    }
    let dockerImagePaths = _getDockerImagePaths(in_serviceConfig);

    let dockerImageTaggedPaths = [];
    dockerImagePaths.forEach(p => {
        dockerImageTags.forEach(t => {
            dockerImageTaggedPaths.push(p + ':' + t);
        });
    });

    let args = ['build'];
    dockerImageTaggedPaths
        .map(tp => {
            args.push('-t');
            args.push(tp);
        });

    if (in_noCache) {
        args.push('--no-cache');
    }
    args.push(dockerFolder);

    cprint.cyan('Building Docker image...');
    exec.cmd('docker', args, '  ');
}

// ******************************

function pushDockerImage (in_serviceConfig) {
    let serviceConfig = in_serviceConfig || {};
    let serviceConfigAws = serviceConfig.aws || {};
    let serviceConfigDocker = serviceConfig.docker || {};
    let serviceConfigDockerImage = serviceConfigDocker.image || {};
    let serviceConfigDockerBuild = serviceConfigDocker.build || {};

    if (!serviceConfigDockerImage.name) {
        cprint.yellow('Docker Image name not set');
        return;
    }

    let repos = [
        {
            type: docker.k_REPO_TYPE_DEFAULT,
            username: serviceConfigDocker.username,
            password: serviceConfigDocker.password
        }
    ].concat(serviceConfigDocker.other_repositories || []);

    let tasks = [];

    repos.forEach(repo => {
        let details = _getDockerImageDetails(in_serviceConfig, repo.type, repo.username, repo.password, serviceConfigDockerImage.name);
        tasks.push(_execCmdOnDockerImageForRepository(details.username, details.password, details.imagePath, details.repository, {
            value: 'push',
            displayName: 'Pushing'
        }));
    });

    sync.runTasks(tasks);
}

// ******************************

function cleanDockerImages (in_serviceConfig, in_force) {
    let serviceConfig = in_serviceConfig || {};
    let serviceConfigDocker = serviceConfig.docker || {};
    let serviceConfigDockerImage = serviceConfigDocker.image || {};
    let serviceConfigDockerBuild = serviceConfigDocker.build || {};

    if (!serviceConfigDockerImage.name) {
        cprint.yellow('Docker Image name not set');
        return;
    }

    if (!serviceConfigDocker.username) {
        cprint.yellow('Docker Image username not set');
        return;
    }

    let args = ['images', '--format', '{{.Repository}}:{{.Tag}}\t{{.ID}}'];
    let cmdResult = docker.cmd(args);

    if (cmdResult.hasError) {
        cmdResult.printError('  ');
        return;
    }

    let dockerImagePaths = _getDockerImagePaths(in_serviceConfig);

    let rows = cmdResult.rows
        .filter(r => dockerImagePaths.find(p => r.match(new RegExp('^' + p + ':'))))
        .filter(r => r.match(/<none>/))
        .map(r => r.split(/\t/)[1]);

    if (!rows || !rows.length) {
        cprint.green('Nothing to be cleaned');
        return;
    }

    args = ['rmi'].concat(rows);
    if (in_force) {
        args.push('--force');
    }
    cprint.cyan('Removing old Docker images for service...');
    exec.cmd('docker', args, '  ');
}

// ******************************

function purgeDockerImages (in_serviceConfig, in_force) {
    let serviceConfig = in_serviceConfig || {};
    let serviceConfigDocker = serviceConfig.docker || {};
    let serviceConfigDockerImage = serviceConfigDocker.image || {};
    let serviceConfigDockerBuild = serviceConfigDocker.build || {};

    if (!serviceConfigDockerImage.name) {
        cprint.yellow('Docker Image name not set');
        return;
    }

    if (!serviceConfigDocker.username) {
        cprint.yellow('Docker Image username not set');
        return;
    }

    let args = ['images', '--format', '{{.Repository}}:{{.Tag}}\t{{.ID}}'];
    let cmdResult = docker.cmd(args);

    if (cmdResult.hasError) {
        cmdResult.printError('  ');
        return;
    }

    let dockerImagePaths = _getDockerImagePaths(in_serviceConfig);

    let imageTags = cmdResult.rows
        .filter(r => dockerImagePaths.find(p => r.match(new RegExp('^' + p + ':'))))
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
    cprint.backgroundRed(cprint.toYellow('Removing ALL Docker images for service...', true));
    exec.cmd('docker', args, '  ');
}

// ******************************
// Login Functions:
// ******************************

function dockerLogin (in_serviceConfig) {
    let serviceConfig = in_serviceConfig || {};
    let serviceConfigDocker = serviceConfig.docker || {};
    let serviceConfigDockerImage = serviceConfigDocker.image || {};
    let serviceConfigDockerContainer = serviceConfigDocker.container || {};

    let dockerUsername = serviceConfigDocker.username;
    let dockerPassword = serviceConfigDocker.password;

    if (!dockerUsername) {
        cprint.yellow('Docker repository username not set');
        return false;
    }

    if (!dockerPassword) {
        dockerPassword = env.getStoredPassword('docker', dockerUsername);
    }

    if (!dockerPassword) {
        cprint.yellow('Docker repository password not set');
        return false;
    }

    let dockerImageDetails = _getDockerImageDetails(
        in_serviceConfig,
        docker.k_REPO_TYPE_DEFAULT,
        dockerUsername,
        dockerPassword,
        serviceConfigDockerImage.name);

    docker.login(dockerImageDetails.username, dockerImageDetails.password, dockerImageDetails.repository);
}

// ******************************
// Container Functions:
// ******************************

function startDockerContainer (in_serviceConfig) {
    let serviceConfig = in_serviceConfig || {};
    let serviceConfigDocker = serviceConfig.docker || {};
    let serviceConfigDockerImage = serviceConfigDocker.image || {};
    let serviceConfigDockerContainer = serviceConfigDocker.container || {};
    let serviceConfigDockerContainerPorts = serviceConfigDockerContainer.ports || [];
    let serviceConfigDockerContainerVolumes = serviceConfigDockerContainer.volumes || [];
    let serviceConfigDockerContainerCommands = serviceConfigDockerContainer.commands || [];

    let dockerFolder = path.resolve(serviceConfig.cwd, 'docker', serviceConfigDockerImage.name);

    let dockerUsername = serviceConfigDocker.username;
    let dockerImageName = serviceConfigDockerImage.name;
    let dockerImageTag = 'latest';
    let dockerImagePath = dockerUsername + '/' + dockerImageName + ':' + dockerImageTag;
    let dockerImageStartCommand = '';

    serviceConfigDockerContainerCommands.forEach(command => {
        if (command.cmd) {
            dockerImageStartCommand = command.val;
            return;
        }
    });

    if (!dockerImageStartCommand) {
        cprint.yellow('No start command for container');
        return false;
    }

    let containerName = getDockerContainerName(in_serviceConfig);

    let args = [];
    args.push('run');
    args.push('--rm');
    args.push('--name');
    args.push(containerName);
    args.push('--detach');

    serviceConfigDockerContainerPorts.forEach(port => {
        if (!port.host || !port.container) {
            return;
        }
        args.push('--publish');
        args.push(port.host + ':' + port.container);
    });

    serviceConfigDockerContainerVolumes.forEach(volume => {
        if (!volume.host || !volume.container) {
            return;
        }

        let volumeHost = path.resolve(dockerFolder, volume.host);

        args.push('--volume');
        args.push(volumeHost + ':' + volume.container);
    });

    args.push(dockerImagePath);
    args.push(dockerImageStartCommand);

    removeDockerContainer(in_serviceConfig);

    cprint.cyan('Starting Docker container "' + containerName + '"...');
    let cmdResult = docker.cmd(args);
    if (cmdResult.hasError) {
        cmdResult.printError('  ');
    } else {
        cmdResult.printResult('  ');
    }
}

// ******************************

function stopDockerContainer (in_serviceConfig) {
    if (getDockerContainerState(in_serviceConfig) < docker.k_STATE_RUNNING) {
        return;
    }

    let containerName = getDockerContainerName(in_serviceConfig);

    let args = [];
    args.push('stop');
    args.push(containerName);

    cprint.cyan('Stopping Docker container "' + containerName + '"...');
    let cmdResult = docker.cmd(args);
    if (cmdResult.hasError) {
        cmdResult.printError('  ');
    } else {
        cmdResult.printResult('  ');
    }
}

// ******************************

function removeDockerContainer (in_serviceConfig) {
    if (getDockerContainerState(in_serviceConfig) == docker.k_STATE_UNKNOWN) {
        return;
    }

    stopDockerContainer(in_serviceConfig);
    if (getDockerContainerState(in_serviceConfig) == docker.k_STATE_UNKNOWN) {
        return;
    }

    let containerName = getDockerContainerName(in_serviceConfig);

    let args = [];
    args.push('rm');
    args.push(containerName);

    cprint.cyan('Removign Docker container "' + containerName + '"...');
    let cmdResult = docker.cmd(args);
    if (cmdResult.hasError) {
        cmdResult.printError('  ');
    } else {
        cmdResult.printResult('  ');
    }
}

// ******************************

function getDockerContainerName (in_serviceConfig) {
    let serviceConfig = in_serviceConfig || {};
    let serviceConfigDocker = serviceConfig.docker || {};
    let serviceConfigDockerImage = serviceConfigDocker.image || {};
    let serviceConfigDockerContainer = serviceConfigDocker.container || {};

    let containerName = serviceConfigDockerContainer.name || serviceConfigDockerImage.name || 'container';
    return containerName;
}

// ******************************

function getDockerContainerState (in_serviceConfig, in_nice) {
    let serviceConfig = in_serviceConfig || {};
    let serviceConfigDocker = serviceConfig.docker || {};
    let serviceConfigDockerImage = serviceConfigDocker.image || {};
    let serviceConfigDockerContainer = serviceConfigDocker.container || {};

    let containerName = getDockerContainerName(in_serviceConfig);

    let cmdResult = docker.cmd(['ps', '-a', '--format', '{{.ID}}\t{{.Image}}\t{{.Status}}\t{{.Names}}'], true);

    let processes = cmdResult.rows
        .filter(p => p.match(new RegExp(containerName)));

    let processUp = processes.find(p => p.match(/Up /));
    let processFailed = processes.find(p => p.match(/Created /));
    let processExited = processes.find(p => p.match(/Exited /));

    if (processUp) {
        let processId = processUp.split(/\t/)[0];
        return in_nice ? 'Running (' + processId + ')' : docker.k_STATE_RUNNING;
    } else if (processFailed) {
        let processId = processFailed.split(/\t/)[0];
        return in_nice ? 'Failed (' + processId + ')' : docker.k_STATE_FAILED;
    } else if (processExited) {
        let processId = processExited.split(/\t/)[0];
        return in_nice ? 'Exited (' + processId + ')' : docker.k_STATE_EXITED;
    }

    return in_nice ? 'Unknown' : docker.k_STATE_UNKNOWN;
}

// ******************************

function printDockerContainerStats (in_serviceConfig) {
    let serviceConfig = in_serviceConfig || {};
    let serviceConfigDocker = serviceConfig.docker || {};
    let serviceConfigDockerImage = serviceConfigDocker.image || {};
    let serviceConfigDockerContainer = serviceConfigDocker.container || {};

    let containerName = getDockerContainerName(in_serviceConfig);
    let containerState = getDockerContainerState(in_serviceConfig, true);

    cprint.magenta('-- Docker Container --');
    print.keyVal('Container Name', containerName);
    print.keyVal('Container State', containerState);
    cprint.magenta('----');

    return false;
}

// ******************************
// Helper Functions:
// ******************************

function _execCmdOnDockerImageForRepository (in_dockerUsername, in_dockerPassword, in_dockerImagePath, in_dockerRepository, in_cmd) {
    return () => {
        return new Promise((resolve, reject) => {
            if (!in_dockerUsername) {
                cprint.yellow('Docker repository username not set');
                return reject();
            }

            if (!in_dockerPassword) {
                in_dockerPassword = env.getStoredPassword('docker', in_dockerUsername);
            }

            if (!in_dockerPassword) {
                cprint.yellow('Docker repository password not set');
                return reject();
            }

            _dockerLogin(in_dockerUsername, in_dockerPassword, in_dockerRepository);

            if (!in_cmd || !in_cmd.displayName || !in_cmd.value) {
                cprint.yellow('Invalid command: ' + in_cmd);
                return reject();
            }

            cprint.cyan(in_cmd.displayName + ' Docker image "' + in_dockerImagePath + '" for service...');
            let args = [in_cmd.value];
            args = args.concat(in_dockerImagePath);
            exec.cmd('docker', args, '  ', true, resolve);
        });
    }
}

// ******************************

function _getDockerImageDetails (in_serviceConfig, in_repositoryType, in_dockerUsername, in_dockerPassword, in_dockerImageName, in_dockerRepository) {
    let dockerUsername;
    let dockerPassword;
    let dockerRepository;
    let dockerImagePath;

    switch (in_repositoryType)
    {
        case docker.k_REPO_TYPE_DEFAULT:
            dockerUsername = in_dockerUsername;
            dockerPassword = in_dockerPassword;
            dockerRepository = in_dockerRepository || docker.getDefaultRepository();
            dockerImagePath = dockerRepository + '/' + dockerUsername + '/' + in_dockerImageName;
            break;
        case docker.k_REPO_TYPE_AWS:
            let awsDockerCredentials = _getAwsDockerCredentials(in_serviceConfig);
            dockerUsername = awsDockerCredentials.username;
            dockerPassword = awsDockerCredentials.password;
            dockerRepository = aws.getDockerRepository(in_serviceConfig);
            dockerImagePath = dockerRepository + '/' + in_dockerImageName;
            break;
        default:
            cprint.yellow('Unknown repository type: ' + in_repositoryType);
            return false;
    }

    return {
        username: dockerUsername,
        password: dockerPassword,
        repository: dockerRepository,
        imagePath: dockerImagePath
    };
}

// ******************************

function _getDockerImagePaths (in_serviceConfig) {
    let serviceConfig = in_serviceConfig || {};
    let serviceConfigDocker = serviceConfig.docker || {};
    let serviceConfigDockerImage = serviceConfigDocker.image || {};

    if (!serviceConfigDockerImage.name) {
        cprint.yellow('Docker Image name not set');
        return;
    }

    if (!serviceConfigDocker.username) {
        cprint.yellow('Docker Image username not set');
        return;
    }

    let dockerImagePaths = [];
    dockerImagePaths.push(serviceConfigDocker.username + '/' + serviceConfigDockerImage.name);

    (serviceConfigDocker.other_repositories || []).forEach(repo => {
        switch (repo.type)
        {
            case docker.k_REPO_TYPE_DEFAULT:
                if (repo.repository) {
                    dockerImagePaths.push(repo.repository + '/' + serviceConfigDocker.username + '/' + serviceConfigDockerImage.name);
                }
                break;
            case docker.k_REPO_TYPE_AWS:
                let awsDockerRepository = aws.getDockerRepository(in_serviceConfig);
                if (awsDockerRepository) {
                    dockerImagePaths.push(awsDockerRepository + '/' + serviceConfigDockerImage.name);
                }
                break;
            default:
                cprint.yellow('Unknown repository type: ' + repo.type);
                return;
        }
    });

    return dockerImagePaths;
}

// ******************************

function _getAwsDockerCredentials (in_serviceConfig) {
    if (!g_AWS_DOCKER_CREDENTIALS[in_serviceConfig]) {
        g_AWS_DOCKER_CREDENTIALS[in_serviceConfig] = aws.getDockerCredentials(in_serviceConfig);
    }
    return g_AWS_DOCKER_CREDENTIALS[in_serviceConfig];
}

// ******************************

function _dockerLogin (in_dockerUsername, in_dockerPassword, in_dockerRepository) {
    if (g_CURRENT_DOCKER_USERNAME !== in_dockerUsername) {
        docker.login(in_dockerUsername, in_dockerPassword, in_dockerRepository);
        g_CURRENT_DOCKER_USERNAME = in_dockerUsername;
    }
}

// ******************************
// Plugin Functions:
// ******************************

function handleCommand (in_args, in_params, in_serviceConfig) {
    let command = in_params.length ? in_params.shift() : '';
    let no_cache = in_args['cache'] === false;
    let force = in_args['force'];
    switch(command)
    {
        case '':
        case 'info':
        case 'list':
        case 'images':
            listDockerImages(in_serviceConfig);
            break;
        case 'pull':
            pullDockerImage(in_serviceConfig);
            break;
        case 'build':
            buildDockerImage(in_serviceConfig, no_cache);
            break;
        case 'push':
            pushDockerImage(in_serviceConfig);
            break;
        case 'clean':
            cleanDockerImages(in_serviceConfig, force);
            break;
        case 'purge':
            purgeDockerImages(in_serviceConfig, force);
            break;

        case 'login':
            dockerLogin(in_serviceConfig);
            break;

        case 'container':
        case 'stats':
            printDockerContainerStats(in_serviceConfig);
            break;
        case 'start':
            startDockerContainer(in_serviceConfig);
            break;
        case 'stop':
            stopDockerContainer(in_serviceConfig);
            break;
        case 'rm':
        case 'remove':
            removeDockerContainer(in_serviceConfig);
            break;

        default:
            return false;
    }
    return true;
}

// ******************************

function getBaseCommands () {
    return ['docker', 'container', 'image'];
}

// ******************************

function getCommands () {
    return [
        { params: ['', 'info', 'list', 'images'], description: 'Print out service docker information' },
        { params: ['start'], description: 'Start the service docker container' },
        { params: ['stop'], description: 'Stop the service docker container' },
        { params: ['rm', 'remove'], description: 'Remove the service docker container' },
        { params: ['container', 'stats'], description: 'Print the current state of the service docker container' },
        { params: ['pull'], description: 'Pull the service docker image' },
        { params: ['build'], description: 'Build the service docker image', options: [{param:'no-cache', description:'Don\'t use cached images'}] },
        { params: ['push'], description: 'Push the service docker image' },
        { params: ['clean'], description: 'Clean up service temporary docker images', options: [{param:'force', description:'Force clean'}] },
        { params: ['purge'], description: 'Remove all service docker images', options: [{param:'force', description:'Force clean'}] },
    ];
}

// ******************************

function getTitle () {
    return 'Docker';
}

// ******************************
// Exports:
// ******************************

module.exports['handleCommand'] = handleCommand;
module.exports['getBaseCommands'] = getBaseCommands;
module.exports['getCommands'] = getCommands;
module.exports['getTitle'] = getTitle;

// ******************************
