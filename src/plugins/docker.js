'use strict'; // JS: ES6

// ******************************
// Requires:
// ******************************

let cprint = require('color-print');

let aws = require('../utils/aws');
let cache = require('../utils/cache');
let docker = require('../utils/docker');
let edit = require('../utils/edit');
let fs = require('../utils/filesystem');
let http = require('../utils/http');
let print = require('../utils/print');
let service = require('../utils/service');
let shell = require('../utils/shell');
let sync = require('../utils/sync');

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

    let dockerImageDetails = _getDockerImageDetails(
        in_serviceConfig,
        serviceConfig.docker.organization,
        serviceConfig.docker.image.name
    );
    if (!dockerImageDetails) {
        return;
    }

    let dockerImageName = serviceConfig.docker.image.name || false;
    let dockerImageVersion = serviceConfig.docker.image.version || false;

    print.keyVal('Docker Username', dockerImageDetails.username || '(Not Set)');
    print.keyVal('Docker Password', dockerImageDetails.password ? '*******' : '(Not Set)');
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

        if (dockerImageName && dockerImageDetails.username && docker.installed()) {
            let dockerImageTags = docker.getImageTags(in_serviceConfig, {
                includeVersionControlTags: true
            });
            let dockerImagePath = _getDockerImagePath(in_serviceConfig);

            let dockerImageTaggedPaths = [];
            dockerImageTags.forEach(t => {
                dockerImageTaggedPaths.push(dockerImagePath + ':' + t);
            });

            cprint.magenta('-- Docker Image Paths --');
            print.keyVal('Docker Image Path', dockerImagePath);
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
                .filter(r => r.match(new RegExp('^' + dockerImagePath + ':')))
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
            organization: 'STRING'
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

    let dockerImageTags = docker.getImageTags(in_serviceConfig, {
        includeVersionControlTags: true
    });

    let dockerImageDetails = _getDockerImageDetails(
        in_serviceConfig,
        serviceConfig.docker.organization,
        serviceConfig.docker.image.name
    );
    if (!dockerImageDetails) {
        return;
    }

    let tasks = dockerImageTags
        .filter(tag => tag !== 'latest')
        .concat(['latest'])
        .map(tag => docker.getImageExecTask(
            dockerUsername,
            dockerImageDetails.password,
            dockerImageDetails.imagePath + ':' + tag,
            dockerImageDetails.repositoryStore,
            {
                value: 'pull',
                displayName: 'Pulling'
            }
        ));

    sync.runTasks(tasks);
}

// ******************************

