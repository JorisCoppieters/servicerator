'use strict'; // JS: ES6

// ******************************
// Requires:
// ******************************

let cprint = require('color-print');

let date = require('./date');
let env = require('./env');
let exec = require('./exec');
let fs = require('./filesystem');
let ini = require('./ini');
let service = require('./service');

// ******************************
// Globals:
// ******************************

let g_AWS_CLI_INSTALLED = undefined;

// ******************************
// Cluster Functions:
// ******************************

function getClusterArnForClusterName (in_clusterName, in_options) {
    let opt = in_options || {};

    if (opt.verbose) {
        cprint.cyan('Retrieving AWS Cluster ARN for AWS Cluster "' + in_clusterName + '"...');
    }

    let cache = opt.cache || {};
    let cacheItem = cache['Cluster_' + in_clusterName];
    let cacheVal = (cacheItem || {}).val;
    if (cacheVal !== undefined) {
        return cacheVal;
    }

    let cmdResult = awsCmd([
        'ecs',
        'list-clusters'
    ], {
        hide: !opt.verbose,
        profile: opt.profile
    });

    if (cmdResult.hasError) {
        cmdResult.printError('  ');
        return;
    }

    let awsClusterArn;
    let awsResult = parseAwsCmdResult(cmdResult);
    if (awsResult && awsResult.clusterArns) {
        awsClusterArn = awsResult.clusterArns
            .find(a => a.match(in_clusterName));
    }

    if (awsClusterArn === undefined) {
        if (opt.showWarning) {
            cprint.yellow('Couldn\'t find AWS Cluster ARN for AWS Cluster "' + in_clusterName + '"');
        }
        return;
    }

    cache['Cluster_' + in_clusterName] = {
        val: awsClusterArn,
        expires: date.getTimestamp() + 7 * 24 * 3600 * 1000
    };

    return awsClusterArn;
}

// ******************************

function createCluster (in_clusterName, in_options) {
    cprint.cyan('Creating AWS Cluster for AWS Cluster "' + in_clusterName + '"...');

    let cmdResult = awsCmd([
        'ecs',
        'create-cluster',
        '--cluster-name', in_clusterName
    ], in_options);

    if (cmdResult.hasError) {
        cmdResult.printError('  ');
        return false;
    }

    cmdResult.printResult('  ');
    cprint.green('Created AWS Cluster for AWS Cluster "' + in_clusterName + '"');
    return true;
}

// ******************************

function deployTaskDefinitionToCluster (in_clusterName, in_serviceArn, in_taskDefinitionArn, in_instanceCount, in_options) {
    cprint.cyan('Deploying AWS Task Definition "' + in_taskDefinitionArn + '" to AWS Cluster "' + in_clusterName + '"...');

    let instanceCount = in_instanceCount || 1;

    let cmdResult = awsCmd([
        'ecs',
        'update-service',
        '--cluster',
        in_clusterName,
        '--service',
        in_serviceArn,
        '--task-definition',
        in_taskDefinitionArn,
        '--desired-count',
        instanceCount
    ], in_options);

    if (cmdResult.hasError) {
        cmdResult.printError('  ');
        return false;
    }

    // cmdResult.printResult('  ');
    cprint.green('Deployed AWS Task Definition "' + in_taskDefinitionArn + '" to AWS Cluster "' + in_clusterName + '"');
    return true;
}

// ******************************
// Cluster Service Functions:
// ******************************

function getClusterServiceArnForClusterName (in_clusterArn, in_clusterServiceName, in_options) {
    let opt = in_options || {};

    if (opt.verbose) {
        cprint.cyan('Retrieving AWS Cluster Service ARN in AWS Cluster "' + awsArnToTitle(in_clusterArn) +'" for AWS Cluster Service "' + in_clusterServiceName + '"...');
    }

    let cache = opt.cache || {};
    let cacheItem = cache['Cluster_' + in_clusterArn];
    let cacheVal = (cacheItem || {}).val;
    if (cacheVal !== undefined) {
        return cacheVal;
    }

    let cmdResult = awsCmd([
        'ecs',
        'list-services',
        '--cluster', in_clusterArn
    ], {
        hide: !opt.verbose,
        profile: opt.profile
    });

    if (cmdResult.hasError) {
        cmdResult.printError('  ');
        return;
    }

    let awsClusterServiceArn;
    let awsResult = parseAwsCmdResult(cmdResult);
    if (awsResult && awsResult.serviceArns) {
        awsClusterServiceArn = awsResult.serviceArns
            .find(a => a.match(in_clusterServiceName));
    }

    if (awsClusterServiceArn === undefined) {
        if (opt.showWarning) {
            cprint.yellow('Couldn\'t find AWS Cluster Service ARN in AWS Cluster "' + awsArnToTitle(in_clusterArn) +'" for AWS Cluster Service "' + in_clusterServiceName + '"');
        }
        return;
    }

    cache['Cluster_' + in_clusterArn] = {
        val: awsClusterServiceArn,
        expires: date.getTimestamp() + 7 * 24 * 3600 * 1000
    };

    return awsClusterServiceArn;
}

// ******************************

function createClusterService (in_clusterArn, in_clusterServiceName, in_taskDefinitionArn, in_loadBalancers, in_desiredCount, in_options) {
    let loadBalancers = JSON.stringify(in_loadBalancers || []);
    let desiredCount = in_desiredCount || 0;

    cprint.cyan('Creating AWS Cluster Service in AWS Cluster "' + awsArnToTitle(in_clusterArn) +'" for AWS Cluster Service "' + in_clusterServiceName + '"...');

    let cmdResult = awsCmd([
        'ecs',
        'create-service',
        '--role', 'ecsServiceRole',
        '--cluster', in_clusterArn,
        '--task-definition', in_taskDefinitionArn,
        '--service-name', in_clusterServiceName,
        '--load-balancers', loadBalancers,
        '--desired-count', desiredCount
    ], in_options);

    if (cmdResult.hasError) {
        cmdResult.printError('  ');
        return false;
    }

    cmdResult.printResult('  ');
    cprint.green('Created AWS Cluster Service in AWS Cluster "' + awsArnToTitle(in_clusterArn) + '" for AWS Cluster Service "' + in_clusterServiceName + '"');
    return true;
}

// ******************************
// Cluster Task Functions:
// ******************************

function stopClusterTask (in_clusterName, in_taskArn, in_options) {
    cprint.cyan('Stopping AWS Task "' + in_taskArn + '" in AWS Cluster "' + in_clusterName + '"...');

    let cmdResult = awsCmd([
        'ecs',
        'stop-task',
        '--task',
        in_taskArn,
        '--cluster',
        in_clusterName
    ], in_options);

    if (cmdResult.hasError) {
        cmdResult.printError('  ');
        return false;
    }

    cmdResult.printResult('  ');
    cprint.green('Stopped AWS Task "' + in_taskArn + '" in AWS Cluster "' + in_clusterName + '"');
    return true;
}

// ******************************

