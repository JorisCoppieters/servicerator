'use strict'; // JS: ES6

// ******************************
// Requries:
// ******************************

let cprint = require('color-print');
let path = require('path');
let Promise = require('bluebird');

let aws = require('../utils/aws');
let docker = require('../utils/docker');
let exec = require('../utils/exec');
let print = require('../utils/print');
let init = require('../utils/init');
let sync = require('../utils/sync');

// ******************************
// Globals:
// ******************************

let g_CURRENT_DOCKER_USERNAME = null;
let g_AWS_DOCKER_CREDENTIALS = [];

// ******************************
// Image Functions:
// ******************************

function printDockerInfo (in_serviceConfig) {
    let serviceConfig = in_serviceConfig || {};
    let serviceConfigDocker = serviceConfig.docker || {};
    let serviceConfigDockerImage = serviceConfigDocker.image || {};

    let dockerUsername = serviceConfigDocker.username || false;
    let dockerPassword = docker.getPassword(serviceConfig) || false;
    let dockerImageName = serviceConfigDockerImage.name || false;
    let dockerImageVersion = serviceConfigDockerImage.version || false;

    cprint.magenta('-- Docker --');
    print.keyVal('Docker Username', dockerUsername || '(Not Set)');
    print.keyVal('Docker Password', dockerPassword ? '*******' : '(Not Set)');
    print.out('\n');

    if (serviceConfigDocker.container && docker.installed()) {
        let containerName = getDockerContainerName(in_serviceConfig);
        let containerState = getDockerContainerState(in_serviceConfig, true);

        cprint.magenta('-- Docker Container --');
        print.keyVal('Container Name', containerName);
        print.keyVal('Container State', containerState);
        cprint.magenta('----');
        print.out('\n');
    }

    cprint.magenta('-- Docker Image --');
    print.keyVal('Docker Image Name', dockerImageName || '(Not Set)');
    print.keyVal('Docker Image Version', dockerImageVersion || '(Not Set)');
    print.out('\n');

    if (dockerImageName && dockerUsername && docker.installed()) {
        let dockerImageTags = docker.getImageTags(in_serviceConfig);
        let dockerImagePaths = _getDockerImagePaths(in_serviceConfig);

        let dockerImageTaggedPaths = [];
        dockerImagePaths.forEach(p => {
            dockerImageTags.forEach(t => {
                dockerImageTaggedPaths.push(p + ':' + t);
            });
        });

        cprint.magenta('-- Docker Image Paths --');
        dockerImagePaths.forEach(p => {
            print.keyVal('Docker Image Path', p);
        });
        print.out('\n');

        cprint.magenta('-- Docker Image Tags --');

        let args = ['images', '--format', '{{.Repository}}:{{.Tag}}\t{{.ID}}'];
        let cmdResult = docker.cmd(args, true);

        if (cmdResult.hasError) {
            cmdResult.printError('  ');
            return;
        }

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
        print.out('\n');
    }
    cprint.magenta('----');
}

// ******************************

function pullDockerImage (in_serviceConfig) {
    if (!docker.installed()) {
        cprint.yellow('Docker isn\'t installed');
        return false;
    }

    let serviceConfig = in_serviceConfig || {};
    let serviceConfigAws = serviceConfig.aws || {};
    let serviceConfigDocker = serviceConfig.docker || {};
    let serviceConfigDockerImage = serviceConfigDocker.image || {};

    if (!serviceConfigDockerImage.name) {
        cprint.yellow('Docker Image name not set');
        return;
    }

    let dockerImageTags = docker.getImageTags(in_serviceConfig);

    let repos = [
        {
            type: docker.k_REPO_TYPE_DEFAULT,
            username: serviceConfigDocker.username
        }
    ].concat(serviceConfigDocker.other_repositories || []);

    let tasks = [];

    repos.forEach(repo => {
        let details = _getDockerImageDetails(in_serviceConfig, repo.type, repo.username, serviceConfigDockerImage.name);
        let tags = dockerImageTags;
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
    if (!docker.installed()) {
        cprint.yellow('Docker isn\'t installed');
        return false;
    }

    let serviceConfig = in_serviceConfig || {};
    let serviceConfigDocker = serviceConfig.docker || {};
    let serviceConfigDockerImage = serviceConfigDocker.image || {};
    let sourceFolder = serviceConfig.cwd || false;

    if (!serviceConfigDockerImage.name) {
        cprint.yellow('Docker Image name not set');
        return;
    }

    if (!serviceConfigDocker.username) {
        cprint.yellow('Docker Image username not set');
        return;
    }

    let dockerFolder = docker.getFolder(sourceFolder);

    let dockerImageTags = docker.getImageTags(in_serviceConfig);
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
    if (!docker.installed()) {
        cprint.yellow('Docker isn\'t installed');
        return false;
    }

    let serviceConfig = in_serviceConfig || {};
    let serviceConfigAws = serviceConfig.aws || {};
    let serviceConfigDocker = serviceConfig.docker || {};
    let serviceConfigDockerImage = serviceConfigDocker.image || {};

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
        let details = _getDockerImageDetails(in_serviceConfig, repo.type, repo.username, serviceConfigDockerImage.name);
        tasks.push(_execCmdOnDockerImageForRepository(details.username, details.password, details.imagePath, details.repository, {
            value: 'push',
            displayName: 'Pushing'
        }));
    });

    sync.runTasks(tasks);
}