function buildDockerImage (in_serviceConfig, in_noCache) {
    let serviceConfig = service.accessConfig(in_serviceConfig, {
        docker: {
            image: {
                name: 'STRING'
            },
            args: [
                {
                    key: 'STRING',
                    val: 'STRING',
                    type: 'STRING'
                }
            ],
            build_folder: 'STRING'
        },
        cwd: 'STRING'
    });

    let path = require('path');

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

    let dockerFolder = serviceConfig.docker.build_folder;
    if (dockerFolder) {
        dockerFolder = service.replaceConfigReferences(in_serviceConfig, dockerFolder);
        dockerFolder = path.resolve(dockerFolder);
    } else {
        dockerFolder = docker.getFolder(sourceFolder);
    }

    if (!dockerFolder || !fs.folderExists(dockerFolder)) {
        cprint.yellow('Docker folder doesn\'t exist');
        return;
    }

    let serviceDockerfile = docker.getDockerfile(sourceFolder);
    if (!serviceDockerfile) {
        cprint.yellow('Service Dockerfile not set');
        return;
    }

    let dockerImageTags = docker.getImageTags(in_serviceConfig, {
        includeVersionControlTags: true
    });
    let dockerImagePath = _getDockerImagePath(in_serviceConfig);

    let dockerImageTaggedPaths = [];
    dockerImageTags.forEach(t => {
        dockerImageTaggedPaths.push(dockerImagePath + ':' + t);
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

    if (serviceConfig.docker.args && serviceConfig.docker.args.length) {
        serviceConfig.docker.args.forEach(arg => {
            let argKey = arg.key;

            let argVal = arg.val;
            argVal = service.replaceConfigReferences(in_serviceConfig, argVal);

            switch (arg.type) {
            case 'path':
                argVal = argVal.replace(new RegExp('\\\\', 'g'), '/');
                break;
            }

            args.push('--build-arg');
            args.push(`${argKey}=${argVal}`);
        });
    }

    args.push('--file');
    args.push(serviceDockerfile);

    args.push(dockerFolder);

    cprint.cyan('Building Docker image...');
    docker.cmd(args, {
        async: true,
        asyncCb: (result) => {
            if (result) {
                _printSuccessHeader('Docker build succeeded!', '  ');
            } else {
                _printErrorHeader('Docker build failed!', '  ');
            }
        }
    });

    return true;
}

// ******************************

function _printSuccessHeader (in_title, in_indent) {
    let backgroundFn = cprint.backgroundCyan;
    let foregroundFn = cprint.toWhite;

    in_indent = in_indent || '';
    print.out('\n');
    print.out(in_indent);
    backgroundFn(foregroundFn(' '.repeat(in_title.length + 4), true));
    print.out(in_indent);
    backgroundFn(foregroundFn('  ' + in_title + '  ', true));
    print.out(in_indent);
    backgroundFn(foregroundFn(' '.repeat(in_title.length + 4), true));
    print.out('\n');
}

// ******************************

function _printErrorHeader (in_title, in_indent) {
    let backgroundFn = cprint.backgroundYellow;
    let foregroundFn = cprint.toBlack;

    in_indent = in_indent || '';
    print.out('\n');
    print.out(in_indent);
    backgroundFn(foregroundFn(' '.repeat(in_title.length + 4), true));
    print.out(in_indent);
    backgroundFn(foregroundFn('  ' + in_title + '  ', true));
    print.out(in_indent);
    backgroundFn(foregroundFn(' '.repeat(in_title.length + 4), true));
    print.out('\n');
}

// ******************************

function pushDockerImage (in_serviceConfig) {
    let serviceConfig = service.accessConfig(in_serviceConfig, {
        docker: {
            password: 'STRING',
            image: {
                name: 'STRING'
            },
            organization: 'STRING'
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

    let dockerImageDetails = _getDockerImageDetails(
        in_serviceConfig,
        serviceConfig.docker.organization,
        serviceConfig.docker.image.name
    );
    if (!dockerImageDetails) {
        return;
    }

    let tasks = [
        docker.getImageExecTask(
            dockerImageDetails.username,
            dockerImageDetails.password,
            dockerImageDetails.imagePath,
            dockerImageDetails.repositoryStore, {
                value: 'push',
                displayName: 'Pushing'
            }
        )
    ];

    sync.runTasks(tasks);
    return true;
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

    let dockerImageTags = docker.getImageTags(in_serviceConfig, {
        includeVersionControlTags: true
    });
    let dockerImagePath = _getDockerImagePath(in_serviceConfig);

    let dockerImageTaggedPaths = [];
    dockerImageTags.forEach(t => {
        dockerImageTaggedPaths.push(dockerImagePath + ':' + t);
    });

    let zombieDockerImageIds = _getZombieDockerImageIds();

    let args = ['images', '--format', '{{.Repository}}:{{.Tag}}\t{{.ID}}'];
    let cmdResult = docker.cmd(args);

    if (cmdResult.hasError) {
        cmdResult.printError('  ');
        return;
    }

    let allImages = cmdResult.rows;

    let nonLatestImageTags = allImages
        .filter(r => r.match(new RegExp('^' + dockerImagePath + ':')))
        .filter(r => !r.match(/<none>/))
        .map(r => r.split(/\t/)[0])
        .filter(r => dockerImageTaggedPaths.indexOf(r) < 0);

    let imageIds = allImages
        .filter(r => r.match(new RegExp('^' + dockerImagePath + ':')))
        .map(r => r.split(/\t/)[1])
        .reduce((unique, r) => { if (unique.indexOf(r) < 0) { unique.push(r); } return unique; }, []);

    let otherImageTags = allImages
        .filter(r => imageIds.indexOf(r.split(/\t/)[1]) >= 0)
        .filter(r => dockerImageTaggedPaths.indexOf(r.split(/\t/)[0]) < 0)
        .map(r => r.split(/\t/)[0]);

    let cleanImageTagsAndIds = []
        .concat(nonLatestImageTags || [])
        .concat(otherImageTags || [])
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

    let dockerImagePath = _getDockerImagePath(in_serviceConfig);

    let purgeImageTags = cmdResult.rows
        .filter(r => r.match(new RegExp('^' + dockerImagePath + ':')))
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

function incrementalPushDockerImage (in_serviceConfig) {
    let serviceConfig = setDockerImageVersion(in_serviceConfig, [], ['+b']);
    if (!serviceConfig) {
        return;
    }

    if (!buildDockerImage(serviceConfig)) {
        return;
    }

    if (!pushDockerImage(serviceConfig)) {
        return;
    }
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

function setDockerImageVersion (in_serviceConfig, in_args, in_params) {
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

    let serviceConfig = service.accessConfig(in_serviceConfig, {
        docker: {
            image: {
                version: 'STRING'
            }
        }
    });

    if (version) {
        let updatedServiceConfig = service.updateConfig(in_serviceConfig, {
            docker: {
                image: {
                    version: version
                }
            }
        });
        return updatedServiceConfig;
    }

    let dockerImageVersion = serviceConfig.docker.image.version || false;
    if (!dockerImageVersion || !dockerImageVersion.match(/[0-9]+\.[0-9]+\.[0-9]+/)) {
        cprint.yellow('Docker image version cannot be incremented');
        return false;
    }

    let versionParts = dockerImageVersion.split(/[.]/);
    if (M === -1 || M === 1) {
        versionParts[0] = Math.max(0, parseInt(versionParts[0]) + M);
        versionParts[1] = 0;
        versionParts[2] = 0;
    } else if (m === -1 || m === 1) {
        versionParts[1] = Math.max(0, parseInt(versionParts[1]) + m);
        versionParts[2] = 0;
    } else if (b === -1 || b === 1) {
        versionParts[2] = Math.max(0, parseInt(versionParts[2]) + b);
    }

    version = versionParts.join('.');
    if (version === '0.0.0') {
        version = '0.0.1';
    }

    let updatedServiceConfig = service.updateConfig(in_serviceConfig, {
        docker: {
            image: {
                version: version
            }
        }
    });

    return updatedServiceConfig;
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
        dockerOrganization,
        serviceConfig.docker.image.name
    );
    if (!dockerImageDetails) {
        return;
    }

    docker.login(dockerImageDetails.username, dockerImageDetails.password, dockerImageDetails.repositoryStore);
}

// ******************************
// Container Functions:
// ******************************

function startDockerContainer (in_serviceConfig, in_attach) {
    if (!docker.installed()) {
        cprint.yellow('Docker isn\'t installed');
        return false;
    }

    if (!docker.running()) {
        cprint.yellow('Docker isn\'t running');
        return false;
    }

    _startDockerContainer(in_serviceConfig, {
        attach: in_attach
    });
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
        _startDockerContainer(in_serviceConfig, {
            useBash: true
        });
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
    if (!cmdResult) {
        return;
    }

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
        let httpFunc = t.method === 'POST' ? http.post : http.get;

        switch (t.type)
        {
        case docker.k_TEST_TYPE_URL:

            httpFunc(t.url, t.request_data,
                (receivedData) => { // On Success
                    let receivedString = JSON.stringify(receivedData);
                    let regExp = new RegExp(t.expected);
                    if (receivedString.match(regExp)) {
                        cprint.green('  ✔ ' + t.name);
                    } else {
                        cprint.red('  ✘ ' + t.name);
                        cprint.yellow('    Expected: ' + t.expected);
                        cprint.yellow('    Received: ' + receivedString);
                    }
                }, (e) => { // On Error
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

function getRunningDockerContainerId (in_serviceConfig) {
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
        cprint.yellow('Source folder not set');
        return;
    }

    let serviceDockerfile = docker.getDockerfile(sourceFolder);
    if (!serviceDockerfile) {
        cprint.yellow('Service Dockerfile not set');
        return;
    }

    edit.file(serviceDockerfile);
}

// ******************************
// Helper Functions:
// ******************************

function _startDockerContainer (in_serviceConfig, in_options) {
    let opt = in_options || {};

    let useBash = opt.useBash;
    let attach = opt.attach;

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
                        local: 'BOOLEAN'
                    }
                ],
                volumes: [
                    {
                        host: 'STRING',
                        container: 'STRING',
                        local: 'BOOLEAN'
                    }
                ],
                commands: [
                    {
                        local: 'BOOLEAN',
                        val: 'STRING'
                    }
                ],
                environment_variables: [
                    {
                        key: 'STRING',
                        value: 'STRING',
                        local: 'BOOLEAN'
                    }
                ]
            },
            build_folder: 'STRING'
        },
        model: {
            version: 'STRING'
        },
        service: {
            clusters: [
                {
                    aws: {
                        bucket: {
                            name: 'STRING'
                        }
                    },
                    environment: 'STRING',
                    default: 'BOOLEAN'
                }
            ],
            name: 'STRING'
        },
        cwd: 'STRING'
    });

    let path = require('path');

    let memoryLimit = serviceConfig.docker.container.memory_limit || false;

    let sourceFolder = serviceConfig.cwd || false;

    let dockerFolder = serviceConfig.docker.build_folder;
    if (dockerFolder) {
        dockerFolder = service.replaceConfigReferences(in_serviceConfig, dockerFolder);
        dockerFolder = path.resolve(dockerFolder);
    } else {
        dockerFolder = docker.getFolder(sourceFolder);
    }

    if (!dockerFolder || !fs.folderExists(dockerFolder)) {
        cprint.yellow('Docker folder doesn\'t exist');
        return;
    }

    if (getDockerContainerState(in_serviceConfig) !== docker.k_STATE_UNKNOWN) {
        removeDockerContainer(in_serviceConfig);
    }

    let dockerImageDetails = _getDockerImageDetails(
        in_serviceConfig,
        serviceConfig.docker.organization,
        serviceConfig.docker.image.name
    );
    if (!dockerImageDetails) {
        return;
    }

    let dockerImagePath = dockerImageDetails.shortImagePath;

    let localDockerImageStartCommand = false;
    let dockerImageStartCommand = false;

    serviceConfig.docker.container.commands.forEach(command => {
        if (command.local) {
            localDockerImageStartCommand = command.val;
        } else {
            dockerImageStartCommand = command.val;
        }
    });

    dockerImageStartCommand = localDockerImageStartCommand || dockerImageStartCommand;

    let runWithBash = false;
    if (!dockerImageStartCommand || useBash) {
        runWithBash = true;
    }

    if (dockerImageStartCommand && attach) {
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

    let localPortArgs = {};
    let portArgs = {};

    serviceConfig.docker.container.ports.forEach(port => {
        if (!port.host || !port.container) {
            return;
        }

        if (port.local) {
            localPortArgs[port.container] = port.host;
        } else {
            portArgs[port.container] = port.host;
        }
    });

    Object.assign(portArgs, localPortArgs);

    Object.keys(portArgs).forEach(containerPort => {
        let hostPort = portArgs[containerPort];
        args.push('--publish');
        args.push(hostPort + ':' + containerPort);
    });

    let localVolumeArgs = {};
    let volumeArgs = {};

    serviceConfig.docker.container.volumes.forEach(volume => {
        if (!volume.host || !volume.container) {
            return;
        }

        if (volume.local) {
            localVolumeArgs[volume.container] = volume.host;
        } else {
            volumeArgs[volume.container] = volume.host;
        }
    });

    Object.assign(volumeArgs, localVolumeArgs);

    Object.keys(volumeArgs).forEach(volumeContainer => {
        let volumeHost = volumeArgs[volumeContainer];
        volumeHost = path.resolve(volumeHost);

        if (!fs.folderExists(volumeHost)) {
            volumeHost = path.resolve(dockerFolder, volumeHost);
        }

        if (volumeHost.match(/^[A-Z]:[\\/]?$/)) {
            volumeHost = volumeHost + '.';
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

    let localEnvironmentVariableArgs = {};
    let environmentVariableArgs = {};

    serviceConfig.docker.container.environment_variables.forEach(environment_variable => {
        if (!environment_variable.key || !environment_variable.value) {
            return;
        }

        if (environment_variable.local) {
            localEnvironmentVariableArgs[environment_variable.key] = environment_variable.value;
        } else {
            environmentVariableArgs[environment_variable.key] = environment_variable.value;
        }
    });

    Object.assign(environmentVariableArgs, localEnvironmentVariableArgs);

    let environmentVariableReplacements = {};

    let cluster = aws.getEnvironmentCluster(serviceConfig.service.clusters);
    if (cluster) {
        environmentVariableReplacements['MODEL_BUCKET'] = `${cluster.aws.bucket.name}`;
    }

    let hasAWSEnvironmentVariables = !!Object.keys(environmentVariableArgs)
        .find(environmentVariable => ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_SESSION_TOKEN'].indexOf(environmentVariable) >= 0);

    if (hasAWSEnvironmentVariables)
    {
        let roleCredentials = _getAWSAssumedRoleCredentials(in_serviceConfig);
        if (roleCredentials) {
            environmentVariableReplacements['AWS_ACCESS_KEY_ID'] = roleCredentials['AccessKeyId'];
            environmentVariableReplacements['AWS_SECRET_ACCESS_KEY'] = roleCredentials['SecretAccessKey'];
            environmentVariableReplacements['AWS_SESSION_TOKEN'] = roleCredentials['SessionToken'];
        } else {
            environmentVariableReplacements['AWS_ACCESS_KEY_ID'] = '';
            environmentVariableReplacements['AWS_SECRET_ACCESS_KEY'] = '';
            environmentVariableReplacements['AWS_SESSION_TOKEN'] = '';
        }
    }

    environmentVariableReplacements['MODEL_VERSION'] = serviceConfig.model.version;

    Object.keys(environmentVariableArgs).forEach(key => {
        let value = environmentVariableArgs[key];

        key = service.replaceConfigReferences(in_serviceConfig, key, environmentVariableReplacements);
        value = service.replaceConfigReferences(in_serviceConfig, value, environmentVariableReplacements);

        args.push('--env');
        args.push(key + '=' + value);
    });

    args.push(dockerImagePath);

    if (runWithBash) {
        if (dockerImageStartCommand && !useBash) {
            args.push(dockerImageStartCommand);
            cprint.cyan('Starting Docker container "' + containerName + '" via external console with start command...');
        } else {
            args.push('bash');
            cprint.cyan('Starting Docker container "' + containerName + '" via external console with bash...');
        }
        let cmdResult = shell.cmd(['docker'].concat(args));
        if (!cmdResult) {
            return;
        }

        if (cmdResult.hasError) {
            cmdResult.printError('  ');
        } else {
            cmdResult.printResult('  ');
        }
    } else {
        args.push(dockerImageStartCommand);
        cprint.cyan('Starting Docker container "' + containerName + '" in detached mode with start command...');
        let cmdResult = docker.cmd(args);
        if (cmdResult.hasError) {
            cmdResult.printError('  ');
        } else {
            cmdResult.printResult('  ');
        }
    }
}

// ******************************

function _getAWSAssumedRoleCredentials(in_serviceConfig, in_environment) {
    let serviceConfig = service.accessConfig(aws.getMergedServiceConfig(in_serviceConfig, in_environment), {
        service: {
            clusters: [
                {
                    aws: {
                        service_role: 'STRING',
                        profile: 'STRING'
                    },
                    default: 'BOOLEAN',
                    environment: 'STRING'
                }
            ]
        },
        cwd: 'STRING'
    });

    let cluster = aws.getEnvironmentCluster(serviceConfig.service.clusters, in_environment);
    if (!cluster) {
        if (in_environment) {
            cprint.yellow('No cluster set for "' + in_environment + '" environment');
        } else {
            cprint.yellow('No default environment defined');
        }
        return false;
    }

    let awsRoleName = cluster.aws.service_role;
    let awsCache = cache.load(serviceConfig.cwd, 'aws') || {};

    let roleCredentials = aws.getAssumedRoleCredentials(awsRoleName, {
        cache: awsCache,
        profile: cluster.aws.profile
    });

    if (service.hasConfigFile(serviceConfig.cwd)) {
        cache.save(serviceConfig.cwd, 'aws', awsCache);
    }

    return roleCredentials;
}

// ******************************

function _getDockerImageDetails (in_serviceConfig, in_dockerRepository, in_dockerImageName, in_dockerRepositoryStore) {
    let dockerUsername = docker.getUsername(in_serviceConfig);
    if (!dockerUsername) {
        cprint.yellow('Docker Image username not set');
        return;
    }

    let dockerPassword = docker.getPassword(in_serviceConfig);
    let dockerRepository = in_dockerRepository || dockerUsername;
    let dockerRepositoryStore = in_dockerRepositoryStore || docker.getDefaultRepositoryStore();
    let dockerImagePath = dockerRepositoryStore + '/' + dockerRepository + '/' + in_dockerImageName;
    let shortDockerImagePath = dockerRepository + '/' + in_dockerImageName;

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

function _getDockerImagePath (in_serviceConfig) {
    let serviceConfig = service.accessConfig(in_serviceConfig, {
        docker: {
            image: {
                name: 'STRING'
            },
            organization: 'STRING'
        }
    });

    if (!serviceConfig.docker.image.name) {
        cprint.yellow('Docker Image name not set');
        return;
    }

    let dockerImageDetails = _getDockerImageDetails(
        in_serviceConfig,
        serviceConfig.docker.organization,
        serviceConfig.docker.image.name
    );
    if (!dockerImageDetails) {
        return;
    }

    return dockerImageDetails.shortImagePath;
}

// ******************************

function _getDockerImageIds (in_serviceConfig) {
    let dockerImagePath = _getDockerImagePath(in_serviceConfig);

    let args = ['images', '--format', '{{.Repository}}:{{.Tag}}\t{{.ID}}'];
    let cmdResult = docker.cmd(args, {
        hide: true
    });

    if (cmdResult.hasError) {
        cmdResult.printError('  ');
        return;
    }

    let dockerImageIds = cmdResult.rows
        .filter(r => r.match(new RegExp('^' + dockerImagePath + ':')))
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
// Plugin Functions:
// ******************************

function handleCommand (in_args, in_params, in_serviceConfig) {
    let command = in_params.length ? in_params.shift().toLowerCase() : '';
    let no_cache = in_args['cache'] === false;
    let force = in_args['force'];
    let attach = in_args['attach'];
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
    case 'incremental-push':
        incrementalPushDockerImage(in_serviceConfig);
        break;

    case 'version':
    case 'get-version':
        printDockerImageVersion(in_serviceConfig);
        break;

    case 'set-version':
        setDockerImageVersion(in_serviceConfig, in_args, in_params);
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
        startDockerContainer(in_serviceConfig, attach);
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
        { params: ['start-container', 'start', 'run', 'run-container'], description: 'Start the service docker container', options: [{param:'attach', description:'Run the container in attached mode'}] },
        { params: ['enter-container', 'enter', 'interact', 'interactive'], description: 'Enter the running service docker container' },
        { params: ['stop-container', 'stop'], description: 'Stop the service docker container' },
        { params: ['remove-container', 'remove', 'rm'], description: 'Remove the service docker container' },
        { params: ['verify-container', 'verify', 'test-container', 'test', 'tests'], description: 'Verify the service docker container' },
        { params: ['container', 'stats', 'state', 'running'], description: 'Print the current state of the service docker container' },
        { params: ['login'], description: 'Log into docker' },
        { params: ['incremental-push'], description: 'Increment docker image version, build image and push' },
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