function getTasks (in_clusterName, in_taskArns, in_options) {
    let opt = in_options || {};

    if (!in_taskArns || !in_taskArns.length) {
        return [];
    }

    if (opt.verbose) {
        cprint.cyan('Retrieving AWS Tasks "' + in_clusterName + '"...');
    }

    let cache = opt.cache || {};
    let cacheItem = cache['TaskDefinition_' + in_clusterName];
    let cacheVal = (cacheItem || {}).val;
    if (cacheVal !== undefined) {
        return cacheVal;
    }

    let args = [
        'ecs',
        'describe-tasks',
        '--cluster',
        in_clusterName,
        '--tasks'
    ];

    in_taskArns.forEach(t => {
        args.push(t);
    });

    let cmdResult = awsCmd(args, {
        hide: !opt.verbose,
        profile: opt.profile
    });

    if (cmdResult.hasError) {
        cmdResult.printError('  ');
        return;
    }

    let awsTasks;
    let awsResult = parseAwsCmdResult(cmdResult);
    if (awsResult && awsResult.tasks) {
        awsTasks = awsResult.tasks;
    }

    if (!awsTasks) {
        cprint.yellow('Couldn\'t find AWS Tasks "' + in_clusterName + '"');
        return;
    }

    cache['TaskDefinition_' + in_clusterName] = {
        val: awsTasks,
        expires: date.getTimestamp() + 2 * 60 * 1000 // 2 minutes
    };

    return awsTasks;
}

// ******************************

function getTaskDetails (in_clusterName, in_taskArns, in_options) {
    let opt = in_options || {};

    let tasks = getTasks(in_clusterName, in_taskArns, in_options);
    if (!tasks || !tasks.length) {
        return [];
    }

    return tasks
        .map((t) => {
            let taskContainerInstance = getContainerInstance(in_clusterName, t.containerInstanceArn, in_options) || {};
            let taskClusterVersion = getClusterServiceVersionForTaskDefinition(t.taskDefinitionArn, in_options);
            let versionInfo = taskContainerInstance.versionInfo || {};
            return {
                taskArn: awsArnToTitle(t.taskArn),
                taskDefinitionArn: awsArnToTitle(t.taskDefinitionArn),
                containerInstanceArn: awsArnToTitle(t.containerInstanceArn),
                status: t.lastStatus,
                desiredStatus: t.desiredStatus,
                clusterServiceVersion: taskClusterVersion,
                instance: {
                    status: taskContainerInstance.status,
                    instanceId: taskContainerInstance.ec2InstanceId,
                    agentConnected: taskContainerInstance.agentConnected,
                    agentVersion: versionInfo.agentVersion,
                    dockerVersion: versionInfo.dockerVersion
                }
            };
        });
}

// ******************************

function getClusterTaskArnsForCluster (in_clusterName, in_options) {
    let opt = in_options || {};

    if (opt.verbose) {
        cprint.cyan('Retrieving AWS Cluster Task ARNs for AWS Cluster "' + in_clusterName + '"...');
    }

    let cache = opt.cache || {};
    let cacheItem = cache['ClusterTaskArns_' + in_clusterName];
    let cacheVal = (cacheItem || {}).val;
    if (cacheVal !== undefined) {
        return cacheVal;
    }

    let cmdResult = awsCmd([
        'ecs',
        'list-tasks',
        '--cluster',
        in_clusterName
    ], {
        hide: !opt.verbose,
        profile: opt.profile
    });

    if (cmdResult.hasError) {
        cmdResult.printError('  ');
        return;
    }

    let awsResult = parseAwsCmdResult(cmdResult);
    let awsClusterTaskArns = (awsResult || {}).taskArns;

    if (!awsClusterTaskArns) {
        cprint.yellow('Couldn\'t find AWS Cluster Task ARNs for AWS Cluster "' + in_clusterName + '"');
        return;
    }

    cache['ClusterTaskArns_' + in_clusterName] = {
        val: awsClusterTaskArns,
        expires: date.getTimestamp() + 2 * 60 * 1000 // 2 minutes
    };

    return awsClusterTaskArns;
}

// ******************************
// Task Definition Functions:
// ******************************

function getTaskDefinition (in_taskDefinitionArn, in_options) {
    let opt = in_options || {};

    if (opt.verbose) {
        cprint.cyan('Retrieving AWS Task Definition "' + in_taskDefinitionArn + '"...');
    }

    let cache = opt.cache || {};
    let cacheItem = cache['TaskDefinition_' + in_taskDefinitionArn];
    let cacheVal = (cacheItem || {}).val;
    if (cacheVal !== undefined) {
        return cacheVal;
    }

    let cmdResult = awsCmd([
        'ecs',
        'describe-task-definition',
        '--task-definition',
        in_taskDefinitionArn
    ], {
        hide: !opt.verbose,
        profile: opt.profile
    });

    if (cmdResult.hasError) {
        cmdResult.printError('  ');
        return;
    }

    let awsTaskDefinition;
    let awsResult = parseAwsCmdResult(cmdResult);
    if (awsResult && awsResult.taskDefinition) {
        awsTaskDefinition = awsResult.taskDefinition;
    }

    if (!awsTaskDefinition) {
        cprint.yellow('Couldn\'t find AWS Task Definition "' + in_taskDefinitionArn + '"');
        return;
    }

    cache['TaskDefinition_' + in_taskDefinitionArn] = {
        val: awsTaskDefinition,
        expires: date.getTimestamp() + 2 * 60 * 1000 // 2 minutes
    };

    return awsTaskDefinition;
}

// ******************************

function getClusterServiceVersionForTaskDefinition (in_taskDefinitionArn, in_options) {
    let opt = in_options || {};

    let taskDefinition = getTaskDefinition(in_taskDefinitionArn, in_options);
    if (!taskDefinition) {
        cprint.yellow('Couldn\'t find AWS Task Definition "' + in_taskDefinitionArn + '"');
        return;
    }

    let containerDefinitions = taskDefinition.containerDefinitions || [];
    let firstContainerDefinition = containerDefinitions[0] || {};
    let image = firstContainerDefinition.image || false;

    if (!image) {
        cprint.yellow('Couldn\'t find cluster service version for AWS Task Definition "' + in_taskDefinitionArn + '"');
        return;
    }

    let match = image.match(/^[0-9]+\..*\.amazonaws.com\/(.*):(.*)$/);
    if (!match) {
        cprint.yellow('Invalid image for task definition "' + in_taskDefinitionArn + '": ' + image);
        return;
    }

    let version = match[2];
    return version;
}

// ******************************

function getTaskDefinitionArnForClusterService (in_clusterName, in_clusterServiceArn, in_options) {
    let opt = in_options || {};

    if (opt.verbose) {
        cprint.cyan('Retrieving AWS Task Definition ARN for AWS Cluster Service "' + in_clusterServiceArn + '"...');
    }

    let cache = opt.cache || {};
    let cacheItem = cache['TaskDefinitionArn_' + in_clusterServiceArn];
    let cacheVal = (cacheItem || {}).val;
    if (cacheVal !== undefined) {
        return cacheVal;
    }

    let cmdResult = awsCmd([
        'ecs',
        'describe-services',
        '--cluster',
        in_clusterName,
        '--service',
        in_clusterServiceArn
    ], {
        hide: !opt.verbose,
        profile: opt.profile
    });

    if (cmdResult.hasError) {
        cmdResult.printError('  ');
        return;
    }

    let awsTaskDefinitionArn;
    let awsResult = parseAwsCmdResult(cmdResult);
    if (awsResult && awsResult.services) {
        awsTaskDefinitionArn = awsResult.services
            .map(obj => obj.deployments || [])
            .reduce((a,b) => a.concat(b), [])
            .map(obj => obj.taskDefinition)
            .find(obj => true);
    }

    if (!awsTaskDefinitionArn) {
        cprint.yellow('Couldn\'t find AWS Task Definition ARN for AWS Cluster Service "' + in_clusterServiceArn + '"');
        return;
    }

    cache['TaskDefinitionArn_' + in_clusterServiceArn] = {
        val: awsTaskDefinitionArn,
        expires: date.getTimestamp() + 2 * 60 * 1000 // 2 minutes
    };

    return awsTaskDefinitionArn;
}