// ******************************

function cleanDockerImages (in_serviceConfig, in_force) {
    if (!docker.installed()) {
        cprint.yellow('Docker isn\'t installed');
        return false;
    }

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

    let dockerImageTags = docker.getImageTags(in_serviceConfig);
    let dockerImagePaths = _getDockerImagePaths(in_serviceConfig);

    let dockerImageTaggedPaths = [];
    dockerImagePaths.forEach(p => {
        dockerImageTags.forEach(t => {
            dockerImageTaggedPaths.push(p + ':' + t);
        });
    });

    let zombieDockerImageIds = _getZombieDockerImageIds();

    let args = ['images', '--format', '{{.Repository}}:{{.Tag}}\t{{.ID}}'];
    let cmdResult = docker.cmd(args);

    if (cmdResult.hasError) {
        cmdResult.printError('  ');
        return;
    }

    let nonLatestImageTags = cmdResult.rows
        .filter(r => dockerImagePaths.find(p => r.match(new RegExp('^' + p + ':'))))
        .filter(r => dockerImageTaggedPaths.indexOf(r.split(/\t/)[0]) < 0)
        .map(r => r.split(/\t/)[0]);

    let cleanImageTagsAndIds = []
        .concat(nonLatestImageTags || [])
        .concat(zombieDockerImageIds || []);

    if (!cleanImageTagsAndIds.length) {
        cprint.green('Nothing to be cleaned');
        return;
    }

    args = ['rmi'];
    if (in_force) {
        args.push('--force');
    }
    args = args.concat(cleanImageTagsAndIds);
    cprint.cyan('Removing old Docker images for service...');
    exec.cmd('docker', args, '  ');
}

// ******************************

function purgeDockerImages (in_serviceConfig, in_force) {
    if (!docker.installed()) {
        cprint.yellow('Docker isn\'t installed');
        return false;
    }

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

    let args = ['images', '--format', '{{.Repository}}:{{.Tag}}\t{{.ID}}'];
    let cmdResult = docker.cmd(args);

    if (cmdResult.hasError) {
        cmdResult.printError('  ');
        return;
    }

    let dockerImagePaths = _getDockerImagePaths(in_serviceConfig);

    let purgeImageTags = cmdResult.rows
        .filter(r => dockerImagePaths.find(p => r.match(new RegExp('^' + p + ':'))))
        .map(r => r.split(/\t/)[0])
        .filter((elem, pos, self) => { return self.indexOf(elem) === pos; });

    if (!purgeImageTags || !purgeImageTags.length) {
        cprint.green('Nothing to be purged');
        return;
    }

    args = ['rmi'];
    if (in_force) {
        args.push('-f');
    }
    args = args.concat(purgeImageTags);
    cprint.backgroundRed(cprint.toYellow('Removing ALL Docker images for service...', true));
    exec.cmd('docker', args, '  ');
}

// ******************************
// Version Functions:
// ******************************

function printDockerImageVersion (in_serviceConfig) {
    let serviceConfig = in_serviceConfig || {};
    let serviceConfigDocker = serviceConfig.docker || {};
    let serviceConfigDockerImage = serviceConfigDocker.image || {};

    let dockerImageVersion = serviceConfigDockerImage.version || false;
    cprint.green(dockerImageVersion);
}

