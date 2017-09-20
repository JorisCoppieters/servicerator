'use strict'; // JS: ES6

// ******************************
// Requires:
// ******************************

let cprint = require('color-print');
let path = require('path');
let Promise = require('bluebird');

let aws = require('../utils/aws');
let docker = require('../utils/docker');
let edit = require('../utils/edit');
let fs = require('../utils/filesystem');
let http = require('../utils/http');
let print = require('../utils/print');
let service = require('../utils/service');
let shell = require('../utils/shell');
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
    let serviceConfig = service.accessConfig(in_serviceConfig, {
        docker: {
            image: {
                name: 'STRING',
                version: 'STRING'
            },
            container: {
            }
        }
    });

    cprint.magenta('-- Docker --');

    let dockerUsername = docker.getUsername(in_serviceConfig);
    let dockerPassword = docker.getPassword(in_serviceConfig) || false;
    let dockerImageName = serviceConfig.docker.image.name || false;
    let dockerImageVersion = serviceConfig.docker.image.version || false;

    print.keyVal('Docker Username', dockerUsername || '(Not Set)');
    print.keyVal('Docker Password', dockerPassword ? '*******' : '(Not Set)');
    print.out('\n');

    let dockerInstalled = docker.installed();
    if (!dockerInstalled) {
        cprint.yellow('Docker isn\'t installed');
    }

    let dockerRunning = docker.running();
    if (!dockerRunning) {
        cprint.yellow('Docker isn\'t running');
    }

    if (dockerInstalled && dockerRunning) {
        let containerName = getDockerContainerName(in_serviceConfig);
        let containerState = getDockerContainerState(in_serviceConfig, true);

        cprint.magenta('-- Docker Container --');
        print.keyVal('Container Name', containerName);
        print.keyVal('Container State', containerState);
        cprint.magenta('----');
        print.out('\n');

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
            let cmdResult = docker.cmd(args, {
                hide: true
            });

            if (cmdResult.hasError) {
                cmdResult.printError('  ');
                return;
            }

            let imageTagLines = [];

            cmdResult.rows
                .filter(r => dockerImagePaths.find(p => r.match(new RegExp('^' + p + ':'))))
                .forEach(r => {
                    let c = r.split(/\t/);
                    let dockerImage = c[0];
                    let currentDockerImage = (dockerImageTaggedPaths.indexOf(dockerImage) >= 0);
                    if (currentDockerImage) {
                        imageTagLines.push(cprint.toGreen(dockerImage) + ' ' + cprint.toWhite('-') + ' ' + cprint.toCyan(c[1]));
                    } else {
                        imageTagLines.push(cprint.toYellow(dockerImage) + ' ' + cprint.toWhite('-') + ' ' + cprint.toYellow(c[1]));
                    }
                });

            dockerImageTaggedPaths
                .filter(p => !cmdResult.rows.find(r => r.match(new RegExp('^' + p))))
                .forEach(p => {
                    imageTagLines.push(cprint.toYellow(p) + ' ' + cprint.toWhite('-') + ' ' + cprint.toYellow('untagged'));
                });

            imageTagLines = imageTagLines.sort();

            print.out(imageTagLines.join('\n'));
            print.out('\n');
        }
    }
    cprint.magenta('----');
}

// ******************************