// ******************************

function getLatestTaskDefinitionArnForTaskDefinition (in_taskDefinitionName, in_options) {
    let opt = in_options || {};

    if (opt.verbose) {
        cprint.cyan('Retrieving latest AWS Task Definition ARN for AWS Task Definition "' + in_taskDefinitionName + '"...');
    }

    let cache = opt.cache || {};
    let cacheItem = cache['LatestTaskDefinitionArn_' + in_taskDefinitionName];
    let cacheVal = (cacheItem || {}).val;
    if (cacheVal !== undefined) {
        return cacheVal;
    }

    let cmdResult = awsCmd([
        'ecs',
        'list-task-definitions',
        '--family-prefix',
        in_taskDefinitionName
    ], {
        hide: !opt.verbose,
        profile: opt.profile
    });

    if (cmdResult.hasError) {
        cmdResult.printError('  ');
        return false;
    }

    let latestTaskDefinitionArn;
    let awsResult = parseAwsCmdResult(cmdResult);
    if (awsResult && awsResult.taskDefinitionArns) {
        latestTaskDefinitionArn = awsResult.taskDefinitionArns
            .sort((a,b) => {
                let aMatch = a.match(/^arn:aws:.*:([0-9]+)$/);
                let bMatch = b.match(/^arn:aws:.*:([0-9]+)$/);
                if (!aMatch || !bMatch) {
                    return -1;
                }

                let aVal = parseInt(aMatch[1]);
                let bVal = parseInt(bMatch[1]);

                if (aVal === bVal) {
                    return 0;
                }

                return aVal < bVal ? 1 : -1;
            })
            .find(obj => true);
    }

    if (!latestTaskDefinitionArn) {
        cprint.yellow('Couldn\'t find latest AWS Task Definition ARN for AWS Task Definition "' + in_taskDefinitionName + '"');
        return;
    }

    cache['LatestTaskDefinitionArn_' + in_taskDefinitionName] = {
        val: latestTaskDefinitionArn,
        expires: date.getTimestamp() + 2 * 60 * 1000 // 2 minutes
    };

    return latestTaskDefinitionArn;
}

// ******************************

function getPreviousTaskDefinitionArnsForTaskDefinition (in_taskDefinitionName, in_options) {
    let opt = in_options || {};

    if (opt.verbose) {
        cprint.cyan('Retrieving previous AWS Task Definition ARNs for AWS Task Definition "' + in_taskDefinitionName + '"...');
    }

    let cache = opt.cache || {};
    let cacheItem = cache['PreviousTaskDefinitionArns_' + in_taskDefinitionName];
    let cacheVal = (cacheItem || {}).val;
    if (cacheVal !== undefined) {
        return cacheVal;
    }

    let cmdResult = awsCmd([
        'ecs',
        'list-task-definitions',
        '--family-prefix',
        in_taskDefinitionName
    ], {
        hide: !opt.verbose,
        profile: opt.profile
    });

    if (cmdResult.hasError) {
        cmdResult.printError('  ');
        return false;
    }

    let previousTaskDefinitionArn;
    let awsResult = parseAwsCmdResult(cmdResult);
    if (awsResult && awsResult.taskDefinitionArns) {
        previousTaskDefinitionArn = awsResult.taskDefinitionArns
            .sort((a,b) => {
                let aMatch = a.match(/^arn:aws:.*:([0-9]+)$/);
                let bMatch = b.match(/^arn:aws:.*:([0-9]+)$/);
                if (!aMatch || !bMatch) {
                    return -1;
                }

                let aVal = parseInt(aMatch[1]);
                let bVal = parseInt(bMatch[1]);

                if (aVal === bVal) {
                    return 0;
                }

                return aVal < bVal ? 1 : -1;
            })
            .filter((t, idx) => idx !== 0);
    }

    if (!previousTaskDefinitionArn) {
        cprint.yellow('Couldn\'t find previous AWS Task Definition ARNs for AWS Task Definition "' + in_taskDefinitionName + '"');
        return;
    }

    cache['PreviousTaskDefinitionArns_' + in_taskDefinitionName] = {
        val: previousTaskDefinitionArn,
        expires: date.getTimestamp() + 1000 // 1 second
    };

    return previousTaskDefinitionArn;
}

// ******************************

function deregisterTaskDefinition (in_taskDefinitionArn, in_options) {
    cprint.cyan('Deregistering AWS Task Definition "' + in_taskDefinitionArn + '"...');

    let cmdResult = awsCmd([
        'ecs',
        'deregister-task-definition',
        '--task-definition',
        in_taskDefinitionArn
    ], in_options);

    if (cmdResult.hasError) {
        cmdResult.printError('  ');
        return false;
    }

    cmdResult.printResult('  ');
    cprint.green('Deregistered AWS Task Definition "' + in_taskDefinitionArn + '"');
    return true;
}

// ******************************
// Container Instance Functions:
// ******************************

function getContainerInstance (in_clusterName, in_containerInstanceArn, in_options) {
    let opt = in_options || {};

    if (opt.verbose) {
        cprint.cyan('Retrieving AWS Container Instance "' + in_containerInstanceArn + '"...');
    }

    let cache = opt.cache || {};
    let cacheItem = cache['ContainerInstance_' + in_containerInstanceArn];
    let cacheVal = (cacheItem || {}).val;
    if (cacheVal !== undefined) {
        return cacheVal;
    }

    let cmdResult = awsCmd([
        'ecs',
        'describe-container-instances',
        '--cluster',
        in_clusterName,
        '--container-instance',
        in_containerInstanceArn
    ], {
        hide: !opt.verbose,
        profile: opt.profile
    });

    if (cmdResult.hasError) {
        cmdResult.printError('  ');
        return;
    }

    let awsTasks;
    let awsResult = parseAwsCmdResult(cmdResult);
    if (awsResult && awsResult.containerInstances) {
        awsTasks = awsResult.containerInstances
            .find(obj => true);
    }

    if (!awsTasks) {
        cprint.yellow('Couldn\'t find AWS Container Instance "' + in_containerInstanceArn + '"');
        return;
    }

    cache['ContainerInstance_' + in_containerInstanceArn] = {
        val: awsTasks,
        expires: date.getTimestamp() + 2 * 60 * 1000 // 2 minutes
    };

    return awsTasks;
}

// ******************************
// Repository Functions:
// ******************************

