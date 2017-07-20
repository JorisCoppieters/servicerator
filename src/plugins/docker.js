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
// Functions:
// ******************************

function handleCommand (in_args, in_params, in_serviceConfig) {
    let command = in_params.length ? in_params.shift() : '';
    let no_cache = in_args['no-cache'];
    let force = in_args['force'];
    switch(command)
    {
        case '':
        case 'info':
        case 'list':
        case 'images':
            listDockerImages(in_serviceConfig);
            break;
        case 'build':
            buildDockerImage(in_serviceConfig, no_cache);
            break;
        case 'push':
            pushDockerImage(in_serviceConfig);
            break;
        case 'pull':
            pullDockerImage(in_serviceConfig);
            break;
        case 'clean':
            cleanDockerImages(in_serviceConfig, force);
            break;
        case 'purge':
            purgeDockerImages(in_serviceConfig, force);
            break;
        default:
            return false;
    }
    return true;
}

// ******************************

function getBaseCommands () {
    return ['docker'];
}

// ******************************

function getCommands () {
    return [
        { params: ['', 'info', 'list', 'images'], description: 'Print out service docker information' },
        { params: ['build'], description: 'Build the service docker image', options: [{param:'no-cache', description:'Don\'t use cached images'}] },
        { params: ['push'], description: 'Push the service docker image' },
        { params: ['pull'], description: 'Pull the service docker image' },
        { params: ['clean'], description: 'Clean up service temporary docker images', options: [{param:'force', description:'Force clean'}] },
        { params: ['purge'], description: 'Remove all service docker images' },
    ];
}

// ******************************

function getTitle () {
    return 'Docker';
}

// ******************************

function buildDockerImage (in_serviceConfig, in_noCache) {
    let serviceConfig = in_serviceConfig;
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

function listDockerImages (in_serviceConfig) {
    let serviceConfig = in_serviceConfig;
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
    let result = exec.cmdSync('docker', args, '  ');

    if (result.hasError) {
        result.printError('  ');
        return;
    }

    let dockerImagePaths = _getDockerImagePaths(in_serviceConfig);

    cprint.magenta('-- Docker Images --');
    result.rows
        .filter(r => dockerImagePaths.find(p => r.match(new RegExp(p))))
        .forEach(r => {
            let c = r.split(/\t/);
            print.out(cprint.toGreen(c[0]) + ' ' + cprint.toWhite('-') + ' ' + cprint.toCyan(c[1]) + '\n');
        });
    cprint.magenta('----');
}

// ******************************

function cleanDockerImages (in_serviceConfig, in_force) {
    let serviceConfig = in_serviceConfig;
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

    let args = ['images', '--format', '{{.ID}}\t{{.Tag}}\t{{.Repository}}'];
    let result = exec.cmdSync('docker', args, '  ');

    if (result.hasError) {
        result.printError('  ');
        return;
    }

    let dockerImagePaths = _getDockerImagePaths(in_serviceConfig);

    let rows = result.rows
        .filter(r => dockerImagePaths.find(p => r.match(new RegExp(p))))
        .filter(r => r.match(/<none>/))
        .map(r => r.split(/\t/)[0]);

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
    let serviceConfig = in_serviceConfig;
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
    let result = exec.cmdSync('docker', args, '  ');

    if (result.hasError) {
        result.printError('  ');
        return;
    }

    let dockerImagePaths = _getDockerImagePaths(in_serviceConfig);

    let imageTags = result.rows
        .filter(r => dockerImagePaths.find(p => r.match(new RegExp(p))))
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

function pushDockerImage (in_serviceConfig) {
    let serviceConfig = in_serviceConfig;
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

function pullDockerImage (in_serviceConfig) {
    let serviceConfig = in_serviceConfig;
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
    let serviceConfig = in_serviceConfig;
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
// Exports:
// ******************************

module.exports['handleCommand'] = handleCommand;
module.exports['getBaseCommands'] = getBaseCommands;
module.exports['getCommands'] = getCommands;
module.exports['getTitle'] = getTitle;

// ******************************