function pullDockerImage (in_serviceConfig) {
    let serviceConfig = service.accessConfig(in_serviceConfig, {
        docker: {
            image: {
                name: 'STRING'
            },
            organization: 'STRING',
            other_repositories: [
                {
                    type: 'STRING'
                }
            ]
        }
    });

    if (!docker.installed()) {
        cprint.yellow('Docker isn\'t installed');
        return false;
    }

    if (!docker.running()) {
        cprint.yellow('Docker isn\'t running');
        return false;
    }

    if (!serviceConfig.docker.image.name) {
        cprint.yellow('Docker Image name not set');
        return;
    }

    let dockerUsername = docker.getUsername(in_serviceConfig);
    if (!dockerUsername) {
        cprint.yellow('Docker Image username not set');
        return;
    }

    let dockerImageTags = docker.getImageTags(in_serviceConfig);

    let repos = [
        {
            type: docker.k_REPO_TYPE_DEFAULT,
            username: dockerUsername,
            organization: serviceConfig.docker.organization
        }
    ].concat(serviceConfig.docker.other_repositories || []);

    let tasks = [];

    repos.forEach(repo => {
        let details = _getDockerImageDetails(in_serviceConfig, repo.type, repo.username, repo.organization, serviceConfig.docker.image.name);
        if (!details) {
            return;
        }
        let tags = dockerImageTags;
        if (tags.indexOf('latest') < 0) {
            tags.push('latest');
        }
        tags.forEach(tag => {
            tasks.push(_execCmdOnDockerImageForRepository(details.username, details.password, details.imagePath + ':' + tag, details.repositoryStore, {
                value: 'pull',
                displayName: 'Pulling'
            }));
        });
    });

    sync.runTasks(tasks);
}

// ******************************