function getDockerRepositoryForDockerImageName (in_dockerImageName, in_options) {
    let opt = in_options || {};

    if (opt.verbose) {
        cprint.cyan('Retrieving AWS Docker Repository for Docker Image "' + in_dockerImageName + '"...');
    }

    let cache = opt.cache || {};
    let cacheItem = cache['DockerRepository_' + in_dockerImageName];
    let cacheVal = (cacheItem || {}).val;
    if (cacheVal !== undefined) {
        return cacheVal;
    }

    let cmdResult = awsCmd([
        'ecr',
        'describe-repositories'
    ], {
        hide: !opt.verbose,
        profile: opt.profile
    });

    if (cmdResult.hasError) {
        cmdResult.printError('  ');
        return;
    }

    let awsRepository;
    let awsResult = parseAwsCmdResult(cmdResult);
    if (awsResult && awsResult.repositories) {
        awsRepository = awsResult.repositories
            .map(obj => obj.repositoryName)
            .find(name => name === in_dockerImageName);
    }

    if (awsRepository === undefined) {
        if (opt.showWarning) {
            cprint.yellow('Couldn\'t find AWS Docker Repository for Docker Image "' + in_dockerImageName + '"');
        }
        return;
    }

    cache['DockerRepository_' + in_dockerImageName] = {
        val: awsRepository,
        expires: date.getTimestamp() + 7 * 24 * 3600 * 1000 // 1 week
    };

    return awsRepository;
}

// ******************************

function getDockerRepositoryImagesForRepositoryName (in_dockerRepositoryName, in_options) {
    let opt = in_options || {};

    if (opt.verbose) {
        cprint.cyan('Retrieving AWS Docker Repository Images for Docker Repository "' + in_dockerRepositoryName + '"...');
    }

    let cache = opt.cache || {};
    let cacheItem = cache['DockerRepositoryImages_' + in_dockerRepositoryName];
    let cacheVal = (cacheItem || {}).val;
    if (cacheVal !== undefined) {
        return cacheVal;
    }

    let cmdResult = awsCmd([
        'ecr',
        'describe-images',
        '--repository-name', in_dockerRepositoryName
    ], {
        hide: !opt.verbose,
        profile: opt.profile
    });

    if (cmdResult.hasError) {
        cmdResult.printError('  ');
        return;
    }

    let awsRepositoryImages;
    let awsResult = parseAwsCmdResult(cmdResult);
    if (awsResult && awsResult.imageDetails) {
        awsRepositoryImages = awsResult.imageDetails;
    }

    if (awsRepositoryImages === undefined) {
        if (opt.showWarning) {
            cprint.yellow('Couldn\'t find AWS Docker Repository Images for Docker Repository "' + in_dockerRepositoryName + '"');
        }
        return;
    }

    cache['DockerRepositoryImages_' + in_dockerRepositoryName] = {
        val: awsRepositoryImages,
        expires: date.getTimestamp() + 3600 * 1000 // 1 hour
    };

    return awsRepositoryImages;
}

// ******************************

function deleteDockerRepositoryImages (in_dockerRepositoryName, in_dockerRepositoryImages, in_options) {
    cprint.cyan('Deleting AWS Docker Repository Images for Docker Repository "' + in_dockerRepositoryName + '"...');

    let imageIds = in_dockerRepositoryImages
        .map(i => 'imageDigest=' + i)
        .join(',');

    let cmdResult = awsCmd([
        'ecr',
        'batch-delete-image',
        '--repository-name', in_dockerRepositoryName,
        '--image-ids', imageIds
    ], in_options);

    if (cmdResult.hasError) {
        cmdResult.printError('  ');
        return false;
    }

    if (cmdResult.resultObj && cmdResult.resultObj.failures) {
        cmdResult.printError('  ');
        return false;
    }

    cmdResult.printResult('  ');
    cprint.green('Deleted AWS Docker Repository Images for Docker Repository "' + in_dockerRepositoryName + '"');
    return true;
}

// ******************************

function createDockerRepository (in_dockerImageName, in_options) {
    cprint.cyan('Creating AWS Docker Repository for Docker Image "' + in_dockerImageName + '"...');

    let cmdResult = awsCmd([
        'ecr',
        'create-repository',
        '--repository-name', in_dockerImageName
    ], in_options);

    if (cmdResult.hasError) {
        cmdResult.printError('  ');
        return false;
    }

    cmdResult.printResult('  ');
    cprint.green('Created AWS Docker Repository for Docker Image "' + in_dockerImageName + '"');
    return true;
}

// ******************************
// Cache Clearing Functions:
// ******************************

function clearCachedAutoScalingGroups (in_cache) {
    let cache = in_cache || {};
    cache['AllAutoScalingGroups'] = undefined;
}

// ******************************

function clearCachedAutoScalingGroupInstanceCount (in_autoScalingGroupName, in_cache) {
    let cache = in_cache || {};
    cache['AutoScalingGroupInstanceCount_' + in_autoScalingGroupName] = undefined;
}

// ******************************

function clearCachedTaskDefinitionArnForTaskDefinition (in_taskDefinitionName, in_cache) {
    let cache = in_cache || {};
    cache['TaskDefinitionArn_' + in_taskDefinitionName] = undefined;
}

// ******************************

function clearCachedDockerRepositoryImagesForRepositoryName (in_dockerRepositoryName, in_cache) {
    let cache = in_cache || {};
    cache['DockerRepositoryImages_' + in_dockerRepositoryName] = undefined;
}

// ******************************

function clearCachedLaunchConfigurationLike (in_launchConfigurationTemplate, in_cache) {
    let cache = in_cache || {};
    cache['LaunchConfiguration_' + in_launchConfigurationTemplate] = undefined;
}

// ******************************

function clearCachedLaunchConfigurationsLike (in_launchConfigurationTemplate, in_cache) {
    let cache = in_cache || {};
    cache['LaunchConfigurations_' + in_launchConfigurationTemplate] = undefined;
}

// ******************************
// Launch Configuration Functions:
// ******************************

function getLaunchConfigurationLike (in_launchConfigurationTemplate, in_options) {
    let opt = in_options || {};

    if (opt.verbose) {
        cprint.cyan('Retrieving latest Launch Configuration like "' + in_launchConfigurationTemplate + '"...');
    }

    let cache = opt.cache || {};
    let cacheItem = cache['LaunchConfiguration_' + in_launchConfigurationTemplate];
    let cacheVal = (cacheItem || {}).val;
    if (cacheVal !== undefined) {
        return cacheVal;
    }

    let launchConfigurations = getLaunchConfigurationsLike(in_launchConfigurationTemplate, in_options);
    let latestLaunchConfiguration;

    if (launchConfigurations && launchConfigurations.length) {
        latestLaunchConfiguration = launchConfigurations.find(name => true);
    }

    if (latestLaunchConfiguration === undefined) {
        if (opt.showWarning) {
            cprint.yellow('Couldn\'t find latest Launch Configuration like "' + in_launchConfigurationTemplate + '"');
        }
        return;
    }

    cache['LaunchConfiguration_' + in_launchConfigurationTemplate] = {
        val: latestLaunchConfiguration,
        expires: date.getTimestamp() + 2 * 60 * 1000 // 2 minutes
    };

    return latestLaunchConfiguration;
}

// ******************************