// ******************************

function setDockerImageVersion (in_serviceConfig, in_M, in_m, in_b, in_version) {
    let serviceConfig = in_serviceConfig || {};
    let serviceConfigDocker = serviceConfig.docker || {};
    let serviceConfigDockerImage = serviceConfigDocker.image || {};

    let dockerImageVersion = serviceConfigDockerImage.version || false;

    if (in_version) {
        serviceConfigDockerImage.version = in_version;
        init.saveServiceConfig(serviceConfig);
        return true;
    }

    if (!dockerImageVersion.match(/[0-9]+\.[0-9]+\.[0-9]+/)) {
        cprint.yellow('Docker image version cannot be incremented');
        return false;
    }

    let versionParts = dockerImageVersion.split(/[.]/);
    if (in_M === -1 || in_M === 1) {
        versionParts[0] = Math.max(0, parseInt(versionParts[0]) + in_M);
        versionParts[1] = 0;
        versionParts[2] = 0;
    } else if (in_m === -1 || in_m === 1) {
        versionParts[1] = Math.max(0, parseInt(versionParts[1]) + in_m);
        versionParts[2] = 0;
    } else if (in_b === -1 || in_b === 1) {
        versionParts[2] = Math.max(0, parseInt(versionParts[2]) + in_b);
    }

    let version = versionParts.join('.');
    if (version === '0.0.0') {
        version = '0.0.1';
    }

    serviceConfigDockerImage.version = version;
    init.saveServiceConfig(serviceConfig);
    return true;
}

// ******************************
// Login Functions:
// ******************************

function dockerLogin (in_serviceConfig) {
    if (!docker.installed()) {
        cprint.yellow('Docker isn\'t installed');
        return false;
    }

    let serviceConfig = in_serviceConfig || {};
    let serviceConfigDocker = serviceConfig.docker || {};
    let serviceConfigDockerImage = serviceConfigDocker.image || {};
    let serviceConfigDockerContainer = serviceConfigDocker.container || {};

    let dockerImageDetails = _getDockerImageDetails(
        in_serviceConfig,
        docker.k_REPO_TYPE_DEFAULT,
        serviceConfigDocker.username,
        serviceConfigDockerImage.name);

    docker.login(dockerImageDetails.username, dockerImageDetails.password, dockerImageDetails.repository);
}

// ******************************
// Container Functions:
// ******************************