function buildDockerImage (in_serviceConfig, in_noCache) {
    let serviceConfig = service.accessConfig(in_serviceConfig, {
        docker: {
            image: {
                name: 'STRING'
            }
        },
        cwd: 'STRING'
    });

    if (!docker.installed()) {
        cprint.yellow('Docker isn\'t installed');
        return false;
    }

    if (!docker.running()) {
        cprint.yellow('Docker isn\'t running');
        return false;
    }

    if (!serviceConfig.docker.image.name) {
        cprint.yellow('Docker Image name not set');
        return;
    }

    let dockerUsername = docker.getUsername(in_serviceConfig);
    if (!dockerUsername) {
        cprint.yellow('Docker Image username not set');
        return;
    }

    let sourceFolder = serviceConfig.cwd || false;
    let dockerFolder = docker.getFolder(sourceFolder);
    if (!dockerFolder || !fs.folderExists(dockerFolder)) {
        cprint.yellow('Docker folder doesn\'t exist');
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
    docker.cmd(args, {
        async: true
    });
}

// ******************************

function pushDockerImage (in_serviceConfig) {
    let serviceConfig = service.accessConfig(in_serviceConfig, {
        docker: {
            password: 'STRING',
            image: {
                name: 'STRING'
            },
            organization: 'STRING',
            other_repositories: [
                {
                    type: 'STRING'
                }
            ]
        }
    });

    if (!docker.installed()) {
        cprint.yellow('Docker isn\'t installed');
        return false;
    }

    if (!docker.running()) {
        cprint.yellow('Docker isn\'t running');
        return false;
    }

    if (!serviceConfig.docker.image.name) {
        cprint.yellow('Docker Image name not set');
        return;
    }

    let dockerUsername = docker.getUsername(in_serviceConfig);
    if (!dockerUsername) {
        cprint.yellow('Docker Image username not set');
        return;
    }

    let repos = [
        {
            type: docker.k_REPO_TYPE_DEFAULT,
            username: dockerUsername,
            password: serviceConfig.docker.password,
            organization: serviceConfig.docker.organization
        }
    ].concat(serviceConfig.docker.other_repositories || []);

    let tasks = [];

    repos.forEach(repo => {
        let details = _getDockerImageDetails(in_serviceConfig, repo.type, repo.username, repo.organization, serviceConfig.docker.image.name);
        if (!details) {
            return;
        }
        tasks.push(_execCmdOnDockerImageForRepository(details.username, details.password, details.imagePath, details.repositoryStore, {
            value: 'push',
            displayName: 'Pushing'
        }));
    });

    sync.runTasks(tasks);
}

// ******************************

function cleanDockerImages (in_serviceConfig, in_force) {
    let serviceConfig = service.accessConfig(in_serviceConfig, {
        docker: {
            image: {
                name: 'STRING'
            }
        }
    });

    if (!docker.installed()) {
        cprint.yellow('Docker isn\'t installed');
        return false;
    }

    if (!docker.running()) {
        cprint.yellow('Docker isn\'t running');
        return false;
    }

    if (!serviceConfig.docker.image.name) {
        cprint.yellow('Docker Image name not set');
        return;
    }

    let dockerUsername = docker.getUsername(in_serviceConfig);
    if (!dockerUsername) {
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
        .filter(r => !r.match(/<none>/))
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
    docker.cmd(args, {
        async: true
    });
}

// ******************************

function purgeDockerImages (in_serviceConfig, in_force) {
    let serviceConfig = service.accessConfig(in_serviceConfig, {
        docker: {
            image: {
                name: 'STRING'
            }
        }
    });

    if (!docker.installed()) {
        cprint.yellow('Docker isn\'t installed');
        return false;
    }

    if (!docker.running()) {
        cprint.yellow('Docker isn\'t running');
        return false;
    }

    if (!serviceConfig.docker.image.name) {
        cprint.yellow('Docker Image name not set');
        return;
    }

    let dockerUsername = docker.getUsername(in_serviceConfig);
    if (!dockerUsername) {
        cprint.yellow('Docker Image username not set');
        return;
    }

    let zombieDockerImageIds = _getZombieDockerImageIds();

    let args = ['images', '--format', '{{.Repository}}:{{.Tag}}\t{{.ID}}'];
    let cmdResult = docker.cmd(args, {
        hide: true
    });

    if (cmdResult.hasError) {
        cmdResult.printError('  ');
        return;
    }

    let dockerImagePaths = _getDockerImagePaths(in_serviceConfig);

    let purgeImageTags = cmdResult.rows
        .filter(r => dockerImagePaths.find(p => r.match(new RegExp('^' + p + ':'))))
        .filter(r => !r.match(/<none>/))
        .map(r => r.split(/\t/)[0])
        .filter((elem, pos, self) => { return self.indexOf(elem) === pos; });

    let purgeImageTagsAndIds = []
        .concat(purgeImageTags || [])
        .concat(zombieDockerImageIds || []);

    if (!purgeImageTagsAndIds.length) {
        cprint.green('Nothing to be purged');
        return;
    }

    args = ['rmi'];
    if (in_force) {
        args.push('-f');
    }
    args = args.concat(purgeImageTagsAndIds);
    cprint.backgroundRed(cprint.toYellow('Removing ALL Docker images for service...', true));
    docker.cmd(args, {
        async: true
    });
}

// ******************************
// Version Functions:
// ******************************

function printDockerImageVersion (in_serviceConfig) {
    let serviceConfig = service.accessConfig(in_serviceConfig, {
        docker: {
            image: {
                version: 'STRING'
            }
        }
    });

    let dockerImageVersion = serviceConfig.docker.image.version || false;
    cprint.green(dockerImageVersion);
}

// ******************************

function setDockerImageVersion (in_serviceConfig, in_M, in_m, in_b, in_version) {
    let serviceConfig = service.accessConfig(in_serviceConfig, {
        docker: {
            image: {
                version: 'STRING'
            }
        }
    });

    if (in_version) {
        service.updateConfig(in_serviceConfig, {
            docker: {
                image: {
                    version: in_version
                }
            }
        });
        return true;
    }

    let dockerImageVersion = serviceConfig.docker.image.version || false;
    if (!dockerImageVersion || !dockerImageVersion.match(/[0-9]+\.[0-9]+\.[0-9]+/)) {
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

    service.updateConfig(in_serviceConfig, {
        docker: {
            image: {
                version: version
            }
        }
    });
    return true;
}

// ******************************
// Login Functions:
// ******************************

function dockerLogin (in_serviceConfig) {
    let serviceConfig = service.accessConfig(in_serviceConfig, {
        docker: {
            image: {
                name: 'STRING'
            }
        }
    });

    if (!docker.installed()) {
        cprint.yellow('Docker isn\'t installed');
        return false;
    }

    if (!docker.running()) {
        cprint.yellow('Docker isn\'t running');
        return false;
    }

    let dockerUsername = docker.getUsername(in_serviceConfig);
    if (!dockerUsername) {
        cprint.yellow('Docker Image username not set');
        return;
    }

    let dockerOrganization = false;

    let dockerImageDetails = _getDockerImageDetails(
        in_serviceConfig,
        docker.k_REPO_TYPE_DEFAULT,
        dockerUsername,
        dockerOrganization,
        serviceConfig.docker.image.name);

    docker.login(dockerImageDetails.username, dockerImageDetails.password, dockerImageDetails.repositoryStore);
}

// ******************************
// Container Functions:
// ******************************

function startDockerContainer (in_serviceConfig) {
    if (!docker.installed()) {
        cprint.yellow('Docker isn\'t installed');
        return false;
    }

    if (!docker.running()) {
        cprint.yellow('Docker isn\'t running');
        return false;
    }

    _startDockerContainer(in_serviceConfig);
}

// ******************************

function enterDockerContainer (in_serviceConfig) {
    if (!docker.installed()) {
        cprint.yellow('Docker isn\'t installed');
        return false;
    }

    if (!docker.running()) {
        cprint.yellow('Docker isn\'t running');
        return false;
    }

    let runningDockerContainerId = getRunningDockerContainerId(in_serviceConfig);
    if (!runningDockerContainerId) {
        _startDockerContainer(in_serviceConfig, true);
        return;
    }

    let containerName = getDockerContainerName(in_serviceConfig);

    let args = [
        'docker',
        'exec',
        '--interactive',
        '--tty',
        runningDockerContainerId,
        'bash'
    ];

    cprint.cyan('Entering Docker container "' + containerName + '"...');
    let cmdResult = shell.cmd(args);
    if (cmdResult.hasError) {
        cmdResult.printError('  ');
    } else {
        cmdResult.printResult('  ');
    }
}

// ******************************

function stopDockerContainer (in_serviceConfig) {
    if (!docker.installed()) {
        cprint.yellow('Docker isn\'t installed');
        return false;
    }

    if (!docker.running()) {
        cprint.yellow('Docker isn\'t running');
        return false;
    }

    let dockerImageIds = _getDockerImageIds(in_serviceConfig);
    dockerImageIds.forEach(id => stopDockerImageIdContainer(id));

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

function stopDockerImageIdContainer (in_dockerImageId) {
    if (!docker.installed()) {
        cprint.yellow('Docker isn\'t installed');
        return false;
    }

    if (!docker.running()) {
        cprint.yellow('Docker isn\'t running');
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

    if (!docker.running()) {
        cprint.yellow('Docker isn\'t running');
        return false;
    }

    if (getDockerContainerState(in_serviceConfig) === docker.k_STATE_UNKNOWN) {
        cprint.yellow('No stopped container found');
        return;
    }

    stopDockerContainer(in_serviceConfig);
    if (getDockerContainerState(in_serviceConfig) === docker.k_STATE_UNKNOWN) {
        return;
    }

    let dockerImageIds = _getDockerImageIds(in_serviceConfig);
    dockerImageIds.forEach(id => removeDockerImageIdContainer(id));

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

    if (!docker.running()) {
        cprint.yellow('Docker isn\'t running');
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

function verifyDockerContainer (in_serviceConfig) {
    let serviceConfig = service.accessConfig(in_serviceConfig, {
        docker: {
            image: {
                tests: [
                    {
                        name: 'STRING',
                        type: 'STRING',
                        method: 'STRING',
                        url: 'URL',
                        request_data: 'ANY',
                        expected: 'STRING'
                    }
                ]
            }
        }
    });

    if (!docker.installed()) {
        cprint.yellow('Docker isn\'t installed');
        return false;
    }

    if (!docker.running()) {
        cprint.yellow('Docker isn\'t running');
        return false;
    }

    if (getDockerContainerState(in_serviceConfig) !== docker.k_STATE_RUNNING) {
        cprint.yellow('No running container found');
        return;
    }

    let tests = serviceConfig.docker.image.tests || [];
    if (!tests.length) {
        cprint.yellow('No tests have been setup');
        return;
    }

    cprint.cyan('Running tests:');
    tests.forEach(t => {
        switch (t.type)
        {
            case docker.k_TEST_TYPE_URL:

                let httpFunc = t.method === 'POST' ? http.post : http.get;

                httpFunc(t.url, t.request_data)
                    .then((receivedData) => {
                        let receivedString = JSON.stringify(receivedData);
                        let regExp = new RegExp(t.expected);
                        if (receivedString.match(regExp)) {
                            cprint.green('  ✔ ' + t.name);
                        } else {
                            cprint.red('  ✘ ' + t.name);
                            cprint.yellow('    Expected: ' + t.expected);
                            cprint.yellow('    Received: ' + receivedString);
                        }
                    })
                    .catch((e) => {
                        cprint.red('  ✘ ' + t.name);
                        cprint.yellow('    Expected: ' + t.expected);
                        cprint.yellow('    Received: ' + e);
                    });

                break;
        }
    });
}

// ******************************

function getDockerContainerName (in_serviceConfig) {
    let serviceConfig = service.accessConfig(in_serviceConfig, {
        docker: {
            image: {
                name: 'STRING'
            },
            container: {
                name: 'STRING'
            }
        }
    });

    let containerName = serviceConfig.docker.container.name || serviceConfig.docker.image.name || 'container';
    return containerName;
}

// ******************************

function getDockerContainerState (in_serviceConfig, in_nice) {
    if (!docker.installed()) {
        cprint.yellow('Docker isn\'t installed');
        return false;
    }

    if (!docker.running()) {
        cprint.yellow('Docker isn\'t running');
        return false;
    }

    let containerName = getDockerContainerName(in_serviceConfig);

    let args = ['ps', '-a', '--format', '{{.ID}}\t{{.Image}}\t{{.Status}}\t{{.Names}}'];
    let cmdResult = docker.cmd(args, {
        hide: true
    });

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

    if (!docker.running()) {
        cprint.yellow('Docker isn\'t running');
        return false;
    }

    let containerName = getDockerContainerName(in_serviceConfig);

    let args = ['ps', '-a', '--format', '{{.ID}}\t{{.Image}}\t{{.Status}}\t{{.Names}}'];
    let cmdResult = docker.cmd(args, {
        hide: true
    });
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

    if (!docker.running()) {
        cprint.yellow('Docker isn\'t running');
        return false;
    }

    let args = [];
    args.push('ps');
    if (in_includeStopped) {
        args.push('-a');
    }
    args.push('--format');
    args.push('{{.ID}} - {{.Image}}');

    let cmdResult = docker.cmd(args, {
        hide: true
    });
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

    if (!docker.running()) {
        cprint.yellow('Docker isn\'t running');
        return false;
    }

    let containerName = getDockerContainerName(in_serviceConfig);
    let containerState = getDockerContainerState(in_serviceConfig, true);

    cprint.magenta('-- Docker Container --');
    print.keyVal('Container Name', containerName);
    print.keyVal('Container State', containerState);
    cprint.magenta('----');

    return false;
}


// ******************************

function editServiceDockerfile (in_serviceConfig) {
    let serviceConfig = service.accessConfig(in_serviceConfig, {
        cwd: 'STRING'
    });

    let sourceFolder = serviceConfig.cwd || false;
    if (!sourceFolder) {
        cprint.yellow("Source folder not set");
        return;
    }

    let serviceDockerfile = docker.getDockerfile(sourceFolder);
    if (!serviceDockerfile) {
        cprint.yellow("Service Dockerfile not set");
        return;
    }

    edit.file(serviceDockerfile);
}

// ******************************
// Helper Functions:
// ******************************

function _startDockerContainer (in_serviceConfig, in_useBash) {
    let serviceConfig = service.accessConfig(in_serviceConfig, {
        docker: {
            image: {
                name: 'STRING'
            },
            organization: 'STRING',
            container: {
                memory_limit: 'NUMBER',
                ports: [
                    {
                        host: 'NUMBER',
                        container: 'NUMBER',
                        test: 'BOOLEAN'
                    }
                ],
                volumes: [
                    {
                        host: 'STRING',
                        container: 'STRING'
                    }
                ],
                commands: [
                    {
                        test: 'BOOLEAN',
                        val: 'STRING'
                    }
                ]
            }
        },
        service: {
            name: 'STRING'
        },
        cwd: 'STRING'
    });

    let serviceName = serviceConfig.service.name || 'service';
    let memoryLimit = serviceConfig.docker.container.memory_limit || false;

    let sourceFolder = serviceConfig.cwd || false;
    let dockerFolder = docker.getFolder(sourceFolder);
    if (!dockerFolder || !fs.folderExists(dockerFolder)) {
        cprint.yellow('Docker folder doesn\'t exist');
        return;
    }

    let dockerUsername = docker.getUsername(in_serviceConfig);
    let dockerImageName = serviceConfig.docker.image.name;
    let dockerImageTags = docker.getImageTags(in_serviceConfig) || [];
    let dockerImageTag = dockerImageTags[0] || 'latest';

    let dockerImageDetails = _getDockerImageDetails(
        in_serviceConfig,
        docker.k_REPO_TYPE_DEFAULT,
        dockerUsername,
        serviceConfig.docker.organization,
        serviceConfig.docker.image.name);

    let dockerImagePath = dockerImageDetails.shortImagePath;
    let dockerImageStartCommand = '';

    serviceConfig.docker.container.commands.forEach(command => {
        if (command.test) {
            dockerImageStartCommand = command.val;
            return;
        }
    });

    if (getDockerContainerState(in_serviceConfig) !== docker.k_STATE_UNKNOWN) {
        removeDockerContainer(in_serviceConfig);
    }

    let runWithBash = false;
    if (!dockerImageStartCommand || in_useBash) {
        runWithBash = true;
    }

    let containerName = getDockerContainerName(in_serviceConfig);

    let args = [];
    args.push('run');
    args.push('--rm');
    args.push('--name');
    args.push(containerName);

    if (runWithBash) {
        args.push('--interactive');
        args.push('--tty');
    } else {
        args.push('--detach');
    }

    if (memoryLimit) {
        args.push('--memory');
        args.push(parseInt(memoryLimit) + 'm');
    }

    let testPortArgs = {};
    let portArgs = {};

    serviceConfig.docker.container.ports.forEach(port => {
        if (!port.host || !port.container) {
            return;
        }

        if (port.test) {
            testPortArgs[port.container] = port.host;
        } else {
            portArgs[port.container] = port.host;
        }
    });

    Object.assign(portArgs, testPortArgs);
    Object.keys(portArgs).forEach(containerPort => {
        let hostPort = portArgs[containerPort];
        args.push('--publish');
        args.push(hostPort + ':' + containerPort);
    });

    serviceConfig.docker.container.volumes.forEach(volume => {
        if (!volume.host || !volume.container) {
            return;
        }

        let volumeContainer = volume.container;

        let volumeHost = path.resolve(volume.host);
        if (!fs.folderExists(volumeHost)) {
            volumeHost = path.resolve(dockerFolder, volume.host);
        }

        if (volumeHost.match(/^[A-Z]:[\\\/]?$/)) {
            volumeHost = '"' + volumeHost + '\."';
        }

        if (!runWithBash) {
            volumeHost = volumeHost.replace(new RegExp('\\\\', 'g'), '/');
        } else {
            volumeHost = '"' + volumeHost + '"';
        }

        volumeHost = service.replaceConfigReferences(in_serviceConfig, volumeHost);
        volumeContainer = service.replaceConfigReferences(in_serviceConfig, volumeContainer);

        args.push('--volume');
        args.push(volumeHost + ':' + volumeContainer);
    });

    args.push(dockerImagePath);

    if (runWithBash) {
        cprint.cyan('Starting Docker container "' + containerName + '"...');
        let cmdResult = shell.cmd(['docker'].concat(args).concat(['bash']));
        if (cmdResult.hasError) {
            cmdResult.printError('  ');
        } else {
            cmdResult.printResult('  ');
        }
    } else {
        args.push(dockerImageStartCommand);
        cprint.cyan('Starting Docker container "' + containerName + '"...');
        let cmdResult = docker.cmd(args);
        if (cmdResult.hasError) {
            cmdResult.printError('  ');
        } else {
            cmdResult.printResult('  ');
        }
    }
}

// ******************************

function _execCmdOnDockerImageForRepository (in_dockerUsername, in_dockerPassword, in_dockerImagePath, in_dockerRepositoryStore, in_cmd) {
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

            // _dockerLogin(in_dockerUsername, in_dockerPassword, in_dockerRepositoryStore);

            if (!in_cmd || !in_cmd.displayName || !in_cmd.value) {
                cprint.yellow('Invalid command: ' + in_cmd);
                return reject();
            }

            cprint.cyan(in_cmd.displayName + ' Docker image "' + in_dockerImagePath + '" for service...');
            let args = [in_cmd.value];
            args = args.concat(in_dockerImagePath);
            docker.cmd(args, {
                async: true,
                asyncCb: resolve
            });
        });
    }
}

// ******************************

function _getDockerImageDetails (in_serviceConfig, in_repositoryType, in_dockerUsername, in_dockerRepository, in_dockerImageName, in_dockerRepositoryStore) {
    let dockerUsername;
    let dockerPassword;
    let dockerRepository;
    let dockerRepositoryStore;
    let dockerImagePath;
    let shortDockerImagePath;

    switch (in_repositoryType)
    {
        case docker.k_REPO_TYPE_DEFAULT:
            dockerUsername = in_dockerUsername;
            dockerPassword = docker.getPassword(in_serviceConfig);
            dockerRepository = in_dockerRepository || in_dockerUsername;
            dockerRepositoryStore = in_dockerRepositoryStore || docker.getDefaultRepositoryStore();
            dockerImagePath = dockerRepositoryStore + '/' + dockerRepository + '/' + in_dockerImageName;
            shortDockerImagePath = dockerRepository + '/' + in_dockerImageName;
            break;
        case docker.k_REPO_TYPE_AWS:
            if (!aws.installed()) {
                cprint.yellow('AWS-CLI isn\'t installed');
                return false;
            }
            let awsDockerCredentials = _getAwsDockerCredentials(in_serviceConfig);
            dockerUsername = awsDockerCredentials.username;
            dockerPassword = awsDockerCredentials.password;
            dockerRepository = awsDockerCredentials.username;
            dockerRepositoryStore = aws.getDockerRepositoryUrl(in_serviceConfig);
            dockerImagePath = dockerRepositoryStore + '/' + in_dockerImageName;
            shortDockerImagePath = dockerRepositoryStore + '/' + in_dockerImageName;
            break;
    }

    let details = {
        username: dockerUsername,
        password: dockerPassword,
        repository: dockerRepository,
        repositoryStore: dockerRepositoryStore,
        imagePath: dockerImagePath,
        shortImagePath: shortDockerImagePath
    };

    return details;
}

// ******************************

function _getDockerImagePaths (in_serviceConfig) {
    let serviceConfig = service.accessConfig(in_serviceConfig, {
        docker: {
            image: {
                name: 'STRING'
            },
            organization: 'STRING',
            other_repositories: [
                {
                    type: 'STRING'
                }
            ]
        }
    });

    if (!serviceConfig.docker.image.name) {
        cprint.yellow('Docker Image name not set');
        return;
    }

    let dockerOrganization = serviceConfig.docker.organization;

    let dockerUsername = docker.getUsername(in_serviceConfig);
    if (!dockerUsername) {
        cprint.yellow('Docker Image username not set');
        return;
    }

    let repos = [
        {
            type: docker.k_REPO_TYPE_DEFAULT,
            username: dockerUsername,
            organization: serviceConfig.docker.organization
        }
    ].concat(serviceConfig.docker.other_repositories || []);

    return repos
        .map(repo => _getDockerImageDetails(in_serviceConfig, repo.type, repo.username, repo.organization, serviceConfig.docker.image.name))
        .filter(details => !!details)
        .map(details => details.shortImagePath);
}

// ******************************

function _getDockerImageIds (in_serviceConfig) {
    let dockerImagePaths = _getDockerImagePaths(in_serviceConfig);

    let args = ['images', '--format', '{{.Repository}}:{{.Tag}}\t{{.ID}}'];
    let cmdResult = docker.cmd(args, {
        hide: true
    });

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
    let cmdResult = docker.cmd(args, {
        hide: true
    });

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

function _dockerLogin (in_dockerUsername, in_dockerPassword, in_dockerRepositoryStore) {
    if (g_CURRENT_DOCKER_USERNAME !== in_dockerUsername) {
        docker.login(in_dockerUsername, in_dockerPassword, in_dockerRepositoryStore);
        g_CURRENT_DOCKER_USERNAME = in_dockerUsername;
    }
}

// ******************************
// Plugin Functions:
// ******************************

function handleCommand (in_args, in_params, in_serviceConfig) {
    let command = in_params.length ? in_params.shift().toLowerCase() : '';
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
        case 'run':
        case 'run-container':
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

        case 'verify':
        case 'verify-container':
        case 'test':
        case 'test-container':
        case 'tests':
            verifyDockerContainer(in_serviceConfig);
            break;

        case 'edit':
        case 'config':
        case 'configure':
            editServiceDockerfile(in_serviceConfig);
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
            {param:'+M', description:'Increment major version (i.e 1.0.0 -> 2.0.0)'},
            {param:'M', description:'Decrement major version (i.e 3.0.0 -> 2.0.0)'},
            {param:'+m', description:'Increment minor version (i.e 2.9.0 -> 2.10.0)'},
            {param:'m', description:'Decrement minor version (i.e 2.11.0 -> 2.10.0)'},
            {param:'+b', description:'Increment bug version (i.e 1.2.5 -> 1.2.6)'},
            {param:'b', description:'Decrement bug version (i.e 1.2.7 -> 1.2.6)'}
        ]},
        { params: ['start-container', 'start', 'run', 'run-container'], description: 'Start the service docker container' },
        { params: ['enter-container', 'enter', 'interact', 'interactive'], description: 'Enter the running service docker container' },
        { params: ['stop-container', 'stop'], description: 'Stop the service docker container' },
        { params: ['remove-container', 'remove', 'rm'], description: 'Remove the service docker container' },
        { params: ['verify-container', 'verify', 'test-container', 'test', 'tests'], description: 'Verify the service docker container' },
        { params: ['container', 'stats', 'state', 'running'], description: 'Print the current state of the service docker container' },
        { params: ['login'], description: 'Log into docker' },
        { params: ['pull'], description: 'Pull the service docker image' },
        { params: ['build'], description: 'Build the service docker image', options: [{param:'no-cache', description:'Don\'t use cached images'}] },
        { params: ['push'], description: 'Push the service docker image' },
        { params: ['clean'], description: 'Clean up service temporary docker images', options: [{param:'force', description:'Force clean'}] },
        { params: ['purge'], description: 'Remove all service docker images', options: [{param:'force', description:'Force purge'}] },
        { params: ['edit', 'config', 'configure'], description: 'Edit the Dockerfile' },
    ];
}

// ******************************

function getTitle () {
    return 'Docker';
}

// ******************************

function runTests () {
}

// ******************************
// Exports:
// ******************************

module.exports['handleCommand'] = handleCommand;
module.exports['getBaseCommands'] = getBaseCommands;
module.exports['getCommands'] = getCommands;
module.exports['getTitle'] = getTitle;
module.exports['runTests'] = runTests;

// ******************************