function getLaunchConfigurationsLike (in_launchConfigurationTemplate, in_options) {
    let opt = in_options || {};

    if (opt.verbose) {
        cprint.cyan('Retrieving Launch Configurations like "' + in_launchConfigurationTemplate + '"...');
    }

    let cache = opt.cache || {};
    let cacheItem = cache['LaunchConfigurations_' + in_launchConfigurationTemplate];
    let cacheVal = (cacheItem || {}).val;
    if (cacheVal !== undefined) {
        return cacheVal;
    }

    let cmdResult = awsCmd([
        'autoscaling',
        'describe-launch-configurations'
    ], {
        hide: !opt.verbose,
        profile: opt.profile
    });

    if (cmdResult.hasError) {
        cmdResult.printError('  ');
        return;
    }

    let launchConfigurations;
    let awsResult = parseAwsCmdResult(cmdResult);
    if (awsResult && awsResult.LaunchConfigurations) {
        launchConfigurations = awsResult.LaunchConfigurations
            .map(obj => obj.LaunchConfigurationName)
            .filter(name => name.match(in_launchConfigurationTemplate))
            .sort()
            .reverse()
    }

    cache['LaunchConfigurations_' + in_launchConfigurationTemplate] = {
        val: launchConfigurations,
        expires: date.getTimestamp() + 2 * 60 * 1000 // 2 minutes
    };

    return launchConfigurations;
}

// ******************************

function deleteLaunchConfiguration (in_launchConfiguration, in_options) {
    let opt = in_options || {};

    if (opt.verbose) {
        cprint.cyan('Deleting AWS Launch Configuration "' + in_launchConfiguration + '"...');
    }

    let cmdResult = awsCmd([
        'autoscaling',
        'delete-launch-configuration',

        '--launch-configuration-name',
        in_launchConfiguration
    ], {
        hide: !opt.verbose,
        profile: opt.profile
    });

    if (cmdResult.hasError) {
        cmdResult.printError('  ');
        return false;
    }

    cmdResult.printResult('  ');
    cprint.green('Deleted AWS Launch Configuration "' + in_launchConfiguration + '"');
    return true;
}

// ******************************
// Auto Scaling Functions:
// ******************************

function getServiceStateFromAutoScalingGroupInstanceCount (in_autoScalingGroupInstanceCount) {
    let serviceState;

    if (in_autoScalingGroupInstanceCount > 0) {
        serviceState = 'Up';
    } else if (in_autoScalingGroupInstanceCount === 0) {
        serviceState = 'Down';
    } else {
        serviceState = 'N/A';
    }

    return serviceState;
}

// ******************************

function setAutoScalingGroupInstanceCount (in_autoScalingGroupName, in_autoScalingGroupInstanceCount, in_options) {
    let opt = in_options || {};

    cprint.cyan('Setting Instance Count for AWS Auto Scaling Group "' + in_autoScalingGroupName + '" to ' + in_autoScalingGroupInstanceCount + '...');

    let autoScalingGroupInstanceCount = in_autoScalingGroupInstanceCount || 1;

    let cmdResult = awsCmd([
        'autoscaling',
        'update-auto-scaling-group',
        '--auto-scaling-group', in_autoScalingGroupName,
        '--desired-capacity', in_autoScalingGroupInstanceCount,
        '--min-size', 0
    ], in_options);

    if (cmdResult.hasError) {
        cmdResult.printError('  ');
        return false;
    }

    cmdResult.printResult('  ');
    cprint.green('Set Instance Count for AWS Auto Scaling Group "' + in_autoScalingGroupName + '" to ' + in_autoScalingGroupInstanceCount);
    clearCachedAutoScalingGroupInstanceCount(in_autoScalingGroupName, opt.cache);
    return true;
}

// ******************************

function getAutoScalingGroups (in_options) {
    let opt = in_options || {};

    if (opt.verbose) {
        cprint.cyan('Retrieving all AWS Auto Scaling Groups...');
    }

    let cache = opt.cache || {};
    let cacheItem = cache['AllAutoScalingGroups'];
    let cacheVal = (cacheItem || {}).val;
    if (cacheVal !== undefined) {
        return cacheVal;
    }

    let cmdResult = awsCmd([
        'autoscaling',
        'describe-auto-scaling-groups'
    ], {
        hide: !opt.verbose,
        profile: opt.profile
    });

    if (cmdResult.hasError) {
        cmdResult.printError('  ');
        return;
    }

    let autoScalingGroups;
    let awsResult = parseAwsCmdResult(cmdResult);
    if (awsResult && awsResult.AutoScalingGroups) {
        autoScalingGroups = awsResult.AutoScalingGroups;
    }

    if (autoScalingGroups === undefined) {
        if (opt.showWarning) {
            cprint.yellow('Couldn\'t find any AWS Auto Scaling Groups');
        }
        return;
    }

    cache['AllAutoScalingGroups'] = {
        val: autoScalingGroups,
        expires: date.getTimestamp() + 2 * 60 * 1000 // 2 minutes
    };

    return autoScalingGroups;
}

// ******************************

function getAutoScalingGroupInstanceCount (in_autoScalingGroupName, in_options) {
    let opt = in_options || {};

    if (opt.verbose) {
        cprint.cyan('Retrieving Instance Count for AWS Auto Scaling Group "' + in_autoScalingGroupName + '"...');
    }

    let cache = opt.cache || {};
    let cacheItem = cache['AutoScalingGroupInstanceCount_' + in_autoScalingGroupName];
    let cacheVal = (cacheItem || {}).val;
    if (cacheVal !== undefined) {
        return cacheVal;
    }

    let cmdResult = awsCmd([
        'autoscaling',
        'describe-auto-scaling-groups',
        '--auto-scaling-group', in_autoScalingGroupName
    ], {
        hide: !opt.verbose,
        profile: opt.profile
    });

    if (cmdResult.hasError) {
        cmdResult.printError('  ');
        return;
    }

    let desiredCapacity;
    let awsResult = parseAwsCmdResult(cmdResult);
    if (awsResult && awsResult.AutoScalingGroups) {
        desiredCapacity = awsResult.AutoScalingGroups
            .map(obj => obj.DesiredCapacity)
            .find(obj => true);
    }

    if (desiredCapacity === undefined) {
        if (opt.showWarning) {
            cprint.yellow('Couldn\'t find Instance Count for AWS Auto Scaling Group "' + in_autoScalingGroupName + '"');
        }
        return;
    }

    cache['AutoScalingGroupInstanceCount_' + in_autoScalingGroupName] = {
        val: desiredCapacity,
        expires: date.getTimestamp() + 2 * 60 * 1000 // 2 minutes
    };

    return desiredCapacity;
}

// ******************************

function getAutoScalingGroupForLaunchConfiguration (in_launchConfigurationName, in_options) {
    let opt = in_options || {};

    if (opt.verbose) {
        cprint.cyan('Retrieving AWS Auto Scaling Group for Launch Configuration "' + in_launchConfigurationName + '"...');
    }

    let autoScalingGroups = getAutoScalingGroups(in_options);
    if (!autoScalingGroups || !autoScalingGroups.length) {
        if (opt.showWarning) {
            cprint.yellow('Couldn\'t find any AWS Auto Scaling Groups');
        }
        return;
    }

    let autoScalingGroupForLaunchConfiguration = autoScalingGroups
        .find(g => g.LaunchConfigurationName === in_launchConfigurationName);

    return autoScalingGroupForLaunchConfiguration;
}

// ******************************
// VPC Functions:
// ******************************