function startDockerContainer (in_serviceConfig) {
    if (!docker.installed()) {
        cprint.yellow('Docker isn\'t installed');
        return false;
    }

    let serviceConfig = in_serviceConfig || {};
    let serviceConfigDocker = serviceConfig.docker || {};
    let serviceConfigDockerImage = serviceConfigDocker.image || {};
    let serviceConfigDockerContainer = serviceConfigDocker.container || {};
    let serviceConfigDockerContainerPorts = serviceConfigDockerContainer.ports || [];
    let serviceConfigDockerContainerVolumes = serviceConfigDockerContainer.volumes || [];
    let serviceConfigDockerContainerCommands = serviceConfigDockerContainer.commands || [];
    let sourceFolder = serviceConfig.cwd || false;

    let dockerFolder = docker.getFolder(sourceFolder);

    let dockerUsername = serviceConfigDocker.username;
    let dockerImageName = serviceConfigDockerImage.name;
    let dockerImageTag = 'latest';
    let dockerImagePath = dockerUsername + '/' + dockerImageName + ':' + dockerImageTag;
    let dockerImageStartCommand = '';

    serviceConfigDockerContainerCommands.forEach(command => {
        if (command.env === 'test') {
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

function enterDockerContainer (in_serviceConfig) {
    if (!docker.installed()) {
        cprint.yellow('Docker isn\'t installed');
        return false;
    }

    let runningDockerContainerId = getRunningDockerContainerId(in_serviceConfig);
    if (!runningDockerContainerId) {
        cprint.yellow('No running container found');
        return;
    }

    let args = ['-c', 'docker exec --interactive --tty ' + runningDockerContainerId + ' bash'];
    exec.cmd('C:/Program Files/Git/git-bash.exe', args);
    // TODO
    // gitbash.cmd(args);
}

// ******************************

function stopDockerContainer (in_serviceConfig) {
    if (!docker.installed()) {
        cprint.yellow('Docker isn\'t installed');
        return false;
    }

    let dockerImageIds = _getDockerImageIds(in_serviceConfig);
    dockerImageIds.forEach(id => stopDockerImageIdContainer(id));

    if (getDockerContainerState(in_serviceConfig) < docker.k_STATE_RUNNING) {
        cprint.yellow('No running container found');
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

function stopDockerImageIdContainer (in_dockerImageId) {
    if (!docker.installed()) {
        cprint.yellow('Docker isn\'t installed');
        return false;
    }

    let dockerContainerIds = getDockerImageIdContainerIds(in_dockerImageId);
    dockerContainerIds.forEach(id => {
        let args = [];
        args.push('stop');
        args.push(id);

        cprint.cyan('Stopping Docker container ' + id + '...');
        let cmdResult = docker.cmd(args);
        if (cmdResult.hasError) {
            cmdResult.printError('  ');
        } else {
            cmdResult.printResult('  ');
        }
    });
}

// ******************************

function removeDockerContainer (in_serviceConfig) {
    if (!docker.installed()) {
        cprint.yellow('Docker isn\'t installed');
        return false;
    }

    let dockerImageIds = _getDockerImageIds(in_serviceConfig);
    dockerImageIds.forEach(id => removeDockerImageIdContainer(id));

    if (getDockerContainerState(in_serviceConfig) == docker.k_STATE_UNKNOWN) {
        cprint.yellow('No stopped container found');
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

    cprint.cyan('Removing Docker container "' + containerName + '"...');
    let cmdResult = docker.cmd(args);
    if (cmdResult.hasError) {
        cmdResult.printError('  ');
    } else {
        cmdResult.printResult('  ');
    }
}

// ******************************

function removeDockerImageIdContainer (in_dockerImageId) {
    if (!docker.installed()) {
        cprint.yellow('Docker isn\'t installed');
        return false;
    }

    let dockerContainerIds = getDockerImageIdContainerIds(in_dockerImageId, true);
    dockerContainerIds.forEach(id => {
        let args = [];
        args.push('rm');
        args.push(id);

        cprint.cyan('Removing Docker container ' + id + '...');
        let cmdResult = docker.cmd(args);
        if (cmdResult.hasError) {
            cmdResult.printError('  ');
        } else {
            cmdResult.printResult('  ');
        }
    });
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
    if (!docker.installed()) {
        cprint.yellow('Docker isn\'t installed');
        return false;
    }

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

function getRunningDockerContainerId (in_serviceConfig, in_nice) {
    if (!docker.installed()) {
        cprint.yellow('Docker isn\'t installed');
        return false;
    }

    let containerName = getDockerContainerName(in_serviceConfig);

    let cmdResult = docker.cmd(['ps', '-a', '--format', '{{.ID}}\t{{.Image}}\t{{.Status}}\t{{.Names}}'], true);
    let processUp = cmdResult.rows
        .filter(p => p.match(new RegExp(containerName)))
        .find(p => p.match(/Up /));

    if (!processUp) {
        return false;
    }

    let processId = processUp.split(/\t/)[0];
    return processId;
}

// ******************************

function getDockerImageIdContainerIds (in_dockerImageId, in_includeStopped) {
    if (!docker.installed()) {
        cprint.yellow('Docker isn\'t installed');
        return false;
    }

    let args = [];
    args.push('ps');
    if (in_includeStopped) {
        args.push('-a');
    }
    args.push('--format');
    args.push('{{.ID}} - {{.Image}}');

    let cmdResult = docker.cmd(args, true);
    let containerIds = cmdResult.rows
        .filter(r => r.match(new RegExp(' - ' + in_dockerImageId)))
        .map(r => r.split(/ - /)[0]);

    return containerIds;
}

// ******************************

function printDockerContainerStats (in_serviceConfig) {
    if (!docker.installed()) {
        cprint.yellow('Docker isn\'t installed');
        return false;
    }

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

function _getDockerImageDetails (in_serviceConfig, in_repositoryType, in_dockerUsername, in_dockerImageName, in_dockerRepository) {
    let dockerUsername;
    let dockerPassword;
    let dockerRepository;
    let dockerImagePath;

    switch (in_repositoryType)
    {
        case docker.k_REPO_TYPE_DEFAULT:
            dockerUsername = in_dockerUsername;
            dockerPassword = docker.getPassword(in_serviceConfig);
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

function _getDockerImageIds (in_serviceConfig) {
    let serviceConfig = in_serviceConfig || {};
    let serviceConfigDocker = serviceConfig.docker || {};
    let serviceConfigDockerImage = serviceConfigDocker.image || {};

    let dockerImagePaths = _getDockerImagePaths(in_serviceConfig);

    let args = ['images', '--format', '{{.Repository}}:{{.Tag}}\t{{.ID}}'];
    let cmdResult = docker.cmd(args, true);

    if (cmdResult.hasError) {
        cmdResult.printError('  ');
        return;
    }

    let dockerImageIds = cmdResult.rows
        .filter(r => dockerImagePaths.find(p => r.match(new RegExp('^' + p + ':'))))
        .map(r => r.split(/\t/)[1])
        .filter((elem, pos, self) => { return self.indexOf(elem) === pos; });

    return dockerImageIds;
}

// ******************************

function _getZombieDockerImageIds () {
    let args = ['images', '--format', '{{.Repository}}:{{.Tag}}\t{{.ID}}'];
    let cmdResult = docker.cmd(args, true);

    if (cmdResult.hasError) {
        cmdResult.printError('  ');
        return;
    }

    let dockerImageIds = cmdResult.rows
        .filter(r => r.match(/<none>/))
        .map(r => r.split(/\t/)[1])
        .filter((elem, pos, self) => { return self.indexOf(elem) === pos; });

    return dockerImageIds;
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
            printDockerInfo(in_serviceConfig);
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

        case 'version':
        case 'get-version':
            printDockerImageVersion(in_serviceConfig);
            break;

        case 'set-version':
            let M = in_args['M'] === true ? -1 : 0;
            let m = in_args['m'] === true ? -1 : 0;
            let b = in_args['b'] === true ? -1 : 0;

            let version;
            let versionParam;
            while (in_params.length) {
                versionParam = in_params.length ? in_params.shift() : '';
                if (versionParam === '+M') {
                    M = 1;
                } else if (versionParam === '+m') {
                    m = 1;
                } else if (versionParam === '+b') {
                    b = 1;
                } else {
                    version = versionParam;
                }
            }
            setDockerImageVersion(in_serviceConfig, M, m, b, version);
            break;

        case 'login':
            dockerLogin(in_serviceConfig);
            break;

        case 'container':
        case 'running':
        case 'state':
        case 'stats':
            printDockerContainerStats(in_serviceConfig);
            break;
        case 'start':
        case 'start-container':
            startDockerContainer(in_serviceConfig);
            break;
        case 'enter':
        case 'enter-container':
        case 'interact':
        case 'interactive':
            enterDockerContainer(in_serviceConfig);
            break;
        case 'stop':
        case 'stop-container':
            stopDockerContainer(in_serviceConfig);
            break;
        case 'rm':
        case 'remove':
        case 'remove-container':
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
        { params: ['get-version', 'version'], description: 'Get the service docker image version' },
        { params: ['set-version'], description: 'Get the service docker image version', options: [
            {param:'M', description:'Increment major version (i.e 1.0.0 -> 2.0.0)'},
            {param:'m', description:'Increment minor version (i.e 2.9.0 -> 2.10.0)'},
            {param:'b', description:'Increment bug version (i.e 1.2.5 -> 1.2.6)'}] },
        { params: ['start-container', 'start'], description: 'Start the service docker container' },
        { params: ['enter-container', 'enter', 'interact', 'interactive'], description: 'Enter the running service docker container' },
        { params: ['stop-container', 'stop'], description: 'Stop the service docker container' },
        { params: ['remove-container', 'remove', 'rm'], description: 'Remove the service docker container' },
        { params: ['container', 'stats', 'state', 'running'], description: 'Print the current state of the service docker container' },
        { params: ['pull'], description: 'Pull the service docker image' },
        { params: ['build'], description: 'Build the service docker image', options: [{param:'no-cache', description:'Don\'t use cached images'}] },
        { params: ['push'], description: 'Push the service docker image' },
        { params: ['clean'], description: 'Clean up service temporary docker images', options: [{param:'force', description:'Force clean'}] },
        { params: ['purge'], description: 'Remove all service docker images', options: [{param:'force', description:'Force purge'}] },
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