function getVpcIdForVpc (in_vpcName, in_options) {
    let opt = in_options || {};

    if (opt.verbose) {
        cprint.cyan('Retrieving AWS VPC ID for AWS VPC "' + in_vpcName + '"...');
    }

    let cache = opt.cache || {};
    let cacheItem = cache['VpcId_' + in_vpcName];
    let cacheVal = (cacheItem || {}).val;
    if (cacheVal !== undefined) {
        return cacheVal;
    }

    let cmdResult = awsCmd([
        'ec2',
        'describe-vpcs',
        '--filter',
        `Name="tag-value",Values="${in_vpcName}"`
    ], {
        hide: !opt.verbose,
        profile: opt.profile
    });

    if (cmdResult.hasError) {
        cmdResult.printError('  ');
        return false;
    }

    let awsVpcId;
    let awsResult = parseAwsCmdResult(cmdResult);
    if (awsResult && awsResult.Vpcs) {
        awsVpcId = awsResult.Vpcs
            .sort()
            .reverse()
            .map(obj => obj.VpcId)
            .find(obj => true);
    }

    if (!awsVpcId) {
        cprint.yellow('Couldn\'t find AWS VPC ID for AWS VPC "' + in_vpcName + '"');
        return false;
    }

    cache['VpcId_' + in_vpcName] = {
        val: awsVpcId,
        expires: date.getTimestamp() + 7 * 24 * 3600 * 1000 // 1 week
    };

    return awsVpcId;
}

// ******************************

function getDefaultVpcSecurityGroupIdForVpc (in_vpcId, in_options) {
    let opt = in_options || {};

    if (opt.verbose) {
        cprint.cyan('Retrieving Default AWS Security Group Id for AWS VPC Id "' + in_vpcId + '"...');
    }

    let cache = opt.cache || {};
    let cacheItem = cache['VpcDefaultSecurityGroupId_' + in_vpcId];
    let cacheVal = (cacheItem || {}).val;
    if (cacheVal !== undefined) {
        return cacheVal;
    }

    let cmdResult = awsCmd([
        'ec2',
        'describe-security-groups',
        '--filters',
        `Name=vpc-id,Values="${in_vpcId}"`,
        `Name=group-name,Values="default"`
    ], {
        hide: !opt.verbose,
        profile: opt.profile
    });

    if (cmdResult.hasError) {
        cmdResult.printError('  ');
        return false;
    }

    let awsDefaultVpcSecurityGroupId;
    let awsResult = parseAwsCmdResult(cmdResult);
    if (awsResult && awsResult.SecurityGroups) {
        awsDefaultVpcSecurityGroupId = awsResult.SecurityGroups
            .sort()
            .reverse()
            .map(obj => obj.GroupId)
            .find(obj => true);
    }

    if (!awsDefaultVpcSecurityGroupId) {
        cprint.yellow('Couldn\'t find Default AWS Security Group Id for AWS VPC Id "' + in_vpcId + '"');
        return false;
    }

    cache['VpcDefaultSecurityGroupId_' + in_vpcId] = {
        val: awsDefaultVpcSecurityGroupId,
        expires: date.getTimestamp() + 7 * 24 * 3600 * 1000 // 1 week
    };

    return awsDefaultVpcSecurityGroupId;
}

// ******************************

function getVpcSecurityGroupIdFromGroupName (in_vpcId, in_groupName, in_options) {
    let opt = in_options || {};

    if (opt.verbose) {
        cprint.cyan('Retrieving AWS Security Group Id for AWS VPC Id "' + in_vpcId + '" from name "' + in_groupName + '"...');
    }

    let cache = opt.cache || {};
    let cacheItem = cache['VpcSecurityGroupId_' + in_vpcId + '_' + in_groupName];
    let cacheVal = (cacheItem || {}).val;
    if (cacheVal !== undefined) {
        return cacheVal;
    }

    let cmdResult = awsCmd([
        'ec2',
        'describe-security-groups',
        '--filters',
        `Name=vpc-id,Values="${in_vpcId}"`
    ], {
        hide: !opt.verbose,
        profile: opt.profile
    });

    if (cmdResult.hasError) {
        cmdResult.printError('  ');
        return false;
    }

    let awsVpcSecurityGroupId;
    let awsResult = parseAwsCmdResult(cmdResult);
    if (awsResult && awsResult.SecurityGroups) {
        awsVpcSecurityGroupId = awsResult.SecurityGroups
            .filter(obj => obj.GroupName === in_groupName)
            .map(obj => obj.GroupId)
            .find(obj => true);
    }

    if (!awsVpcSecurityGroupId) {
        cprint.yellow('Couldn\'t find AWS Security Group Id for AWS VPC Id "' + in_vpcId + '"" from name "' + in_groupName + '"');
        return false;
    }

    cache['VpcSecurityGroupId_' + in_vpcId + '_' + in_groupName] = {
        val: awsVpcSecurityGroupId,
        expires: date.getTimestamp() + 7 * 24 * 3600 * 1000 // 1 week
    };

    return awsVpcSecurityGroupId;
}

// ******************************

function getVpcSubnetIdForVpc (in_vpcId, in_vpcSubnetName, in_options) {
    let opt = in_options || {};

    if (opt.verbose) {
        cprint.cyan('Retrieving AWS VPC Subnet Id for AWS VPC Subnet "' + in_vpcSubnetName + '"...');
    }

    let cache = opt.cache || {};
    let cacheItem = cache['VpcSubnetId_' + in_vpcSubnetName];
    let cacheVal = (cacheItem || {}).val;
    if (cacheVal !== undefined) {
        return cacheVal;
    }

    let cmdResult = awsCmd([
        'ec2',
        'describe-subnets',
        '--filters',
        `Name=vpc-id,Values="${in_vpcId}"`,
        `Name=tag-value,Values="${in_vpcSubnetName}"`
    ], {
        hide: !opt.verbose,
        profile: opt.profile
    });

    if (cmdResult.hasError) {
        cmdResult.printError('  ');
        return false;
    }

    let awsVpcSubnetId;
    let awsResult = parseAwsCmdResult(cmdResult);
    if (awsResult && awsResult.Subnets) {
        awsVpcSubnetId = awsResult.Subnets
            .sort()
            .reverse()
            .map(obj => obj.SubnetId)
            .find(obj => true);
    }

    if (!awsVpcSubnetId) {
        cprint.yellow('Couldn\'t find AWS VPC Subnet Id for AWS VPC Subnet "' + in_vpcSubnetName + '"');
        return false;
    }

    cache['VpcSubnetId_' + in_vpcSubnetName] = {
        val: awsVpcSubnetId,
        expires: date.getTimestamp() + 7 * 24 * 3600 * 1000 // 1 week
    };

    return awsVpcSubnetId;
}

// ******************************
// Instance Functions:
// ******************************

function getInstanceIdsWithTags (in_tags, in_options) {
    let opt = in_options || {};

    let tags = in_tags || [];
    let tagsStr = JSON.stringify(tags);

    if (opt.verbose) {
        cprint.cyan('Retrieving AWS Instance IDs for tags [' + tagsStr + ']...');
    }

    let cache = opt.cache || {};
    let cacheItem = cache['InstanceIds_' + tagsStr];
    let cacheVal = (cacheItem || {}).val;
    if (cacheVal !== undefined) {
        return cacheVal;
    }

    let args = [
        'ec2',
        'describe-instances',
        '--filters',
    ];

    in_tags.forEach(t => {
        if (!t.key || !t.vals) {
            return '';
        }
        args.push(`Name="tag:${t.key}",Values="${t.vals.join(',')}"`);
    });

    let cmdResult = awsCmd(args, {
        hide: !opt.verbose,
        profile: opt.profile
    });

    if (cmdResult.hasError) {
        cmdResult.printError('  ');
        return false;
    }

    let awsInstanceIds;
    let awsResult = parseAwsCmdResult(cmdResult);
    if (awsResult && awsResult.Reservations) {
        awsInstanceIds = awsResult.Reservations
            .map(obj => obj.Instances)
            .reduce((a,b) => a.concat(b), [])
            .filter(obj => {
                if (!obj.State || obj.State.Code !== 16) {
                    return false;
                }
                return true;
            })
            .map(obj => {
                let result = {
                    ImageId: obj.ImageId,
                    InstanceId: obj.InstanceId,
                    InstanceLifecycle: obj.InstanceLifecycle,
                    InstanceType: obj.InstanceType,
                    IpAddress: obj.PrivateIpAddress,
                    SecurityGroups: obj.SecurityGroups,
                    SubnetId: obj.SubnetId,
                    Tags: obj.Tags,
                    VpcId: obj.VpcId
                };
                return result;
            });
    }

    if (!awsInstanceIds) {
        cprint.yellow('Couldn\'t find AWS Instance IDs for tags [' + tagsStr + ']');
        return false;
    }

    cache['InstanceIds_' + tagsStr] = {
        val: awsInstanceIds,
        expires: date.getTimestamp() + 10 * 60 * 1000 // 10 minutes
    };

    return awsInstanceIds;
}

// ******************************
// Config Functions:
// ******************************

function getAwsServiceConfig (in_serviceConfig) {
    let serviceConfig = service.accessConfig(in_serviceConfig, {
        aws: {
            profile: 'STRING'
        }
    });

    let path = require('path');

    let homeFolder = env.getShellHome();
    if (!homeFolder || !fs.folderExists(homeFolder)) {
        cprint.yellow('Home folder doesn\'t exist');
        return;
    }

    let profile = serviceConfig.aws.profile || 'default';
    serviceConfig.aws.profile = profile;

    let awsConfigFile = path.resolve(homeFolder, '.aws', 'config');
    let awsConfig = ini.parseFile(awsConfigFile);
    if (awsConfig[profile] && awsConfig[profile].region) {
        serviceConfig.aws.region = awsConfig[profile].region;
    }

    let awsCredentialsFile = path.resolve(homeFolder, '.aws', 'credentials');
    let awsCredentials = ini.parseFile(awsCredentialsFile);
    if (awsCredentials[profile] && awsCredentials[profile].aws_access_key_id) {
        serviceConfig.aws.access_key = awsCredentials[profile].aws_access_key_id;
        serviceConfig.aws.secret_key = awsCredentials[profile].aws_secret_access_key;
    }

    service.checkConfigSchema(serviceConfig);
    return serviceConfig;
}

// ******************************

function getAwsRepositoryServiceConfig () {
    let serviceConfig = {
        docker: {
            other_repositories: []
        },
        aws: {
            profile: 'STRING'
        }
    };

    serviceConfig.docker.other_repositories.push({
        'type': 'AWS'
    });

    let profile = serviceConfig.aws.profile || 'default';
    serviceConfig.aws.profile = profile;

    if (awsInstalled()) {
        let awsCmdResult = awsCmd(['sts', 'get-caller-identity'], {
            hide: true,
            profile: profile
        });

        if (!awsCmdResult.hasError) {
            let awsStats = JSON.parse(awsCmdResult.result);
            if (awsStats && awsStats.Account) {
                serviceConfig.aws.account_id = parseInt(awsStats.Account);
            }
        }
    }

    service.checkConfigSchema(serviceConfig);
    return serviceConfig;
}

// ******************************

function getMergedAwsServiceConfig (in_serviceConfig) {
    let serviceConfig = in_serviceConfig || {};
    let awsServiceConfig = getAwsServiceConfig(in_serviceConfig);
    service.combineConfig(awsServiceConfig, serviceConfig);
    return serviceConfig;
}

// ******************************

function getAwsDockerRepositoryUrl (in_serviceConfig) {
    let serviceConfig = service.accessConfig(in_serviceConfig, {
        aws: {
            account_id: 'NUMBER',
            region: 'STRING'
        }
    });

    if (!serviceConfig.aws.account_id) {
        cprint.yellow("AWS account id not set");
        return false;
    }

    return serviceConfig.aws.account_id + '.dkr.ecr.' + (serviceConfig.aws.region || 'ap-southeast-2') + '.amazonaws.com';
}

// ******************************

function getAwsDockerCredentials (in_serviceConfig, in_options) {
    let opt = in_options || {};
    if (!awsInstalled()) {
        cprint.yellow('AWS-CLI isn\'t installed');
        return false;
    }

    let awsCmdResult = awsCmd(['ecr', 'get-login'], {
        hide: !opt.verbose,
        profile: opt.profile
    });

    if (awsCmdResult.hasError) {
        awsCmdResult.printError();
        return false;
    }

    let response = awsCmdResult.result;
    let responseRegExp = new RegExp('docker login -u (AWS) -p ([\\S]+) -e (.*?) (https?:\/\/.*)');
    let responseMatch = response.match(responseRegExp);
    if (!responseMatch || responseMatch.length !== 5) {
        return false;
    }

    let accountId = -1;
    let region = '';

    let address = responseMatch[4] || '';
    let addressMatch = address.match(/https?:\/\/([0-9]+)\.dkr\.ecr\.(.*)\.amazonaws\.com/);
    if (addressMatch && addressMatch.length === 3) {
        accountId = parseInt(addressMatch[1]);
        region = addressMatch[2];
    }

    return {
        username: responseMatch[1],
        password: responseMatch[2],
        account_id: accountId,
        region: region
    };
}

// ******************************

function getAwsSecretKey (in_serviceConfig) {
    let serviceConfig = service.accessConfig(in_serviceConfig, {
        aws: {
            access_key: 'STRING',
            secret_key: 'STRING'
        }
    });

    let awsSecretKey = serviceConfig.aws.secret_key;

    if (!awsSecretKey) {
        if (serviceConfig.aws.access_key) {
            awsSecretKey = env.getStoredSecretKey('aws', serviceConfig.aws.access_key);
        }
    }

    if (!awsSecretKey) {
        awsSecretKey = env.getStoredSecretKey('aws', '');
    }

    return awsSecretKey;
}

// ******************************
// Setup Functions:
// ******************************

function awsLogin (in_serviceConfig) {
    let serviceConfig = service.accessConfig(in_serviceConfig, {
        aws: {
            access_key: 'STRING',
            secret_key: 'STRING'
        }
    });

    let path = require('path');

    if (!awsInstalled()) {
        cprint.yellow('AWS-CLI isn\'t installed');
        return false;
    }

    let awsAccessKey = serviceConfig.aws.access_key;
    if (!awsAccessKey) {
        cprint.yellow("AWS access key not set");
        return false;
    }

    let awsSecretKey = getAwsSecretKey(in_serviceConfig);
    if (!awsSecretKey) {
        cprint.yellow("AWS secret key not set");
        return false;
    }

    let awsRegion = serviceConfig.aws.region || 'ap-southeast-2';

    let awsFolder = path.resolve(env.getShellHome(), '.aws');
    if (!fs.folderExists(awsFolder)) {
        fs.createFolder(awsFolder);
    }

    let awsCredentialsFile = path.resolve(awsFolder, 'credentials');
    let awsConfigFile = path.resolve(awsFolder, 'config');

    cprint.cyan('Setting up AWS credentials...');

    fs.writeFile(awsCredentialsFile, [
        `[default]`,
        `aws_access_key_id = ${awsAccessKey}`,
        `aws_secret_access_key = ${awsSecretKey}`,
        ``
    ].join('\n'), true);

    fs.writeFile(awsConfigFile, [
        `[default]`,
        `region = ${awsRegion}`,
        ``
    ].join('\n'), true);
}

// ******************************
// Other Functions:
// ******************************

function awsArnToTitle (in_arn) {
    let title = in_arn || '';
    let match = in_arn.match(/arn:aws:[a-z]+:[a-z0-9-]+:[0-9]+:[a-z-]+\/(.*)/);
    if (match) {
        title = match[1];
    }

    return title;
}

// ******************************

function awsCmd (in_args, in_options) {
    let opt = in_options || {};
    let hide = opt.hide;

    if (!awsInstalled()) {
        cprint.yellow('AWS-CLI isn\'t installed');
        return false;
    }

    if (!in_args) {
        return false;
    }

    let args = in_args;

    if (!Array.isArray(args)) {
        args = [args]
    }

    args.push('--profile');

    if (opt.profile) {
        args.push(opt.profile);
    } else {
        args.push('default');
    }

    return exec.cmdSync('aws', args, {
        indent: '  ',
        hide: hide
    });
}

// ******************************

function parseAwsCmdResult (in_cmdResult) {
    if (in_cmdResult.hasError) {
        in_cmdResult.printError('  ');
    }

    let jsonObject;
    try {
        jsonObject = JSON.parse(in_cmdResult.result)
    } catch (e) {
        cprint.red('Failed to parse "' + jsonObject.result + '":\n  ' + e.stack);
        return false;
    }

    return jsonObject;
}

// ******************************

function awsInstalled () {
    if (g_AWS_CLI_INSTALLED === undefined) {
        g_AWS_CLI_INSTALLED = !!awsVersion();
    }
    return g_AWS_CLI_INSTALLED;
}

// ******************************

function awsVersion () {
    let cmdResult = exec.cmdSync('aws', ['--version'], {
        indent: '',
        hide: true,
        errToOut: true
    });

    if (cmdResult.hasError) {
        return false;
    } else {
        return cmdResult.result;
    }
}

// ******************************
// Exports:
// ******************************

module.exports['arnToTitle'] = awsArnToTitle;
module.exports['clearCachedAutoScalingGroupInstanceCount'] = clearCachedAutoScalingGroupInstanceCount;
module.exports['clearCachedAutoScalingGroups'] = clearCachedAutoScalingGroups;
module.exports['clearCachedLaunchConfigurationLike'] = clearCachedLaunchConfigurationLike;
module.exports['clearCachedLaunchConfigurationsLike'] = clearCachedLaunchConfigurationsLike;
module.exports['clearCachedTaskDefinitionArnForTaskDefinition'] = clearCachedTaskDefinitionArnForTaskDefinition;
module.exports['clearCachedDockerRepositoryImagesForRepositoryName'] = clearCachedDockerRepositoryImagesForRepositoryName;
module.exports['cmd'] = awsCmd;
module.exports['createCluster'] = createCluster;
module.exports['createClusterService'] = createClusterService;
module.exports['createDockerRepository'] = createDockerRepository;
module.exports['deleteDockerRepositoryImages'] = deleteDockerRepositoryImages;
module.exports['deleteLaunchConfiguration'] = deleteLaunchConfiguration;
module.exports['deployTaskDefinitionToCluster'] = deployTaskDefinitionToCluster;
module.exports['deregisterTaskDefinition'] = deregisterTaskDefinition;
module.exports['getAutoScalingGroupForLaunchConfiguration'] = getAutoScalingGroupForLaunchConfiguration;
module.exports['getAutoScalingGroupInstanceCount'] = getAutoScalingGroupInstanceCount;
module.exports['getAutoScalingGroups'] = getAutoScalingGroups;
module.exports['getClusterArnForClusterName'] = getClusterArnForClusterName;
module.exports['getClusterServiceArnForClusterName'] = getClusterServiceArnForClusterName;
module.exports['getClusterServiceVersionForTaskDefinition'] = getClusterServiceVersionForTaskDefinition;
module.exports['getClusterTaskArnsForCluster'] = getClusterTaskArnsForCluster;
module.exports['getContainerInstance'] = getContainerInstance;
module.exports['getDefaultVpcSecurityGroupIdForVpc'] = getDefaultVpcSecurityGroupIdForVpc;
module.exports['getDockerCredentials'] = getAwsDockerCredentials;
module.exports['getDockerRepositoryForDockerImageName'] = getDockerRepositoryForDockerImageName;
module.exports['getDockerRepositoryImagesForRepositoryName'] = getDockerRepositoryImagesForRepositoryName;
module.exports['getDockerRepositoryUrl'] = getAwsDockerRepositoryUrl;
module.exports['getInstanceIdsWithTags'] = getInstanceIdsWithTags;
module.exports['getLatestTaskDefinitionArnForTaskDefinition'] = getLatestTaskDefinitionArnForTaskDefinition;
module.exports['getLaunchConfigurationLike'] = getLaunchConfigurationLike;
module.exports['getLaunchConfigurationsLike'] = getLaunchConfigurationsLike;
module.exports['getMergedServiceConfig'] = getMergedAwsServiceConfig;
module.exports['getPreviousTaskDefinitionArnsForTaskDefinition'] = getPreviousTaskDefinitionArnsForTaskDefinition;
module.exports['getRepositoryServiceConfig'] = getAwsRepositoryServiceConfig;
module.exports['getSecretKey'] = getAwsSecretKey;
module.exports['getServiceConfig'] = getAwsServiceConfig;
module.exports['getServiceStateFromAutoScalingGroupInstanceCount'] = getServiceStateFromAutoScalingGroupInstanceCount;
module.exports['getTaskDefinition'] = getTaskDefinition;
module.exports['getTaskDefinitionArnForClusterService'] = getTaskDefinitionArnForClusterService;
module.exports['getTaskDetails'] = getTaskDetails;
module.exports['getTasks'] = getTasks;
module.exports['getVpcIdForVpc'] = getVpcIdForVpc;
module.exports['getVpcSecurityGroupIdFromGroupName'] = getVpcSecurityGroupIdFromGroupName;
module.exports['getVpcSubnetIdForVpc'] = getVpcSubnetIdForVpc;
module.exports['installed'] = awsInstalled;
module.exports['login'] = awsLogin;
module.exports['parseCmdResult'] = parseAwsCmdResult;
module.exports['setAutoScalingGroupInstanceCount'] = setAutoScalingGroupInstanceCount;
module.exports['stopClusterTask'] = stopClusterTask;
module.exports['version'] = awsVersion;

// ******************************
