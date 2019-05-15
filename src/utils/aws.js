'use strict'; // JS: ES6

// ******************************
// Requires:
// ******************************

const cprint = require('color-print');

const blob = require('./secureBlob');
const cache = require('./cache');
const date = require('./date');
const env = require('./env');
const exec = require('./exec');
const fs = require('./filesystem');
const ini = require('./ini');
const readline = require('./readline');
const service = require('./service');

// ******************************
// Globals:
// ******************************

let g_AWS_CLI_INSTALLED = undefined;
let g_AWS_CMD = 'aws';

// ******************************
// Cluster Functions:
// ******************************

function getClusterArnForClusterName (in_clusterName, in_options) {
    let opts = in_options || {};

    let awsCache = opts.cache || {};
    let cacheKey = `Cluster_${opts.profile}_${opts.region}_${in_clusterName}`;
    let cacheItem = awsCache[cacheKey];
    let cacheVal = (cacheItem || {}).val;
    if (cacheVal !== undefined) {
        return cacheVal;
    }

    if (opts.verbose) {
        cprint.cyan('Retrieving AWS Cluster ARN for AWS Cluster "' + in_clusterName + '"...');
    }

    let cmdResult = awsCmd([
        'ecs',
        'list-clusters'
    ], {
        hide: !opts.verbose,
        profile: opts.profile,
        region: opts.region
    });

    if (cmdResult.hasError) {
        return cmdResult.throwError();
    }

    let awsClusterArn;
    let awsResult = parseAwsCmdResult(cmdResult);
    if (awsResult && awsResult.clusterArns) {
        awsClusterArn = awsResult.clusterArns
            .find(a => a.match(in_clusterName));
    }

    if (awsClusterArn === undefined) {
        if (!opts.hideWarnings) {
            cprint.yellow('Couldn\'t find AWS Cluster ARN for AWS Cluster "' + in_clusterName + '"');
        }
        return;
    }

    awsCache[cacheKey] = {
        val: awsClusterArn,
        expires: date.getTimestamp() + cache.durations.week
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
        cmdResult.throwError();
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
        cmdResult.throwError();
        return false;
    }

    // cmdResult.printResult('  ');
    cprint.green('Deployed AWS Task Definition "' + in_taskDefinitionArn + '" to AWS Cluster "' + in_clusterName + '"');
    return true;
}

// ******************************
// Cluster Service Functions:
// ******************************

function getEnvironmentCluster (in_clusters, in_environment) {
    let clusters = in_clusters || [];

    if (in_environment) {
        let environmentCluster = clusters.find(c => {
            return c.environment === in_environment;
        });

        if (!environmentCluster) {
            throw new Error(`Service doesn't have a ${in_environment} environment configured`);
        }

        return environmentCluster;
    }

    if (clusters.length === 1 && clusters[0].environment) {
        return clusters[0];
    }

    let defaultCluster = clusters
        .find(c => c.default && c.environment);

    if (defaultCluster) {
        return defaultCluster;
    }

    return false;
}

// ******************************

function getClusterServiceArnForClusterName (in_clusterArn, in_clusterServiceName, in_options) {
    let opts = in_options || {};

    let awsCache = opts.cache || {};
    let cacheKey = `Cluster_${opts.profile}_${opts.region}_${in_clusterArn}`;
    let cacheItem = awsCache[cacheKey];
    let cacheVal = (cacheItem || {}).val;
    if (cacheVal !== undefined) {
        return cacheVal;
    }

    if (!in_clusterServiceName) {
        throw new Error('AWS Cluster Service name not set');
    }

    if (opts.verbose) {
        cprint.cyan('Retrieving AWS Cluster Service ARN in AWS Cluster "' + awsArnToTitle(in_clusterArn) +'" for AWS Cluster Service "' + in_clusterServiceName + '"...');
    }

    let cmdResult = awsCmd([
        'ecs',
        'list-services',
        '--cluster', in_clusterArn
    ], {
        hide: !opts.verbose,
        profile: opts.profile,
        region: opts.region
    });

    if (cmdResult.hasError) {
        return cmdResult.throwError();
    }

    let awsClusterServiceArn;
    let awsResult = parseAwsCmdResult(cmdResult);
    if (awsResult && awsResult.serviceArns) {
        awsClusterServiceArn = awsResult.serviceArns
            .find(a => a.includes(in_clusterServiceName));
    }

    if (awsClusterServiceArn === undefined) {
        if (!opts.hideWarnings) {
            cprint.yellow('Couldn\'t find AWS Cluster Service ARN in AWS Cluster "' + awsArnToTitle(in_clusterArn) +'" for AWS Cluster Service "' + in_clusterServiceName + '"');
        }
        return;
    }

    awsCache[cacheKey] = {
        val: awsClusterServiceArn,
        expires: date.getTimestamp() + cache.durations.week
    };

    return awsClusterServiceArn;
}

// ******************************

function createClusterService (in_clusterServiceConfig, in_options) {
    let clusterServiceConfig = in_clusterServiceConfig || {};

    let clusterArn = clusterServiceConfig.name;
    let clusterServiceName = clusterServiceConfig.serviceName;
    let taskDefinitionArn = clusterServiceConfig.taskDefinitionArn;
    let loadBalancers = clusterServiceConfig.loadBalancers || [];
    let desiredCount = clusterServiceConfig.desiredCount || 0;
    let role = clusterServiceConfig.role;
    let healthCheckGracePeriod = clusterServiceConfig.healthCheckGracePeriod || 300;
    let maximumHealthyPercent = clusterServiceConfig.maximumHealthyPercent || 200;
    let minimumHealthyPercent = clusterServiceConfig.minimumHealthyPercent || 50;

    cprint.cyan('Creating AWS Cluster Service in AWS Cluster "' + awsArnToTitle(clusterArn) +'" for AWS Cluster Service "' + clusterServiceName + '"...');

    let args = [
        'ecs',
        'create-service',
        '--cluster', clusterArn,
        '--task-definition', taskDefinitionArn,
        '--service-name', clusterServiceName,
        '--desired-count', desiredCount,
        '--deployment-configuration', JSON.stringify({
            maximumPercent: maximumHealthyPercent,
            minimumHealthyPercent: minimumHealthyPercent
        })
    ];

    if (loadBalancers && loadBalancers.length) {
        args.push('--health-check-grace-period-seconds');
        args.push(healthCheckGracePeriod);
        args.push('--load-balancers');
        args.push(JSON.stringify(loadBalancers));
        if (role) {
            args.push('--role');
            args.push(role);
        }
    }

    let cmdResult = awsCmd(args, in_options);

    if (cmdResult.hasError) {
        cmdResult.throwError();
        return false;
    }

    cmdResult.printResult('  ');
    cprint.green('Created AWS Cluster Service in AWS Cluster "' + awsArnToTitle(clusterArn) + '" for AWS Cluster Service "' + clusterServiceName + '"');
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
        cmdResult.throwError();
        return false;
    }

    cmdResult.printResult('  ');
    cprint.green('Stopped AWS Task "' + in_taskArn + '" in AWS Cluster "' + in_clusterName + '"');
    return true;
}

// ******************************

function getTasks (in_clusterName, in_taskArns, in_options) {
    let opts = in_options || {};

    let awsCache = opts.cache || {};
    let cacheKey = `TaskDefinition_${opts.profile}_${opts.region}${in_clusterName}`;
    let cacheItem = awsCache[cacheKey];
    let cacheVal = (cacheItem || {}).val;
    if (cacheVal !== undefined) {
        return cacheVal;
    }

    if (!in_taskArns || !in_taskArns.length) {
        return [];
    }

    if (opts.verbose) {
        cprint.cyan('Retrieving AWS Tasks "' + in_clusterName + '"...');
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
        hide: !opts.verbose,
        profile: opts.profile,
        region: opts.region
    });

    if (cmdResult.hasError) {
        return cmdResult.throwError();
    }

    let awsTasks;
    let awsResult = parseAwsCmdResult(cmdResult);
    if (awsResult && awsResult.tasks) {
        awsTasks = awsResult.tasks;
    }

    if (!awsTasks) {
        if (!opts.hideWarnings) {
            cprint.yellow('Couldn\'t find AWS Tasks "' + in_clusterName + '"');
        }
        return;
    }

    awsCache[cacheKey] = {
        val: awsTasks,
        expires: date.getTimestamp() + cache.durations.minute
    };

    return awsTasks;
}

// ******************************

function getTaskDetails (in_clusterName, in_taskArns, in_options) {
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
    let opts = in_options || {};

    let awsCache = opts.cache || {};
    let cacheKey = `ClusterTaskArns_${opts.profile}_${opts.region}_${in_clusterName}`;
    let cacheItem = awsCache[cacheKey];
    let cacheVal = (cacheItem || {}).val;
    if (cacheVal !== undefined) {
        return cacheVal;
    }

    if (opts.verbose) {
        cprint.cyan('Retrieving AWS Cluster Task ARNs for AWS Cluster "' + in_clusterName + '"...');
    }

    let cmdResult = awsCmd([
        'ecs',
        'list-tasks',
        '--cluster',
        in_clusterName
    ], {
        hide: !opts.verbose,
        profile: opts.profile,
        region: opts.region
    });

    if (cmdResult.hasError) {
        return cmdResult.throwError();
    }

    let awsResult = parseAwsCmdResult(cmdResult);
    let awsClusterTaskArns = (awsResult || {}).taskArns;

    if (!awsClusterTaskArns) {
        if (!opts.hideWarnings) {
            cprint.yellow('Couldn\'t find AWS Cluster Task ARNs for AWS Cluster "' + in_clusterName + '"');
        }
        return;
    }

    awsCache[cacheKey] = {
        val: awsClusterTaskArns,
        expires: date.getTimestamp() + cache.durations.minute
    };

    return awsClusterTaskArns;
}

// ******************************
// Task Definition Functions:
// ******************************

function getTaskDefinition (in_taskDefinitionArn, in_options) { //TODO: Check
    let opts = in_options || {};

    let awsCache = opts.cache || {};
    let cacheKey = `TaskDefinition_${opts.profile}_${opts.region}_${in_taskDefinitionArn}`;
    let cacheItem = awsCache[cacheKey];
    let cacheVal = (cacheItem || {}).val;
    if (cacheVal !== undefined) {
        return cacheVal;
    }

    if (opts.verbose) {
        cprint.cyan('Retrieving AWS Task Definition "' + in_taskDefinitionArn + '"...');
    }

    let cmdResult = awsCmd([
        'ecs',
        'describe-task-definition',
        '--task-definition',
        in_taskDefinitionArn
    ], {
        hide: !opts.verbose,
        profile: opts.profile,
        region: opts.region
    });

    if (cmdResult.hasError) {
        return cmdResult.throwError();
    }

    let awsTaskDefinition;
    let awsResult = parseAwsCmdResult(cmdResult);
    if (awsResult && awsResult.taskDefinition) {
        awsTaskDefinition = awsResult.taskDefinition;
    }

    if (!awsTaskDefinition) {
        if (!opts.hideWarnings) {
            cprint.yellow('Couldn\'t find AWS Task Definition "' + in_taskDefinitionArn + '"');
        }
        return;
    }

    awsCache[cacheKey] = {
        val: awsTaskDefinition,
        expires: date.getTimestamp() + cache.durations.minute
    };

    return awsTaskDefinition;
}

// ******************************

function getClusterServiceVersionForTaskDefinition (in_taskDefinitionArn, in_options) {
    let opts = in_options || {};

    let taskDefinition = getTaskDefinition(in_taskDefinitionArn, in_options);
    if (!taskDefinition) {
        if (!opts.hideWarnings) {
            cprint.yellow('Couldn\'t find AWS Task Definition "' + in_taskDefinitionArn + '"');
        }
        return;
    }

    let containerDefinitions = taskDefinition.containerDefinitions || [];
    let firstContainerDefinition = containerDefinitions[0] || {};
    let image = firstContainerDefinition.image || false;

    if (!image) {
        if (!opts.hideWarnings) {
            cprint.yellow('Couldn\'t find cluster service version for AWS Task Definition "' + in_taskDefinitionArn + '"');
        }
        return;
    }

    let match = image.match(/^[0-9]+\..*\.amazonaws.com\/(.*):(.*)$/);
    if (!match) {
        throw new Error('Invalid image for task definition "' + in_taskDefinitionArn + '": ' + image);
    }

    let version = match[2];
    return version;
}

// ******************************

function getTaskDefinitionArnForClusterService (in_clusterName, in_clusterServiceArn, in_options) {
    let opts = in_options || {};

    let awsCache = opts.cache || {};
    let cacheKey = `TaskDefinitionArn_${opts.profile}_${opts.region}_${in_clusterServiceArn}`;
    let cacheItem = awsCache[cacheKey];
    let cacheVal = (cacheItem || {}).val;
    if (cacheVal !== undefined) {
        return cacheVal;
    }

    if (opts.verbose) {
        cprint.cyan('Retrieving AWS Task Definition ARN for AWS Cluster Service "' + in_clusterServiceArn + '"...');
    }

    let cmdResult = awsCmd([
        'ecs',
        'describe-services',
        '--cluster',
        in_clusterName,
        '--service',
        in_clusterServiceArn
    ], {
        hide: !opts.verbose,
        profile: opts.profile,
        region: opts.region
    });

    if (cmdResult.hasError) {
        return cmdResult.throwError();
    }

    let awsTaskDefinitionArn;
    let awsResult = parseAwsCmdResult(cmdResult);
    if (awsResult && awsResult.services) {
        awsTaskDefinitionArn = awsResult.services
            .map(obj => obj.deployments || [])
            .reduce((a,b) => a.concat(b), [])
            .map(obj => obj.taskDefinition)
            .find(() => true);
    }

    if (!awsTaskDefinitionArn) {
        if (!opts.hideWarnings) {
            cprint.yellow('Couldn\'t find AWS Task Definition ARN for AWS Cluster Service "' + in_clusterServiceArn + '"');
        }
        return;
    }

    awsCache[cacheKey] = {
        val: awsTaskDefinitionArn,
        expires: date.getTimestamp() + cache.durations.minute
    };

    return awsTaskDefinitionArn;
}

// ******************************

function getLatestTaskDefinitionArnForTaskDefinition (in_taskDefinitionName, in_options) {
    let opts = in_options || {};

    let awsCache = opts.cache || {};
    let cacheKey = `LatestTaskDefinitionArn_${opts.profile}_${opts.region}_${in_taskDefinitionName}`;
    let cacheItem = awsCache[cacheKey];
    let cacheVal = (cacheItem || {}).val;
    if (cacheVal !== undefined) {
        return cacheVal;
    }

    if (opts.verbose) {
        cprint.cyan('Retrieving latest AWS Task Definition ARN for AWS Task Definition "' + in_taskDefinitionName + '"...');
    }

    let cmdResult = awsCmd([
        'ecs',
        'list-task-definitions',
        '--family-prefix',
        in_taskDefinitionName
    ], {
        hide: !opts.verbose,
        profile: opts.profile,
        region: opts.region
    });

    if (cmdResult.hasError) {
        cmdResult.throwError();
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
                return bVal - aVal;
            })
            .find(() => true);
    }

    if (!latestTaskDefinitionArn) {
        if (!opts.hideWarnings) {
            cprint.yellow('Couldn\'t find latest AWS Task Definition ARN for AWS Task Definition "' + in_taskDefinitionName + '"');
        }
        return;
    }

    awsCache[cacheKey] = {
        val: latestTaskDefinitionArn,
        expires: date.getTimestamp() + cache.durations.minute
    };

    return latestTaskDefinitionArn;
}

// ******************************

function getPreviousTaskDefinitionArnsForTaskDefinition (in_taskDefinitionName, in_options) {
    let opts = in_options || {};

    let awsCache = opts.cache || {};
    let cacheKey = `PreviousTaskDefinitionArns_${opts.profile}_${opts.region}_${in_taskDefinitionName}`;
    let cacheItem = awsCache[cacheKey];
    let cacheVal = (cacheItem || {}).val;
    if (cacheVal !== undefined) {
        return cacheVal;
    }

    if (opts.verbose) {
        cprint.cyan('Retrieving previous AWS Task Definition ARNs for AWS Task Definition "' + in_taskDefinitionName + '"...');
    }

    let cmdResult = awsCmd([
        'ecs',
        'list-task-definitions',
        '--family-prefix',
        in_taskDefinitionName
    ], {
        hide: !opts.verbose,
        profile: opts.profile,
        region: opts.region
    });

    if (cmdResult.hasError) {
        cmdResult.throwError();
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
        if (!opts.hideWarnings) {
            cprint.yellow('Couldn\'t find previous AWS Task Definition ARNs for AWS Task Definition "' + in_taskDefinitionName + '"');
        }
        return;
    }

    awsCache[cacheKey] = {
        val: previousTaskDefinitionArn,
        expires: date.getTimestamp() + cache.durations.second
    };

    return previousTaskDefinitionArn;
}

// ******************************

function getCurrentTaskDefinitionArnForTaskDefinition (in_taskDefinitionName, in_options) {
    let opts = in_options || {};

    let awsCache = opts.cache || {};
    let cacheKey = `CurrentTaskDefinitionArn_${opts.profile}_${opts.region}_${in_taskDefinitionName}`;
    let cacheItem = awsCache[cacheKey];
    let cacheVal = (cacheItem || {}).val;
    if (cacheVal !== undefined) {
        return cacheVal;
    }

    if (opts.verbose) {
        cprint.cyan('Retrieving current AWS Task Definition ARN for AWS Task Definition "' + in_taskDefinitionName + '"...');
    }

    let cmdResult = awsCmd([
        'ecs',
        'list-task-definitions',
        '--family-prefix',
        in_taskDefinitionName
    ], {
        hide: !opts.verbose,
        profile: opts.profile,
        region: opts.region
    });

    if (cmdResult.hasError) {
        cmdResult.throwError();
        return false;
    }

    let currentTaskDefinitionArn;
    let awsResult = parseAwsCmdResult(cmdResult);
    if (awsResult && awsResult.taskDefinitionArns) {
        currentTaskDefinitionArn = awsResult.taskDefinitionArns
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
            })[0];
    }

    if (!currentTaskDefinitionArn) {
        if (!opts.hideWarnings) {
            cprint.yellow('Couldn\'t find current AWS Task Definition ARN for AWS Task Definition "' + in_taskDefinitionName + '"');
        }
        return;
    }

    awsCache[cacheKey] = {
        val: currentTaskDefinitionArn,
        expires: date.getTimestamp() + cache.durations.second
    };

    return currentTaskDefinitionArn;
}

// ******************************

function deregisterTaskDefinition (in_taskDefinitionArn, in_options) {
    let opts = in_options || {};

    cprint.cyan('Deregistering AWS Task Definition "' + in_taskDefinitionArn + '"...');

    let cmdResult = awsCmd([
        'ecs',
        'deregister-task-definition',
        '--task-definition',
        in_taskDefinitionArn
    ], in_options);

    if (cmdResult.hasError) {
        cmdResult.throwError();
        return false;
    }

    if (opts.verbose) {
        cmdResult.printResult('  ');
    }
    cprint.green('Deregistered AWS Task Definition "' + in_taskDefinitionArn + '"');
    return true;
}

// ******************************
// Container Instance Functions:
// ******************************

function getContainerInstance (in_clusterName, in_containerInstanceArn, in_options) {
    let opts = in_options || {};

    let awsCache = opts.cache || {};
    let cacheKey = `ContainerInstance_${opts.profile}_${opts.region}_${in_containerInstanceArn}`;
    let cacheItem = awsCache[cacheKey];
    let cacheVal = (cacheItem || {}).val;
    if (cacheVal !== undefined) {
        return cacheVal;
    }

    if (opts.verbose) {
        cprint.cyan('Retrieving AWS Container Instance "' + in_containerInstanceArn + '"...');
    }

    let cmdResult = awsCmd([
        'ecs',
        'describe-container-instances',
        '--cluster',
        in_clusterName,
        '--container-instance',
        in_containerInstanceArn
    ], {
        hide: !opts.verbose,
        profile: opts.profile,
        region: opts.region
    });

    if (cmdResult.hasError) {
        return cmdResult.throwError();
    }

    let awsTasks;
    let awsResult = parseAwsCmdResult(cmdResult);
    if (awsResult && awsResult.containerInstances) {
        awsTasks = awsResult.containerInstances
            .find(() => true);
    }

    if (!awsTasks) {
        if (!opts.hideWarnings) {
            cprint.yellow('Couldn\'t find AWS Container Instance "' + in_containerInstanceArn + '"');
        }
        return;
    }

    awsCache[cacheKey] = {
        val: awsTasks,
        expires: date.getTimestamp() + cache.durations.minute
    };

    return awsTasks;
}

// ******************************
// Repository Functions:
// ******************************

function getDockerRepositoryForDockerImageName (in_dockerImageName, in_options) {
    let opts = in_options || {};

    let awsCache = opts.cache || {};
    let cacheKey = `DockerRepository_${opts.profile}_${opts.region}_${in_dockerImageName}`;
    let cacheItem = awsCache[cacheKey];
    let cacheVal = (cacheItem || {}).val;
    if (cacheVal !== undefined) {
        return cacheVal;
    }

    if (opts.verbose) {
        cprint.cyan('Retrieving AWS Docker Repository for Docker Image "' + in_dockerImageName + '"...');
    }

    let cmdResult = awsCmd([
        'ecr',
        'describe-repositories'
    ], {
        hide: !opts.verbose,
        profile: opts.profile,
        region: opts.region
    });

    if (cmdResult.hasError) {
        return cmdResult.throwError();
    }

    let awsRepository;
    let awsResult = parseAwsCmdResult(cmdResult);
    if (awsResult && awsResult.repositories) {
        awsRepository = awsResult.repositories
            .map(obj => obj.repositoryName)
            .find(name => name === in_dockerImageName);
    }

    if (awsRepository === undefined) {
        if (!opts.hideWarnings) {
            cprint.yellow('Couldn\'t find AWS Docker Repository for Docker Image "' + in_dockerImageName + '"');
        }
        return;
    }

    awsCache[cacheKey] = {
        val: awsRepository,
        expires: date.getTimestamp() + cache.durations.week
    };

    return awsRepository;
}

// ******************************

function getDockerRepositoryImagesForRepositoryName (in_dockerRepositoryName, in_options) {
    let opts = in_options || {};

    let awsCache = opts.cache || {};
    let cacheKey = `DockerRepositoryImages_${opts.profile}_${opts.region}_${in_dockerRepositoryName}`;
    let cacheItem = awsCache[cacheKey];
    let cacheVal = (cacheItem || {}).val;
    if (cacheVal !== undefined) {
        return cacheVal;
    }

    if (opts.verbose) {
        cprint.cyan('Retrieving AWS Docker Repository Images for Docker Repository "' + in_dockerRepositoryName + '"...');
    }

    let cmdResult = awsCmd([
        'ecr',
        'describe-images',
        '--repository-name', in_dockerRepositoryName
    ], {
        hide: !opts.verbose,
        profile: opts.profile,
        region: opts.region
    });

    if (cmdResult.hasError) {
        return cmdResult.throwError();
    }

    let awsRepositoryImages;
    let awsResult = parseAwsCmdResult(cmdResult);
    if (awsResult && awsResult.imageDetails) {
        awsRepositoryImages = awsResult.imageDetails;
    }

    if (awsRepositoryImages === undefined) {
        if (!opts.hideWarnings) {
            cprint.yellow('Couldn\'t find AWS Docker Repository Images for Docker Repository "' + in_dockerRepositoryName + '"');
        }
        return;
    }

    awsCache[cacheKey] = {
        val: awsRepositoryImages,
        expires: date.getTimestamp() + cache.durations.hour
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
        cmdResult.throwError();
        return false;
    }

    if (cmdResult.resultObj && cmdResult.resultObj.failures) {
        cmdResult.throwError();
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
        cmdResult.throwError();
        return false;
    }

    cmdResult.printResult('  ');
    cprint.green('Created AWS Docker Repository for Docker Image "' + in_dockerImageName + '"');
    return true;
}

// ******************************
// Launch Configuration Functions:
// ******************************

function getLaunchConfigurationLike (in_launchConfigurationTemplate, in_options) {
    let opts = in_options || {};

    let awsCache = opts.cache || {};
    let cacheKey = `LaunchConfiguration_${opts.profile}_${opts.region}_${in_launchConfigurationTemplate}`;
    let cacheItem = awsCache[cacheKey];
    let cacheVal = (cacheItem || {}).val;
    if (cacheVal !== undefined) {
        return cacheVal;
    }

    if (opts.verbose) {
        cprint.cyan('Retrieving latest Launch Configuration like "' + in_launchConfigurationTemplate + '"...');
    }

    let launchConfigurations = getLaunchConfigurationsLike(in_launchConfigurationTemplate, in_options);
    let latestLaunchConfiguration;

    if (launchConfigurations && launchConfigurations.length) {
        latestLaunchConfiguration = launchConfigurations.find(() => true);
    }

    if (latestLaunchConfiguration === undefined) {
        if (!opts.hideWarnings) {
            cprint.yellow('Couldn\'t find latest Launch Configuration like "' + in_launchConfigurationTemplate + '"');
        }
        return;
    }

    awsCache[cacheKey] = {
        val: latestLaunchConfiguration,
        expires: date.getTimestamp() + cache.durations.minute
    };

    return latestLaunchConfiguration;
}

// ******************************

function getLaunchConfigurationsLike (in_launchConfigurationTemplate, in_options) {
    let opts = in_options || {};

    let awsCache = opts.cache || {};
    let cacheKey = `LaunchConfigurations_${opts.profile}_${opts.region}_${in_launchConfigurationTemplate}`;
    let cacheItem = awsCache[cacheKey];
    let cacheVal = (cacheItem || {}).val;
    if (cacheVal !== undefined) {
        return cacheVal;
    }

    if (opts.verbose) {
        cprint.cyan('Retrieving Launch Configurations like "' + in_launchConfigurationTemplate + '"...');
    }

    let cmdResult = awsCmd([
        'autoscaling',
        'describe-launch-configurations'
    ], {
        hide: !opts.verbose,
        profile: opts.profile,
        region: opts.region
    });

    if (cmdResult.hasError) {
        return cmdResult.throwError();
    }

    let launchConfigurations;
    let awsResult = parseAwsCmdResult(cmdResult);
    if (awsResult && awsResult.LaunchConfigurations) {
        launchConfigurations = awsResult.LaunchConfigurations
            .map(obj => obj.LaunchConfigurationName)
            .filter(name => name.match(in_launchConfigurationTemplate))
            .sort()
            .reverse();
    }

    awsCache[cacheKey] = {
        val: launchConfigurations,
        expires: date.getTimestamp() + cache.durations.minute
    };

    return launchConfigurations;
}

// ******************************

function deleteLaunchConfiguration (in_launchConfiguration, in_options) {
    let opts = in_options || {};

    if (opts.verbose) {
        cprint.cyan('Deleting AWS Launch Configuration "' + in_launchConfiguration + '"...');
    }

    let cmdResult = awsCmd([
        'autoscaling',
        'delete-launch-configuration',

        '--launch-configuration-name',
        in_launchConfiguration
    ], {
        hide: !opts.verbose,
        profile: opts.profile,
        region: opts.region
    });

    if (cmdResult.hasError) {
        cmdResult.throwError();
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
    let opts = in_options || {};

    cprint.cyan('Setting Instance Count for AWS Auto Scaling Group "' + in_autoScalingGroupName + '" to ' + in_autoScalingGroupInstanceCount + '...');

    let cmdResult = awsCmd([
        'autoscaling',
        'update-auto-scaling-group',
        '--auto-scaling-group', in_autoScalingGroupName,
        '--desired-capacity', in_autoScalingGroupInstanceCount,
        '--min-size', 0
    ], in_options);

    if (cmdResult.hasError) {
        cmdResult.throwError();
        return false;
    }

    cmdResult.printResult('  ');
    cprint.green('Set Instance Count for AWS Auto Scaling Group "' + in_autoScalingGroupName + '" to ' + in_autoScalingGroupInstanceCount);
    clearCachedAutoScalingGroupInstanceCount(in_autoScalingGroupName, opts.cache);
    return true;
}

// ******************************

function getAutoScalingGroups (in_options) {
    let opts = in_options || {};

    let awsCache = opts.cache || {};
    let cacheKey = `AllAutoScalingGroups_${opts.profile}_${opts.region}`;
    let cacheItem = awsCache[cacheKey];
    let cacheVal = (cacheItem || {}).val;
    if (cacheVal !== undefined) {
        return cacheVal;
    }

    if (opts.verbose) {
        cprint.cyan('Retrieving all AWS Auto Scaling Groups...');
    }

    let cmdResult = awsCmd([
        'autoscaling',
        'describe-auto-scaling-groups'
    ], {
        hide: !opts.verbose,
        profile: opts.profile,
        region: opts.region
    });

    if (cmdResult.hasError) {
        return cmdResult.throwError();
    }

    let autoScalingGroups;
    let awsResult = parseAwsCmdResult(cmdResult);
    if (awsResult && awsResult.AutoScalingGroups) {
        autoScalingGroups = awsResult.AutoScalingGroups;
    }

    if (autoScalingGroups === undefined) {
        if (!opts.hideWarnings) {
            cprint.yellow('Couldn\'t find any AWS Auto Scaling Groups');
        }
        return;
    }

    awsCache[cacheKey] = {
        val: autoScalingGroups,
        expires: date.getTimestamp() + cache.durations.minute
    };

    return autoScalingGroups;
}

// ******************************

function getAutoScalingGroupInstanceCount (in_autoScalingGroupName, in_options) {
    let opts = in_options || {};

    let awsCache = opts.cache || {};
    let cacheKey = `AutoScalingGroupInstanceCount_${opts.profile}_${opts.region}_${in_autoScalingGroupName}`;
    let cacheItem = awsCache[cacheKey];
    let cacheVal = (cacheItem || {}).val;
    if (cacheVal !== undefined) {
        return cacheVal;
    }

    if (opts.verbose) {
        cprint.cyan('Retrieving Instance Count for AWS Auto Scaling Group "' + in_autoScalingGroupName + '"...');
    }

    let cmdResult = awsCmd([
        'autoscaling',
        'describe-auto-scaling-groups',
        '--auto-scaling-group', in_autoScalingGroupName
    ], {
        hide: !opts.verbose,
        profile: opts.profile,
        region: opts.region
    });

    if (cmdResult.hasError) {
        return cmdResult.throwError();
    }

    let desiredCapacity;
    let awsResult = parseAwsCmdResult(cmdResult);
    if (awsResult && awsResult.AutoScalingGroups) {
        desiredCapacity = awsResult.AutoScalingGroups
            .map(obj => obj.DesiredCapacity)
            .find(() => true);
    }

    if (desiredCapacity === undefined) {
        if (!opts.hideWarnings) {
            cprint.yellow('Couldn\'t find Instance Count for AWS Auto Scaling Group "' + in_autoScalingGroupName + '"');
        }
        return;
    }

    awsCache[cacheKey] = {
        val: desiredCapacity,
        expires: date.getTimestamp() + cache.durations.minute
    };

    return desiredCapacity;
}

// ******************************

function getAutoScalingGroupForLaunchConfiguration (in_launchConfigurationName, in_options) {
    let opts = in_options || {};

    if (opts.verbose) {
        cprint.cyan('Retrieving AWS Auto Scaling Group for Launch Configuration "' + in_launchConfigurationName + '"...');
    }

    let autoScalingGroups = getAutoScalingGroups(in_options);
    if (!autoScalingGroups || !autoScalingGroups.length) {
        if (!opts.hideWarnings) {
            cprint.yellow('Couldn\'t find any AWS Auto Scaling Groups');
        }
        return;
    }

    let autoScalingGroupForLaunchConfiguration = autoScalingGroups
        .find(g => g.LaunchConfigurationName === in_launchConfigurationName);

    return autoScalingGroupForLaunchConfiguration;
}

// ******************************
// IAM Role Functions:
// ******************************

function getTargetGroups (in_options) {
    let opts = in_options || {};

    let awsCache = opts.cache || {};
    let cacheKey = `AllTargetGroups_${opts.profile}_${opts.region}`;
    let cacheItem = awsCache[cacheKey];
    let cacheVal = (cacheItem || {}).val;
    if (cacheVal !== undefined) {
        return cacheVal;
    }

    if (opts.verbose) {
        cprint.cyan('Retrieving all AWS Target Groups...');
    }

    let cmdResult = awsCmd([
        'elbv2',
        'describe-target-groups'
    ], {
        hide: !opts.verbose,
        profile: opts.profile,
        region: opts.region
    });

    if (cmdResult.hasError) {
        return cmdResult.throwError();
    }

    let autoScalingGroups;
    let awsResult = parseAwsCmdResult(cmdResult);
    if (awsResult && awsResult.TargetGroups) {
        autoScalingGroups = awsResult.TargetGroups;
    }

    if (autoScalingGroups === undefined) {
        if (!opts.hideWarnings) {
            cprint.yellow('Couldn\'t find any AWS Target Groups');
        }
        return;
    }

    awsCache[cacheKey] = {
        val: autoScalingGroups,
        expires: date.getTimestamp() + cache.durations.minute
    };

    return autoScalingGroups;
}

// ******************************

function getTargetGroupArnForTargetGroupName (in_targetGroupName, in_options) {
    let opts = in_options || {};

    if (opts.verbose) {
        cprint.cyan('Retrieving AWS Target Group for AWS Target Group Name "' + in_targetGroupName + '"...');
    }

    let targetGroups = getTargetGroups(in_options);
    if (!targetGroups || !targetGroups.length) {
        if (!opts.hideWarnings) {
            cprint.yellow('Couldn\'t find any AWS Target Groups');
        }
        return;
    }

    let targetGroup = targetGroups
        .find(g => g.TargetGroupName === in_targetGroupName);

    if (!targetGroup || !targetGroup.TargetGroupArn) {
        if (!opts.hideWarnings) {
            cprint.yellow('Couldn\'t find AWS Target Groups for AWS Target Group Name "' + in_targetGroupName + '"');
        }
        return;
    }

    return targetGroup.TargetGroupArn;
}

// ******************************
// SAML Functions:
// ******************************

function getSamlAssertion (in_options, in_retryAttempts) {
    let opts = in_options || {};

    let type = opts.type;

    let awsCache = opts.cache || {};
    let cacheKey = `SamlAssertion_${type}`;
    let cacheItem = awsCache[cacheKey];
    let cacheVal = (cacheItem || {}).val;
    if (cacheVal !== undefined) {
        return cacheVal;
    }

    cprint.cyan('Using federated login to get AWS credentials...');

    let samlResponse = '';

    if (type === 'SSO') {
        let cookieString = '';

        let sessionUrl = opts.sessionUrl;
        if (sessionUrl) {
            let cmdArgs = [
                '-s',
                '-L',
                '-o', '/dev/null',
                '-c', '-'
            ];

            if (opts.sessionHeaders) {
                opts.sessionHeaders
                    .forEach(header => {
                        cmdArgs.push('-H');
                        cmdArgs.push(`${header.header}: ${header.value}`);
                    });
            }

            cmdArgs.push(sessionUrl);

            let cmdResult = exec.cmdSync('curl', cmdArgs, {
                hide: true
            });

            if (cmdResult.hasError) {
                return cmdResult.throwError();
            }

            let reponseRows =
                cmdResult.result
                    .split(/[\r\n]+/)
                    .map(line => line.trim())
                    .filter(line => line && !line.match(/^#.*/));

            cookieString = reponseRows
                .map(line => {
                    let parts = line.split(/\t/);
                    let cookieName = parts[5];
                    let cookieValue = parts[6];
                    return `${cookieName}=${cookieValue};`;
                })
                .join(' ');
        }

        let loginData = getSamlLoginData(in_options);

        let policyUrl = opts.policyUrl;
        if (!policyUrl) {
            throw new Error('Policy url is not set');
        }

        let cmdResult = exec.cmdSync('curl', [
            '-X', 'POST',
            '-s',
            '-L',
            '-c', '-',
            '-d', loginData,
            '--cookie', cookieString,
            policyUrl
        ], {
            hide: true
        });

        if (cmdResult.hasError) {
            return cmdResult.throwError();
        }

        let samlRegExp = new RegExp(/name="SAMLResponse" value="(.+?)"/, 'i');
        let samlRegExpMatch = cmdResult.result.match(samlRegExp);
        if (!samlRegExpMatch) {
            if (in_retryAttempts > 2) {
                throw new Error('SAML login failed, Max retry attempts reached.');
            }
            cprint.yellow('SAML login failed! Did you type in the correct password?');
            clearSamlLoginData(awsCache);
            clearSamlLoginUsername(awsCache);
            return getSamlAssertion(in_options, (in_retryAttempts || 0) + 1);
        }

        samlResponse = samlRegExpMatch[1];

    } else if (type === 'Okta') {
        let oktaOrgUrl = opts.oktaOrgUrl;
        let oktaAwsAppUrl = opts.oktaAwsAppUrl;

        let authUrl = `${oktaOrgUrl}/api/v1/authn`;
        let authHeaders = (opts.authHeaders || []).concat([
            {
                'header': 'Content-Type',
                'value': 'application/json'
            }
        ]);

        let loginData = getSamlLoginData(in_options, 'email', 'json');

        let authCurlArgs = [
            '-s',
            '-L',
            '-d', loginData
        ];

        authHeaders
            .forEach(header => {
                authCurlArgs.push('-H');
                authCurlArgs.push(`${header.header}: ${header.value}`);
            });

        authCurlArgs.push(authUrl);

        let authCurlResult = exec.cmdSync('curl', authCurlArgs, {
            hide: true
        });

        if (authCurlResult.hasError) {
            return authCurlResult.throwError();
        }

        if (!authCurlResult.resultObj || !authCurlResult.resultObj.sessionToken) {
            throw new Error('Failed to get session token');
        }

        let sessionToken = authCurlResult.resultObj.sessionToken;

        let redirectOnAuthUrl = `${oktaOrgUrl}/login/sessionCookieRedirect?checkAccountSetupComplete=true&token=${sessionToken}&redirectUrl=${oktaAwsAppUrl}`;
        if (!redirectOnAuthUrl) {
            throw new Error('Redirect on auth url is not set');
        }

        let redirectOnAuthCurlArgs = [
            '-s',
            '-L',
            '-I',
            '-c', '-'
        ];

        (opts.redirectOnAuthHeaders || [])
            .forEach(header => {
                redirectOnAuthCurlArgs.push('-H');
                redirectOnAuthCurlArgs.push(`${header.header}: ${header.value}`);
            });

        redirectOnAuthCurlArgs.push(redirectOnAuthUrl);

        let redirectOnAuthCurlResult = exec.cmdSync('curl', redirectOnAuthCurlArgs, {
            hide: true
        });

        if (redirectOnAuthCurlResult.hasError) {
            return redirectOnAuthCurlResult.throwError();
        }

        let reponseRows =
            redirectOnAuthCurlResult.result
                .split(/[\r\n]+/)
                .map(line => line.trim())
                .filter(line => line && !line.match(/^#.*/));

        let samlLocation = reponseRows.find(row => row.match(/Location: .*sso\/saml/));
        if (!samlLocation) {
            throw new Error('Failed to extract SAML location');
        }
        samlLocation = samlLocation.replace('Location: ', '');

        let sid = reponseRows.find(row => row.match(/Set-Cookie: sid=[^"]+;.*/));
        if (!sid) {
            throw new Error('Failed to extract sid');
        }
        sid = sid.match(/Set-Cookie: sid=([^"]+?);.*/)[1];

        let cmdResult = exec.cmdSync('curl', [
            '-s',
            '-L',
            '--cookie', `sid=${sid}`,
            samlLocation
        ], {
            hide: true
        });

        if (cmdResult.hasError) {
            return cmdResult.throwError();
        }

        let samlRegExp = new RegExp(/name="SAMLResponse".*? value="(.+?)"/, 'i');
        let samlRegExpMatch = cmdResult.result.match(samlRegExp);
        if (!samlRegExpMatch) {
            if (in_retryAttempts > 2) {
                throw new Error('SAML login failed, Max retry attempts reached.');
            }
            cprint.yellow('SAML login failed! Did you type in the correct password?');
            clearSamlLoginData(awsCache, 'json');
            clearSamlLoginUsername(awsCache);
            return getSamlAssertion(in_options, (in_retryAttempts || 0) + 1);
        }

        samlResponse = samlRegExpMatch[1]
            .replace(/&#x2b;/g,'+')
            .replace(/&#x3d;/g,'=');

    } else {
        throw new Error(`Unhandled type: ${type}`);
    }

    awsCache[cacheKey] = {
        val: samlResponse,
        expires: date.getTimestamp() + cache.durations.minute * 4.5
    };

    return samlResponse;

}

// ******************************

function getSamlLoginData(in_options, in_usernameType, in_mode) {
    let opts = in_options || {};
    let mode = in_mode || 'form';

    let passwordPromptText = opts.passwordPromptText || 'Please enter your SAML password';

    let awsCache = opts.cache || {};
    let cacheKey = 'SamlLoginData' + (mode === 'form' ? '' : `_${mode}`);
    let cacheItem = awsCache[cacheKey];
    let cacheVal = (cacheItem || {}).val;
    if (cacheVal !== undefined) {
        if (env.persistSamlPwd()) {
            return blob.decrypt(cacheVal);
        } else {
            clearSamlLoginData(awsCache);
        }
    }

    let samlUsername = getSamlLoginUsername(in_options, in_usernameType);
    let samlPassword = readline.hiddenSync(passwordPromptText, samlUsername);
    let data = null;

    switch (mode) {
    case 'form':
        data = `username=${samlUsername}&password=${samlPassword}`;
        break;
    case 'json':
        data = JSON.stringify({username: samlUsername, password: samlPassword});
        break;
    default:
        throw new Error(`Unhandled mode: ${in_mode}`);
    }

    if (env.persistSamlPwd()) {
        cprint.red('Presisting SAML pwd since SERVICERATOR_PERSIST_SAML_PWD is set to true.');
        cprint.red('This is very dangerous, only do this if you know what you are doing!');
        awsCache[cacheKey] = {
            val: blob.encrypt(data),
            expires: date.getTimestamp() + cache.durations.day * 28
        };
    }

    return data;
}

// ******************************

function getSamlLoginUsername(in_options, in_type) {
    let opts = in_options || {};
    let type = in_type || 'username';

    let usernamePromptText = opts.usernamePromptText || 'Please enter your SAML username';

    let awsCache = opts.cache || {};
    let cacheKey = 'SamlLoginUsername' + (type === 'username' ? '' : `_${type}`);
    let cacheItem = awsCache[cacheKey];
    let cacheVal = (cacheItem || {}).val;
    if (cacheVal !== undefined) {
        return blob.decrypt(cacheVal);
    }

    let samlUsername = readline.sync(usernamePromptText);

    awsCache[cacheKey] = {
        val: blob.encrypt(samlUsername),
        expires: date.getTimestamp() + cache.durations.day * 7
    };

    return samlUsername;
}

// ******************************

function clearSamlLoginUsername(in_cache) {
    let awsCache = in_cache || {};
    let cacheKey = 'SamlLoginUsername';
    delete awsCache[cacheKey];
}

// ******************************

function clearSamlLoginData(in_cache, in_mode) {
    let mode = in_mode || 'form';
    let awsCache = in_cache || {};
    let cacheKey = 'SamlLoginData' + (mode === 'form' ? '' : `_${mode}`);
    delete awsCache[cacheKey];
}

// ******************************
// IAM Role Functions:
// ******************************

function getRoleCredentialsForRoleName (in_roleName, in_options) {
    let awsRoleArn = getRoleArnForRoleName(in_roleName, in_options);
    if (!awsRoleArn) {
        return;
    }

    let roleCredentials = getRoleCredentials(awsRoleArn, in_options);
    if (!roleCredentials) {
        return;
    }

    return roleCredentials;
}

// ******************************

function getRoleCredentials (in_roleArn, in_options) {
    let opts = in_options || {};

    let awsCache = opts.cache || {};
    let cacheKey = `RoleAssumedCredentials_${opts.profile}_${opts.region}_${in_roleArn}`;
    let cacheItem = awsCache[cacheKey];
    let cacheVal = (cacheItem || {}).val;
    if (cacheVal !== undefined) {
        return cacheVal;
    }

    if (opts.verbose) {
        cprint.cyan('Assuming credentials for AWS Role ARN "' + in_roleArn + '"...');
    }

    let cmdResult = awsCmd([
        'sts',
        'assume-role',
        '--role-arn', in_roleArn,
        '--role-session-name', 'servicerator'
    ], {
        hide: !opts.verbose,
        profile: opts.profile,
        region: opts.region
    });

    if (cmdResult.hasError) {
        cmdResult.throwError();
        return false;
    }

    let awsRoleAssumedCredentials;
    let awsResult = parseAwsCmdResult(cmdResult);
    if (awsResult && awsResult.Credentials) {
        awsRoleAssumedCredentials = awsResult.Credentials;
    }

    if (!awsRoleAssumedCredentials) {
        if (!opts.hideWarnings) {
            cprint.yellow('Couldn\'t assume credentials for AWS Role ARN "' + in_roleArn + '"');
        }
        return false;
    }

    awsCache[cacheKey] = {
        val: awsRoleAssumedCredentials,
        expires: date.getTimestamp() + cache.durations.halfHour
    };

    return awsRoleAssumedCredentials;
}

// ******************************

function getRoleSamlCredentials (in_options) {
    let opts = in_options || {};

    let roleArn = opts.roleArn;
    let principalArn = opts.principalArn;

    let awsCache = opts.cache || {};
    let cacheKey = `RoleAssumedCredentials_${roleArn}`;
    let cacheItem = awsCache[cacheKey];
    let cacheVal = (cacheItem || {}).val;
    if (cacheVal !== undefined) {
        return cacheVal;
    }

    if (opts.verbose) {
        cprint.cyan(`Assuming credentials via SAML for AWS Role ARN "${roleArn}"...`);
    }

    let samlAssertion = getSamlAssertion(in_options);
    if (!samlAssertion) {
        return;
    }

    let samlAssertionFile = '.saml';
    fs.writeFile(samlAssertionFile, samlAssertion, true);

    let cmdResult = awsCmd([
        'sts',
        'assume-role-with-saml',
        '--role-arn', roleArn,
        '--principal-arn', principalArn,
        '--saml-assertion', `fileb://${samlAssertionFile}`
    ], {
        hide: !opts.verbose,
        no_profile: true
    });

    fs.deleteFile(samlAssertionFile);

    if (cmdResult.hasError) {
        cmdResult.throwError();
        return false;
    }

    let awsRoleAssumedCredentials;
    let awsResult = parseAwsCmdResult(cmdResult);
    if (awsResult && awsResult.Credentials) {
        awsRoleAssumedCredentials = awsResult.Credentials;
    }

    if (!awsRoleAssumedCredentials) {
        if (!opts.hideWarnings) {
            cprint.yellow(`Couldn't assume credentials for AWS Role ARN "${roleArn}"`);
        }
        return false;
    }

    awsCache[cacheKey] = {
        val: awsRoleAssumedCredentials,
        expires: date.getTimestamp() + cache.durations.halfHour
    };

    return awsRoleAssumedCredentials;
}

// ******************************

function getRoleArnForRoleName (in_roleName, in_options) {
    let opts = in_options || {};

    let awsCache = opts.cache || {};
    let cacheKey = `RoleArn_${opts.profile}_${opts.region}_${in_roleName}`;
    let cacheItem = awsCache[cacheKey];
    let cacheVal = (cacheItem || {}).val;
    if (cacheVal !== undefined) {
        return cacheVal;
    }

    if (opts.verbose) {
        cprint.cyan('Retrieving AWS Role ARN for Role "' + in_roleName + '"...');
    }

    let awsRoleArn = _getRoleArns(in_options)
        .filter(obj => obj.RoleName === in_roleName)
        .map(obj => obj.Arn)
        .find(() => true);

    if (!awsRoleArn) {
        if (!opts.hideWarnings) {
            cprint.yellow('Couldn\'t find AWS Role ARN for Role "' + in_roleName + '"');
        }
        return false;
    }

    awsCache[cacheKey] = {
        val: awsRoleArn,
        expires: date.getTimestamp() + cache.durations.week
    };

    return awsRoleArn;
}

// ******************************

function getRoleNameForRoleName (in_roleName, in_options) {
    let opts = in_options || {};

    let awsCache = opts.cache || {};
    let cacheKey = `RoleName_${opts.profile}_${opts.region}_${in_roleName}`;
    let cacheItem = awsCache[cacheKey];
    let cacheVal = (cacheItem || {}).val;
    if (cacheVal !== undefined) {
        return cacheVal;
    }

    if (opts.verbose) {
        cprint.cyan('Retrieving AWS Role Name for Role "' + in_roleName + '"...');
    }

    let awsRoleName = _getRoleArns(in_options)
        .filter(obj => opts.partialMatch ? _partialStrMatch(obj.RoleName, in_roleName) : obj.RoleName === in_roleName)
        .map(obj => obj.RoleName)
        .find(() => true);

    if (!awsRoleName) {
        if (!opts.hideWarnings) {
            cprint.yellow('Couldn\'t find AWS Role ARN for Role "' + in_roleName + '"');
        }
        return false;
    }

    awsCache[cacheKey] = {
        val: awsRoleName,
        expires: date.getTimestamp() + cache.durations.week
    };

    return awsRoleName;
}

// ******************************

function createRole (in_roleName, in_roleDescription, in_rolePolicyDocument, in_options) {
    cprint.cyan('Creating AWS Role "' + in_roleName + '"...');

    let cmdResult = awsCmd([
        'iam',
        'create-role',
        '--role-name', in_roleName,
        '--description', in_roleDescription,
        '--assume-role-policy-document', JSON.stringify(in_rolePolicyDocument)
    ], in_options);

    if (cmdResult.hasError) {
        cmdResult.throwError();
        return false;
    }

    cmdResult.printResult('  ');
    cprint.green('Created AWS Role "' + in_roleName + '"');
    return true;
}

// ******************************

function attachRolePolicy (in_roleName, in_rolePolicyArn, in_options) {
    cprint.cyan('Attaching AWS Role Policy to AWS Role "' + in_roleName + '"...');

    let cmdResult = awsCmd([
        'iam',
        'attach-role-policy',
        '--role-name', in_roleName,
        '--policy-arn', in_rolePolicyArn
    ], in_options);

    if (cmdResult.hasError) {
        cmdResult.throwError();
        return false;
    }

    cmdResult.printResult('  ');
    cprint.green('Attached AWS Role Policy to AWS Role "' + in_roleName + '"');
    return true;
}

// ******************************

function createInstanceProfile (in_instanceProfileName, in_options) {
    cprint.cyan('Creating AWS Instance Profile "' + in_instanceProfileName + '"...');

    let cmdResult = awsCmd([
        'iam',
        'create-instance-profile',
        '--instance-profile-name', in_instanceProfileName
    ], in_options);

    if (cmdResult.hasError) {
        cmdResult.throwError();
        return false;
    }

    cmdResult.printResult('  ');
    cprint.green('Created AWS Instance Profile "' + in_instanceProfileName + '"');
    return true;
}

// ******************************

function addRoleToInstanceProfile (in_instanceProfileName, in_roleName, in_options) {
    cprint.cyan('Adding AWS Role "' + in_roleName + '" to AWS Instance Profile "' + in_instanceProfileName + '"...');

    let cmdResult = awsCmd([
        'iam',
        'add-role-to-instance-profile',
        '--instance-profile-name', in_instanceProfileName,
        '--role-name', in_roleName
    ], in_options);

    if (cmdResult.hasError) {
        cmdResult.throwError();
        return false;
    }

    cmdResult.printResult('  ');
    cprint.green('Added AWS Role "' + in_roleName + '" to AWS Instance Profile "' + in_instanceProfileName + '"');
    return true;
}

// ******************************
// IAM User Functions:
// ******************************

function getMultiFactorAuthDevice (in_options) {
    let opts = in_options || {};

    let profile = opts.profile;
    let longTermProfile = opts.longTermProfile;
    let awsCredentials = opts.awsCredentials;

    let awsCache = opts.cache || {};
    let cacheKey = `MFADevice_${opts.profile}_${opts.region}`;
    if (awsCache[cacheKey] && awsCache[cacheKey].val !== undefined) {
        return awsCache[cacheKey].val;
    }

    // First try with long term profile if present
    if (awsCredentials[longTermProfile] && !_isProfileExpired(awsCredentials[longTermProfile]) && awsCredentials[longTermProfile].assumed_role) {
        return;
    }

    // Otherwise try with normal profile if present
    if (awsCredentials[profile] && !_isProfileExpired(awsCredentials[profile]) && awsCredentials[profile].assumed_role) {
        return;
    }

    let username = getUsername(in_options);
    if (!username) {
        return;
    }

    if (opts.verbose) {
        cprint.cyan(`Getting MFA device for ${username}...`);
    }

    // First try with long term profile if present
    let awsCmdResult = awsCmd([
        'iam',
        'list-mfa-devices',
        '--max-items', 1,
        '--user-name', username
    ], {
        hide: !opts.verbose,
        profile: longTermProfile,
        region: opts.region
    });

    // Otherwise try with normal profile if present
    if (awsCmdResult.hasError) {
        awsCmdResult = awsCmd([
            'iam',
            'list-mfa-devices',
            '--max-items', 1,
            '--user-name', username
        ], {
            hide: !opts.verbose,
            profile: profile,
            region: opts.region
        });
    }

    if (awsCmdResult.hasError) {
        return awsCmdResult.throwError();
    }

    let mfaDevice = false;

    let mfaDevicesResponse = JSON.parse(awsCmdResult.result);
    if (!mfaDevicesResponse || !mfaDevicesResponse.MFADevices || !mfaDevicesResponse.MFADevices.length) {
        mfaDevice = false;
    } else {
        mfaDevice = mfaDevicesResponse.MFADevices.shift();
    }

    awsCache[cacheKey] = {
        val: mfaDevice,
        expires: date.getTimestamp() + cache.durations.week
    };

    return mfaDevice;
}

// ******************************

function getUsername (in_options) {
    let opts = in_options || {};

    let profile = opts.profile;
    let longTermProfile = opts.longTermProfile;

    let awsCache = opts.cache || {};
    let cacheKey = `Username_${opts.profile}_${opts.region}`;
    if (awsCache[cacheKey] && awsCache[cacheKey].val !== undefined) {
        return awsCache[cacheKey].val;
    }

    if (opts.verbose) {
        cprint.cyan('Getting AWS username...');
    }

    // First try with long term profile if present
    let awsCmdResult = awsCmd([
        'iam',
        'list-access-keys',
        '--max-items', 1
    ], {
        hide: !opts.verbose,
        profile: longTermProfile,
        region: opts.region
    });

    // Otherwise try with normal profile if present
    if (awsCmdResult.hasError) {
        awsCmdResult = awsCmd([
            'iam',
            'list-access-keys',
            '--max-items', 1
        ], {
            hide: !opts.verbose,
            profile: profile,
            region: opts.region
        });
    }

    if (awsCmdResult.hasError) {
        return awsCmdResult.throwError();
    }

    let accessKeysResponse = JSON.parse(awsCmdResult.result);
    if (!accessKeysResponse || !accessKeysResponse.AccessKeyMetadata) {
        return;
    }

    let firstAccessKeyMetadata = accessKeysResponse.AccessKeyMetadata.shift();
    let username = firstAccessKeyMetadata.UserName;

    awsCache[cacheKey] = {
        val: username,
        expires: date.getTimestamp() + cache.durations.week
    };

    return username;
}

// ******************************

function getUserArnForUsername (in_username, in_options) {
    let opts = in_options || {};

    let awsCache = opts.cache || {};
    let cacheKey = `UserArn_${opts.profile}_${opts.region}_${in_username}`;
    let cacheItem = awsCache[cacheKey];
    let cacheVal = (cacheItem || {}).val;
    if (cacheVal !== undefined) {
        return cacheVal;
    }

    if (opts.verbose) {
        cprint.cyan('Retrieving AWS User ARN for Username "' + in_username + '"...');
    }

    let cmdResult = awsCmd([
        'iam',
        'list-users'
    ], {
        hide: !opts.verbose,
        profile: opts.profile,
        region: opts.region
    });

    if (cmdResult.hasError) {
        cmdResult.throwError();
        return false;
    }

    let awsUserArn;
    let awsResult = parseAwsCmdResult(cmdResult);
    if (awsResult && awsResult.Users) {
        awsUserArn = awsResult.Users
            .sort()
            .reverse()
            .find(obj => obj.UserName === in_username);
    }

    if (!awsUserArn) {
        if (!opts.hideWarnings) {
            cprint.yellow('Couldn\'t find AWS User ARN for Username "' + in_username + '"');
        }
        return false;
    }

    awsCache[cacheKey] = {
        val: awsUserArn,
        expires: date.getTimestamp() + cache.durations.week
    };

    return awsUserArn;
}

// ******************************

function createUser (in_username, in_options) {
    cprint.cyan('Creating AWS User "' + in_username + '"...');

    let cmdResult = awsCmd([
        'iam',
        'create-user',
        '--user-name', in_username
    ], in_options);

    if (cmdResult.hasError) {
        cmdResult.throwError();
        return false;
    }

    cmdResult.printResult('  ');
    cprint.green('Created AWS User "' + in_username + '"');
    return true;
}

// ******************************

function createUserAccessKey (in_username, in_options) {
    cprint.cyan('Creating AWS User Access Key for AWS User "' + in_username + '"...');

    let cmdResult = awsCmd([
        'iam',
        'create-access-key',
        '--user-name', in_username
    ], in_options);

    if (cmdResult.hasError) {
        cmdResult.throwError();
        return false;
    }

    let bucketUserAccessKeyResults = cmdResult.resultObj;
    if (!bucketUserAccessKeyResults.AccessKey) {
        cmdResult.printResult('  ');
        throw new Error('Failed to parse bucket user access-key response');
    }

    let userObject = {
        AccessKey: bucketUserAccessKeyResults.AccessKey.AccessKeyId,
        SecretKey: bucketUserAccessKeyResults.AccessKey.SecretAccessKey,
    };

    cmdResult.printResult('  ');
    cprint.green('Created AWS User Access Key for AWS User "' + in_username + '"');
    return userObject;
}

// ******************************

function attachInlinePolicyToUser (in_username, in_inlinePolicyName, in_inlinePolicy, in_options) {
    cprint.cyan('Attaching Inline Policy To AWS User "' + in_username + '"...');

    let cmdResult = awsCmd([
        'iam',
        'put-user-policy',

        '--user-name',
        in_username,

        '--policy-name',
        in_inlinePolicyName,

        '--policy-document',
        JSON.stringify(in_inlinePolicy)
    ], in_options);

    if (cmdResult.hasError) {
        cmdResult.throwError();
        return false;
    }

    cmdResult.printResult('  ');
    cprint.green('Attached Inline Policy To AWS User "' + in_username + '"');
    return true;
}

// ******************************
// STS Functions:
// ******************************

function getSessionToken (in_profile, in_options) {
    let opts = in_options || {};
    const MAX_TOKEN_PERIOD_IN_SECONDS = 129600; // 36 Hours

    if (opts.verbose) {
        cprint.cyan('Getting session token...');
    }

    let tokenCode = readline.sync(`Please enter the current MFA token for account (#${opts.accountId})`);

    let awsCmdResult = awsCmd([
        'sts',
        'get-session-token',
        '--duration-seconds', MAX_TOKEN_PERIOD_IN_SECONDS,
        '--serial-number', opts.serialNumber,
        '--token-code', tokenCode
    ], {
        hide: !opts.verbose,
        profile: in_profile,
        region: opts.region
    });

    if (awsCmdResult.hasError) {
        return awsCmdResult.throwError();
    }

    let awsSessionToken = JSON.parse(awsCmdResult.result);
    if (awsSessionToken && awsSessionToken.Credentials) {
        return awsSessionToken.Credentials;
    }
}

// ******************************
// S3 Functions:
// ******************************

function getBucketPathForBucketName (in_bucketName, in_options) {
    let opts = in_options || {};

    let awsCache = opts.cache || {};
    let cacheKey = `BucketPath_${opts.profile}_${opts.region}_${in_bucketName}`;
    let cacheItem = awsCache[cacheKey];
    let cacheVal = (cacheItem || {}).val;
    if (cacheVal !== undefined) {
        return cacheVal;
    }

    if (opts.verbose) {
        cprint.cyan('Retrieving Bucket Path for Bucket "' + in_bucketName + '"...');
    }

    let awsBucketPath = _getBucketPaths(in_options)
        .filter(obj => obj.bucketName === in_bucketName)
        .map(obj => obj.bucketPath)
        .find(() => true);

    if (!awsBucketPath) {
        if (!opts.hideWarnings) {
            cprint.yellow('Couldn\'t find Bucket Path for Bucket "' + in_bucketName + '"');
        }
        return false;
    }

    awsCache[cacheKey] = {
        val: awsBucketPath,
        expires: date.getTimestamp() + cache.durations.week
    };

    return awsBucketPath;
}

// ******************************

function getBucketNameForBucketName (in_bucketName, in_options) {
    let opts = in_options || {};

    let awsCache = opts.cache || {};
    let cacheKey = `BucketName_${opts.profile}_${opts.region}_${in_bucketName}`;
    let cacheItem = awsCache[cacheKey];
    let cacheVal = (cacheItem || {}).val;
    if (cacheVal !== undefined) {
        return cacheVal;
    }

    if (opts.verbose) {
        cprint.cyan('Retrieving Bucket Name for Bucket "' + in_bucketName + '"...');
    }

    let awsBucketName = _getBucketPaths(in_options)
        .filter(obj => opts.partialMatch ? _partialStrMatch(obj.bucketName, in_bucketName) : obj.bucketName === in_bucketName)
        .map(obj => obj.bucketPath.replace(/s3:\/\//, ''))
        .find(() => true);

    if (!awsBucketName) {
        if (!opts.hideWarnings) {
            cprint.yellow('Couldn\'t find Bucket Name for Bucket "' + in_bucketName + '"');
        }
        return false;
    }

    awsCache[cacheKey] = {
        val: awsBucketName,
        expires: date.getTimestamp() + cache.durations.week
    };

    return awsBucketName;
}

// ******************************

function createBucket (in_bucketName, in_options) {
    cprint.cyan('Creating AWS Bucket "' + in_bucketName + '"...');

    let bucketPath = 's3://' + in_bucketName;

    let cmdResult = awsCmd([
        's3',
        'mb', bucketPath
    ], in_options);

    if (cmdResult.hasError) {
        cmdResult.throwError();
        return false;
    }

    cmdResult.printResult('  ');
    cprint.green('Created AWS Bucket "' + in_bucketName + '"');
    return true;
}

// ******************************
// VPC Functions:
// ******************************

function getVpcIdForVpc (in_vpcName, in_options) {
    let opts = in_options || {};

    let awsCache = opts.cache || {};
    let cacheKey = `VpcId_${opts.profile}_${opts.region}_${in_vpcName}`;
    let cacheItem = awsCache[cacheKey];
    let cacheVal = (cacheItem || {}).val;
    if (cacheVal !== undefined) {
        return cacheVal;
    }

    if (opts.verbose) {
        cprint.cyan('Retrieving AWS VPC ID for AWS VPC "' + in_vpcName + '"...');
    }

    let cmdResult = awsCmd([
        'ec2',
        'describe-vpcs',
        '--filter'
    ], {
        hide: !opts.verbose,
        profile: opts.profile,
        region: opts.region
    });

    if (cmdResult.hasError) {
        cmdResult.throwError();
        return false;
    }

    let awsVpcId;
    let firstVpc;
    let awsResult = parseAwsCmdResult(cmdResult);
    if (awsResult && awsResult.Vpcs) {
        awsVpcId = awsResult.Vpcs
            .sort()
            .reverse()
            .filter(obj => (obj.Tags || [])
                .find(tag => tag.Key === 'Name' && tag.Value === in_vpcName)
            )
            .map(obj => obj.VpcId)
            .find(() => true);

        firstVpc = awsResult.Vpcs
            .map(obj => obj.Tags || [])
            .reduce((a, b) => b.concat(a), [])
            .filter(tag => tag.Key === 'Name')
            .map(tag => tag.Value)
            .find(() => true);
    }

    if (!awsVpcId) {
        if (!opts.hideWarnings) {
            cprint.yellow('Couldn\'t find AWS VPC ID for AWS VPC "' + in_vpcName + '"');
            if (firstVpc) {
                cprint.yellow('  Did you mean "' + firstVpc + '"?');
            }
        }
        return false;
    }

    awsCache[cacheKey] = {
        val: awsVpcId,
        expires: date.getTimestamp() + cache.durations.week
    };

    return awsVpcId;
}

// ******************************

function getDefaultVpcSecurityGroupIdForVpc (in_vpcId, in_options) {
    let opts = in_options || {};

    let awsCache = opts.cache || {};
    let cacheKey = `VpcDefaultSecurityGroupId_${opts.profile}_${opts.region}_${in_vpcId}`;
    let cacheItem = awsCache[cacheKey];
    let cacheVal = (cacheItem || {}).val;
    if (cacheVal !== undefined) {
        return cacheVal;
    }

    if (opts.verbose) {
        cprint.cyan('Retrieving Default AWS Security Group Id for AWS VPC Id "' + in_vpcId + '"...');
    }

    let cmdResult = awsCmd([
        'ec2',
        'describe-security-groups',
        '--filters',
        `Name=vpc-id,Values="${in_vpcId}"`,
        'Name=group-name,Values="default"'
    ], {
        hide: !opts.verbose,
        profile: opts.profile,
        region: opts.region
    });

    if (cmdResult.hasError) {
        cmdResult.throwError();
        return false;
    }

    let awsDefaultVpcSecurityGroupId;
    let awsResult = parseAwsCmdResult(cmdResult);
    if (awsResult && awsResult.SecurityGroups) {
        awsDefaultVpcSecurityGroupId = awsResult.SecurityGroups
            .sort()
            .reverse()
            .map(obj => obj.GroupId)
            .find(() => true);
    }

    if (!awsDefaultVpcSecurityGroupId) {
        if (!opts.hideWarnings) {
            cprint.yellow('Couldn\'t find Default AWS Security Group Id for AWS VPC Id "' + in_vpcId + '"');
        }
        return false;
    }

    awsCache[cacheKey] = {
        val: awsDefaultVpcSecurityGroupId,
        expires: date.getTimestamp() + cache.durations.week
    };

    return awsDefaultVpcSecurityGroupId;
}

// ******************************

function getVpcSecurityGroupIdFromGroupName (in_vpcId, in_groupName, in_options) {
    let opts = in_options || {};

    let awsCache = opts.cache || {};
    let cacheKey = `VpcSecurityGroupId_${opts.profile}_${opts.region}_${in_vpcId}` + `_${in_groupName}`;
    let cacheItem = awsCache[cacheKey];
    let cacheVal = (cacheItem || {}).val;
    if (cacheVal !== undefined) {
        return cacheVal;
    }

    if (opts.verbose) {
        cprint.cyan('Retrieving AWS Security Group Id for AWS VPC Id "' + in_vpcId + '" from name "' + in_groupName + '"...');
    }

    let cmdResult = awsCmd([
        'ec2',
        'describe-security-groups',
        '--filters',
        `Name=vpc-id,Values="${in_vpcId}"`
    ], {
        hide: !opts.verbose,
        profile: opts.profile,
        region: opts.region
    });

    if (cmdResult.hasError) {
        cmdResult.throwError();
        return false;
    }

    let awsVpcSecurityGroupId;
    let awsResult = parseAwsCmdResult(cmdResult);
    if (awsResult && awsResult.SecurityGroups) {
        awsVpcSecurityGroupId = awsResult.SecurityGroups
            .filter(obj => obj.GroupName === in_groupName)
            .map(obj => obj.GroupId)
            .find(() => true);
    }

    if (!awsVpcSecurityGroupId) {
        if (!opts.hideWarnings) {
            cprint.yellow('Couldn\'t find AWS Security Group Id for AWS VPC Id "' + in_vpcId + '"" from name "' + in_groupName + '"');
        }
        return false;
    }

    awsCache[cacheKey] = {
        val: awsVpcSecurityGroupId,
        expires: date.getTimestamp() + cache.durations.week
    };

    return awsVpcSecurityGroupId;
}

// ******************************

function getVpcSubnetIdForVpc (in_vpcId, in_vpcSubnetName, in_options) {
    let opts = in_options || {};

    let awsCache = opts.cache || {};
    let cacheKey = `VpcSubnetId_${opts.profile}_${opts.region}_${in_vpcSubnetName}`;
    let cacheItem = awsCache[cacheKey];
    let cacheVal = (cacheItem || {}).val;
    if (cacheVal !== undefined) {
        return cacheVal;
    }

    if (opts.verbose) {
        cprint.cyan('Retrieving AWS VPC Subnet Id for AWS VPC Subnet "' + in_vpcSubnetName + '"...');
    }

    let cmdResult = awsCmd([
        'ec2',
        'describe-subnets',
        '--filters',
        `Name=vpc-id,Values="${in_vpcId}"`
    ], {
        hide: !opts.verbose,
        profile: opts.profile,
        region: opts.region
    });

    if (cmdResult.hasError) {
        cmdResult.throwError();
        return false;
    }

    let awsVpcSubnetId;
    let firstVpcSubnet;

    let awsResult = parseAwsCmdResult(cmdResult);
    if (awsResult && awsResult.Subnets) {
        awsVpcSubnetId = awsResult.Subnets
            .sort()
            .reverse()
            .filter(obj => (obj.Tags || [])
                .find(tag => tag.Key === 'Name' && tag.Value === in_vpcSubnetName)
            )
            .map(obj => obj.SubnetId)
            .find(() => true);

        firstVpcSubnet = awsResult.Subnets
            .map(obj => obj.Tags || [])
            .reduce((a, b) => b.concat(a), [])
            .filter(tag => tag.Key === 'Name')
            .map(tag => tag.Value)
            .find(() => true);
    }

    if (!awsVpcSubnetId) {
        if (!opts.hideWarnings) {
            cprint.yellow('Couldn\'t find AWS VPC Subnet Id for AWS VPC Subnet "' + in_vpcSubnetName + '"');
            if (firstVpcSubnet) {
                cprint.yellow('  Did you mean "' + firstVpcSubnet + '"?');
            }
        }
        return false;
    }

    awsCache[cacheKey] = {
        val: awsVpcSubnetId,
        expires: date.getTimestamp() + cache.durations.week
    };

    return awsVpcSubnetId;
}

// ******************************
// Instance Functions:
// ******************************

function getInstanceIdsWithTags (in_tags, in_options) {
    let opts = in_options || {};

    let tags = in_tags || [];
    let tagsStr = JSON.stringify(tags);

    let awsCache = opts.cache || {};
    let cacheKey = `InstanceIds_${opts.profile}_${opts.region}_${tagsStr}`;
    let cacheItem = awsCache[cacheKey];
    let cacheVal = (cacheItem || {}).val;
    if (cacheVal !== undefined) {
        return cacheVal;
    }

    if (opts.verbose) {
        cprint.cyan('Retrieving AWS Instance IDs for tags [' + tagsStr + ']...');
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
        hide: !opts.verbose,
        profile: opts.profile,
        region: opts.region
    });

    if (cmdResult.hasError) {
        cmdResult.throwError();
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
        if (!opts.hideWarnings) {
            cprint.yellow('Couldn\'t find AWS Instance IDs for tags [' + tagsStr + ']');
        }
        return false;
    }

    awsCache[cacheKey] = {
        val: awsInstanceIds,
        expires: date.getTimestamp() + cache.durations.tenMinutes
    };

    return awsInstanceIds;
}

// ******************************
// Config Functions:
// ******************************

function getServiceConfig (in_serviceConfig, in_environment) {
    let serviceConfig = service.accessConfig(in_serviceConfig, {
        service: {
            clusters: [
                {
                    aws: {
                        account_id: 'STRING',
                        profile: 'STRING',
                        assume_role: 'STRING',
                        federated_login: {
                            type: 'STRING',
                            role_arn: 'STRING',
                            principal_arn: 'STRING',
                            session_url: 'STRING',
                            session_headers: [
                                {
                                    header: 'STRING',
                                    value: 'STRING'
                                }
                            ],
                            policy_url: 'STRING',
                            otka_org_url: 'STRING',
                            okta_aws_app_url: 'STRING',
                            username_prompt_text: 'STRING',
                            password_prompt_text: 'STRING'
                        }
                    },
                    default: 'BOOLEAN',
                    environment: 'STRING'
                }
            ]
        },
        cwd: 'STRING'
    });

    let path = require('path');

    let homeFolder = env.getShellHome();
    if (!homeFolder || !fs.folderExists(homeFolder)) {
        throw new Error('Home folder doesn\'t exist');
    }

    let cluster = getEnvironmentCluster(serviceConfig.service.clusters, in_environment);
    if (!cluster) {
        // Nothing to do if no clusters are defined
        return serviceConfig;
    }

    if (!(cluster.aws.profile || cluster.aws.account_id || cluster.aws.federated_login)) {
        // Nothing to do if no aws section in cluster
        return serviceConfig;
    }

    if (!awsInstalled()) {
        throw new Error('AWS-CLI isn\'t installed');
    }

    let profile = cluster.aws.profile || 'default';
    profile = profile.replace(/-long-term$/,''); // Remove postfixed -long-term if present
    profile = profile.replace(/-as-.*$/,''); // Remove postfixed -as-.... if present

    let longTermProfile = profile + '-long-term';

    cluster.aws.profile = profile;

    let assumeRoleArn = cluster.aws.assume_role || '';

    let awsConfigFile = path.resolve(homeFolder, '.aws', 'config');
    let awsConfig = ini.parseFile(awsConfigFile);

    let awsCredentialsFile = path.resolve(homeFolder, '.aws', 'credentials');
    let awsCredentials = ini.parseFile(awsCredentialsFile) || {};

    let awsCache = cache.load(in_serviceConfig.cwd, 'aws') || {};

    let reloadConfigFiles = false;

    if (cluster.aws.federated_login.type || cluster.aws.federated_login.role_arn || cluster.aws.federated_login.principal_arn) {
        let federatedLoginType = cluster.aws.federated_login.type || 'SSO';

        let federatedLoginRoleArn = cluster.aws.federated_login.role_arn || '';
        if (!federatedLoginRoleArn) {
            throw new Error('Federated login not correctly configured - Missing Role ARN');
        }

        let federatedLoginPrincipalArn = cluster.aws.federated_login.principal_arn || '';
        if (!federatedLoginPrincipalArn) {
            throw new Error('Federated login not correctly configured - Missing Principal ARN');
        }

        if (federatedLoginType === 'SSO') {
            let federatedLoginPolicyUrl = cluster.aws.federated_login.policy_url || '';
            if (!federatedLoginPolicyUrl) {
                throw new Error('SSO federated login not correctly configured - Missing policy URL');
            }

            let configured = configureProfileAsRoleWithSaml({
                type: federatedLoginType,
                principalArn: federatedLoginPrincipalArn,
                roleArn: federatedLoginRoleArn,
                policyUrl: federatedLoginPolicyUrl,
                sessionUrl: cluster.aws.federated_login.session_url,
                sessionHeaders: cluster.aws.federated_login.session_headers,
                usernamePromptText: cluster.aws.federated_login.username_prompt_text || '',
                passwordPromptText: cluster.aws.federated_login.password_prompt_text || '',
                credentialsFile: awsCredentialsFile,
                cache: awsCache,
                showWarning: true,
                verbose: true
            });

            if (configured) {
                reloadConfigFiles = true;
            }
        } else if (federatedLoginType === 'Okta') {
            let federatedLoginOktaOrgUrl = cluster.aws.federated_login.otka_org_url || '';
            if (!federatedLoginOktaOrgUrl) {
                throw new Error('Okta federated login not correctly configured - Missing Okta Org URL');
            }

            let federatedLoginOktaAwsAppUrl = cluster.aws.federated_login.okta_aws_app_url || '';
            if (!federatedLoginOktaAwsAppUrl) {
                throw new Error('Okta federated login not correctly configured - Missing Okta Aws App URL');
            }

            let configured = configureProfileAsRoleWithSaml({
                type: federatedLoginType,
                principalArn: federatedLoginPrincipalArn,
                roleArn: federatedLoginRoleArn,
                oktaOrgUrl: federatedLoginOktaOrgUrl,
                oktaAwsAppUrl: federatedLoginOktaAwsAppUrl,
                usernamePromptText: cluster.aws.federated_login.username_prompt_text || '',
                passwordPromptText: cluster.aws.federated_login.password_prompt_text || '',
                credentialsFile: awsCredentialsFile,
                cache: awsCache,
                showWarning: true,
                verbose: true
            });

            if (configured) {
                reloadConfigFiles = true;
            }
        } else {
            throw new Error(`Federated login not correctly configured - Unknown type: ${federatedLoginType}`);
        }

        profile = federatedLoginRoleArn;
        cluster.aws.profile = federatedLoginRoleArn;

        if (assumeRoleArn) {
            let profileAsRole = profile + '-as-' + assumeRoleArn;

            let configured = configureProfileAsRole({
                profile: profile,
                profileAsRole: profileAsRole,
                assumeRoleArn: assumeRoleArn,
                accountId: cluster.aws.account_id,
                credentialsFile: awsCredentialsFile,
                verbose: true
            });

            if (configured) {
                reloadConfigFiles = true;
            }

            // Set the profile to the profileAsRole since we'll use those credentials now
            profile = profileAsRole;
            cluster.aws.profile = profileAsRole;
        }
    } else {
        let mfaDevice = getMultiFactorAuthDevice({
            profile: profile,
            longTermProfile: longTermProfile,
            awsCredentials: awsCredentials,
            cache: awsCache,
            verbose: true
        });

        if(mfaDevice && mfaDevice.SerialNumber) {
            let configured = configureMultiFactorAuth({
                serialNumber: mfaDevice.SerialNumber,
                profile: profile,
                accountId: cluster.aws.account_id,
                longTermProfile: longTermProfile,
                credentialsFile: awsCredentialsFile,
                verbose: true
            });

            if (configured) {
                reloadConfigFiles = true;
            }
        }

        if (assumeRoleArn) {
            let profileAsRole = profile + '-as-' + assumeRoleArn;

            let configured = configureProfileAsRole({
                profile: profile,
                profileAsRole: profileAsRole,
                assumeRoleArn: assumeRoleArn,
                accountId: cluster.aws.account_id,
                credentialsFile: awsCredentialsFile,
                verbose: true
            });

            // Set the profile to the profileAsRole since we'll use those credentials now
            profile = profileAsRole;
            cluster.aws.profile = profile;

            if (configured) {
                reloadConfigFiles = true;
            }
        }
    }

    if (service.hasConfigFile(in_serviceConfig.cwd)) {
        cache.save(in_serviceConfig.cwd, 'aws', awsCache);
    }

    if (reloadConfigFiles) {
        //Reload the ini files as they may have changed off the back of configuration
        awsConfig = ini.parseFile(awsConfigFile);
        awsCredentials = ini.parseFile(awsCredentialsFile) || {};
    }

    if (awsConfig[profile]) {
        cluster.aws.region = awsConfig[profile].region || cluster.aws.region;
    }

    if (awsCredentials[profile]) {
        cluster.aws.access_key = awsCredentials[profile].aws_access_key_id || cluster.aws.access_key;
        cluster.aws.secret_key = awsCredentials[profile].aws_secret_access_key || cluster.aws.secret_key;
        cluster.aws.account_id = awsCredentials[profile].account_id || cluster.aws.account_id;
    }

    service.checkConfigSchema(serviceConfig);
    return serviceConfig;
}

// ******************************

function configureMultiFactorAuth (in_options) {
    let opts = in_options || {};

    let profile = opts.profile;
    let longTermProfile = opts.longTermProfile;

    let awsCredentials =  ini.parseFile(opts.credentialsFile);

    if(!awsCredentials[longTermProfile] && !awsCredentials[profile]) {
        throw new Error(`Neither ${longTermProfile} nor ${profile} credentials exist. You need to configure these in ~/.aws/credentails!`);
    }

    if (!awsCredentials[longTermProfile]) {
        // If profile exists but long term profile doesn't, then assume the credentials
        // file isn't set up with the mfa flow yet, so:
        // 1. Copy profile into long-term profile
        // 2. Remove profile (so that we get a new session)
        awsCredentials[longTermProfile] = awsCredentials[profile];
        delete awsCredentials[profile];
        ini.writeFile(opts.credentialsFile, awsCredentials);
        // 3. Continue...
    }

    if(!awsCredentials[longTermProfile].aws_mfa_device) {
        awsCredentials[longTermProfile].aws_mfa_device = opts.serialNumber;
    }

    let isSessionRefreshRequired = false;

    if (!awsCredentials[profile]) {
        isSessionRefreshRequired = true;
    }
    else if (awsCredentials[profile]) {
        isSessionRefreshRequired = _isProfileExpired(awsCredentials[profile]);
    }

    if (!isSessionRefreshRequired) {
        return;
    }

    let sessionToken = getSessionToken(longTermProfile, opts);
    if (!sessionToken) {
        return;
    }

    awsCredentials[profile] = {};
    awsCredentials[profile].assumed_role = 'False';
    awsCredentials[profile].account_id = opts.accountId;
    awsCredentials[profile].aws_access_key_id = sessionToken.AccessKeyId;
    awsCredentials[profile].aws_secret_access_key = sessionToken.SecretAccessKey;
    awsCredentials[profile].aws_session_token = sessionToken.SessionToken;
    awsCredentials[profile].aws_security_token = sessionToken.SessionToken;
    awsCredentials[profile].expiration = _formatSessionExpiration(sessionToken.Expiration);
    ini.writeFile(opts.credentialsFile, awsCredentials);

    return true;
}

// ******************************

function configureProfileAsRole (in_options) {
    let opts = in_options || {};

    let profile = opts.profile;
    let profileAsRole = opts.profileAsRole;
    let assumeRoleArn = opts.assumeRoleArn;

    let awsCredentials =  ini.parseFile(opts.credentialsFile);

    if(!awsCredentials[profile]) {
        throw new Error(`${profile} credentials don't exist. You need to configure these in ~/.aws/credentails!`);
    }

    if (!assumeRoleArn) {
        throw new Error('No role to assume!');
    }

    let isRoleAssumptionRequired = false;

    if (!awsCredentials[profileAsRole]) {
        isRoleAssumptionRequired = true;
    }
    else if (_isProfileExpired(awsCredentials[profileAsRole])) {
        isRoleAssumptionRequired = true;
    }

    if (!isRoleAssumptionRequired) {
        return;
    }

    let roleCredentials = getRoleCredentials(assumeRoleArn, in_options);
    if (!roleCredentials) {
        return;
    }

    awsCredentials[profileAsRole] = {};
    awsCredentials[profileAsRole].assumed_role = 'True';
    awsCredentials[profileAsRole].assumed_role_arn = assumeRoleArn;
    awsCredentials[profileAsRole].account_id = awsArnToAccountId(assumeRoleArn);
    awsCredentials[profileAsRole].aws_access_key_id = roleCredentials.AccessKeyId;
    awsCredentials[profileAsRole].aws_secret_access_key = roleCredentials.SecretAccessKey;
    awsCredentials[profileAsRole].aws_session_token = roleCredentials.SessionToken;
    awsCredentials[profileAsRole].aws_security_token = roleCredentials.SessionToken;
    awsCredentials[profileAsRole].expiration = _formatSessionExpiration(roleCredentials.Expiration);
    ini.writeFile(opts.credentialsFile, awsCredentials);
    return true;
}

// ******************************

function configureProfileAsRoleWithSaml (in_options) {
    let opts = in_options || {};

    let roleArn = opts.roleArn;
    let awsCredentials = ini.parseFile(opts.credentialsFile) || {};
    let roleCredentials = getRoleSamlCredentials(in_options);
    if (!roleCredentials) {
        return;
    }

    let profileAsRole = roleArn;
    awsCredentials[profileAsRole] = {};
    awsCredentials[profileAsRole].assumed_role = 'True';
    awsCredentials[profileAsRole].assumed_role_arn = roleArn;
    awsCredentials[profileAsRole].account_id = awsArnToAccountId(roleArn);
    awsCredentials[profileAsRole].aws_access_key_id = roleCredentials.AccessKeyId;
    awsCredentials[profileAsRole].aws_secret_access_key = roleCredentials.SecretAccessKey;
    awsCredentials[profileAsRole].aws_session_token = roleCredentials.SessionToken;
    awsCredentials[profileAsRole].aws_security_token = roleCredentials.SessionToken;
    awsCredentials[profileAsRole].expiration = _formatSessionExpiration(roleCredentials.Expiration);
    ini.writeFile(opts.credentialsFile, awsCredentials);
    return true;
}

// ******************************

function getMergedAwsServiceConfig (in_serviceConfig, in_environment) {
    let serviceConfig = in_serviceConfig || {};
    let awsServiceConfig = getServiceConfig(in_serviceConfig, in_environment);
    if (!awsServiceConfig) {
        throw new Error('AWS service config isn\'t set!');
    }
    return service.combineConfig(awsServiceConfig, serviceConfig);
}

// ******************************

function getDockerRepositoryUrl (in_serviceConfig, in_environment) {
    let serviceConfig = service.accessConfig(getMergedAwsServiceConfig(in_serviceConfig, in_environment), {
        service: {
            clusters: [
                {
                    aws: {
                        account_id: 'STRING',
                        region: 'STRING'
                    },
                    default: 'BOOLEAN',
                    environment: 'STRING'
                }
            ]
        }
    });

    let cluster = getEnvironmentCluster(serviceConfig.service.clusters, in_environment);
    if (!cluster) {
        if (in_environment) {
            throw new Error('No cluster set for "' + in_environment + '" environment');
        } else {
            throw new Error('No default environment defined');
        }
    }

    if (!cluster.aws.account_id) {
        throw new Error('AWS account id not set');
    }

    return cluster.aws.account_id + '.dkr.ecr.' + (cluster.aws.region || 'ap-southeast-2') + '.amazonaws.com';
}

// ******************************

function getDockerCredentials (in_serviceConfig, in_options) {
    let opts = in_options || {};
    let environment = opts.environment;

    let serviceConfig = service.accessConfig(getMergedAwsServiceConfig(in_serviceConfig, environment), {
        service: {
            clusters: [
                {
                    aws: {
                        profile: 'STRING',
                        region: 'STRING'
                    },
                    default: 'BOOLEAN',
                    environment: 'STRING'
                }
            ]
        }
    });

    if (!awsInstalled()) {
        throw new Error('AWS-CLI isn\'t installed');
    }

    let cluster = getEnvironmentCluster(serviceConfig.service.clusters, environment);
    if (!cluster) {
        if (environment) {
            throw new Error('No cluster set for "' + environment + '" environment');
        } else {
            throw new Error('No default environment defined');
        }
    }

    let awsCmdResult = awsCmd(['ecr', 'get-login'], {
        hide: !opts.verbose,
        profile: cluster.aws.profile,
        region: cluster.aws.region
    });

    if (awsCmdResult.hasError) {
        cprint.red('\nCheck your ~/.aws/credentials file...');
        awsCmdResult.throwError();
        return false;
    }

    let response = awsCmdResult.result;
    let responseRegExp = new RegExp('docker login -u (AWS) -p ([\\S]+) -e (.*?) (https?://.*)');
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

function getSecretKey (in_serviceConfig, in_environment) {
    let serviceConfig = service.accessConfig(getMergedAwsServiceConfig(in_serviceConfig, in_environment), {
        service: {
            clusters: [
                {
                    aws: {
                        access_key: 'STRING',
                        secret_key: 'STRING'
                    },
                    default: 'BOOLEAN',
                    environment: 'STRING'
                }
            ]
        }
    });

    let cluster = getEnvironmentCluster(serviceConfig.service.clusters, in_environment);
    if (!cluster) {
        if (in_environment) {
            throw new Error('No cluster set for "' + in_environment + '" environment');
        } else {
            throw new Error('No default environment defined');
        }
    }

    let awsSecretKey = cluster.aws.secret_key;

    if (!awsSecretKey) {
        if (cluster.aws.access_key) {
            awsSecretKey = env.getStoredSecretKey('aws', cluster.access_key);
        }
    }

    if (!awsSecretKey) {
        awsSecretKey = env.getStoredSecretKey('aws', '');
    }

    return awsSecretKey;
}

// ******************************

function getDockerImageName (in_serviceConfig, in_cluster) {
    let serviceConfig = service.accessConfig(in_serviceConfig, {
        cwd: 'STRING',
        docker: {
            image: {
                name: 'STRING'
            }
        }
    });

    let awsDockerImageName = undefined;
    if (!awsDockerImageName && in_cluster) {
        awsDockerImageName = in_cluster.aws.image.name;
    }

    if (!awsDockerImageName) {
        awsDockerImageName = serviceConfig.docker.image.name;
    }

    if (!awsDockerImageName) {
        return false;
    }

    awsDockerImageName = service.replaceConfigReferences(in_serviceConfig, awsDockerImageName);
    return awsDockerImageName;
}

// ******************************

function getServiceRole (in_serviceConfig, in_options) {
    let opts = in_options || {};
    let cluster = opts.cluster || {};
    let awsCache = opts.cache || {};

    let serviceRole = cluster.aws.service_role;
    serviceRole = service.replaceConfigReferences(in_serviceConfig, serviceRole);

    if (serviceRole.match(/.*-\*/)) {
        serviceRole = getRoleNameForRoleName(serviceRole.replace(/\*/,''), {
            cache: awsCache,
            profile: cluster.aws.profile,
            region: cluster.aws.region,
            partialMatch: true,
            verbose: opts.verbose
        });
    }
    return serviceRole;
}

// ******************************

function getAwsBucketName (in_serviceConfig, in_options) {
    let opts = in_options || {};
    let cluster = opts.cluster || {};
    let awsCache = opts.cache || {};

    let bucketName = cluster.aws.bucket.name;
    bucketName = service.replaceConfigReferences(in_serviceConfig, bucketName);

    if (bucketName.match(/.*-\*/)) {
        bucketName = getBucketNameForBucketName(bucketName.replace(/\*/,''), {
            cache: awsCache,
            profile: cluster.aws.profile,
            region: cluster.aws.region,
            partialMatch: true,
            verbose: true
        });
    }
    return bucketName;
}

// ******************************

function getAwsAutoScalingGroupName (in_serviceConfig, in_options) {
    let opts = in_options || {};
    let cluster = opts.cluster || {};
    let awsCache = opts.cache || {};

    let autoScalingGroupName = cluster.auto_scaling_group.name;
    autoScalingGroupName = service.replaceConfigReferences(in_serviceConfig, autoScalingGroupName);

    if (autoScalingGroupName.match(/.*-\*/)) {
        let autoScalingGroup = _getAutoScalingGroupForAutoScalingGroupName(autoScalingGroupName.replace(/\*/,''), {
            cache: awsCache,
            profile: cluster.aws.profile,
            region: cluster.aws.region,
            partialMatch: true,
            verbose: true
        });
        if (!autoScalingGroup) {
            return;
        }

        autoScalingGroupName = autoScalingGroup.AutoScalingGroupName;
    }
    return autoScalingGroupName;
}

// ******************************

function getAwsClusterName(in_serviceConfig, in_options) {
    let opts = in_options || {};
    let cluster = opts.cluster || {};

    let clusterName = cluster.name;
    clusterName = service.replaceConfigReferences(in_serviceConfig, clusterName);
    return clusterName;
}

// ******************************

function getAwsClusterServiceName(in_serviceConfig, in_options) {
    let opts = in_options || {};
    let cluster = opts.cluster || {};

    let clusterServiceName = cluster.service_name;
    clusterServiceName = service.replaceConfigReferences(in_serviceConfig, clusterServiceName);
    return clusterServiceName;
}

// ******************************

function getAwsTaskDefinitionName(in_serviceConfig, in_options) {
    let opts = in_options || {};
    let cluster = opts.cluster || {};

    let taskDefinitionName = cluster.task_definition.name;
    taskDefinitionName = service.replaceConfigReferences(in_serviceConfig, taskDefinitionName);
    return taskDefinitionName;
}

// ******************************

function getAwsClusterUrl(in_serviceConfig, in_options) {
    let opts = in_options || {};
    let cluster = opts.cluster || {};

    let clusterUrl = cluster.url;
    clusterUrl = service.replaceConfigReferences(in_serviceConfig, clusterUrl);
    return clusterUrl;
}

// ******************************
// Setup Functions:
// ******************************

function awsLogin (in_serviceConfig, in_environment) {
    let serviceConfig = service.accessConfig(in_serviceConfig, {
        service: {
            clusters: [
                {
                    aws: {
                        access_key: 'STRING',
                        secret_key: 'STRING'
                    },
                    default: 'BOOLEAN',
                    environment: 'STRING'
                }
            ]
        }
    });

    if (!awsInstalled()) {
        throw new Error('AWS-CLI isn\'t installed');
    }

    let cluster = getEnvironmentCluster(serviceConfig.service.clusters, in_environment);
    if (!cluster) {
        if (in_environment) {
            throw new Error('No cluster set for "' + in_environment + '" environment');
        } else {
            throw new Error('No default environment defined');
        }
    }

    let awsAccessKey = cluster.aws.access_key;
    if (!awsAccessKey) {
        throw new Error('AWS access key not set');
    }

    let awsSecretKey = getSecretKey(in_serviceConfig);
    if (!awsSecretKey) {
        throw new Error('AWS secret key not set');
    }

    let awsRegion = cluster.aws.region || 'ap-southeast-2';

    let path = require('path');
    let awsFolder = path.resolve(env.getShellHome(), '.aws');
    if (!fs.folderExists(awsFolder)) {
        fs.createFolder(awsFolder);
    }

    let awsCredentialsFile = path.resolve(awsFolder, 'credentials');
    let awsConfigFile = path.resolve(awsFolder, 'config');

    cprint.cyan('Setting up AWS credentials...');

    fs.writeFile(awsCredentialsFile, [
        '[default]',
        `aws_access_key_id = ${awsAccessKey}`,
        `aws_secret_access_key = ${awsSecretKey}`,
        ''
    ].join('\n'), true);

    fs.writeFile(awsConfigFile, [
        '[default]',
        `region = ${awsRegion}`,
        ''
    ].join('\n'), true);
}

// ******************************
// Cache Clearing Functions:
// ******************************

function clearCachedAutoScalingGroups (in_options) {
    let opts = in_options || {};
    let awsCache = opts.cache || {};
    let cacheKey = `AllAutoScalingGroups_${opts.profile}_${opts.region}`;
    awsCache[cacheKey] = undefined;
}

// ******************************

function clearCachedAutoScalingGroupInstanceCount (in_autoScalingGroupName, in_options) {
    let opts = in_options || {};
    let awsCache = opts.cache || {};
    let cacheKey = `AutoScalingGroupInstanceCount_${opts.profile}_${opts.region}_${in_autoScalingGroupName}`;
    awsCache[cacheKey] = undefined;
}

// ******************************

function clearCachedTaskDefinitionArnForTaskDefinition (in_clusterServiceArn, in_options) {
    let opts = in_options || {};
    let awsCache = opts.cache || {};
    let cacheKey = `TaskDefinitionArn_${opts.profile}_${opts.region}_${in_clusterServiceArn}`;
    awsCache[cacheKey] = undefined;
}

// ******************************

function clearCachedLatestTaskDefinitionArnForTaskDefinition (in_taskDefinitionName, in_options) {
    let opts = in_options || {};
    let awsCache = opts.cache || {};
    let cacheKey = `LatestTaskDefinitionArn_${opts.profile}_${opts.region}_${in_taskDefinitionName}`;
    awsCache[cacheKey] = undefined;
}

// ******************************

function clearCachedCurrentTaskDefinitionArnForTaskDefinition (in_taskDefinitionName, in_options) {
    let opts = in_options || {};
    let awsCache = opts.cache || {};
    let cacheKey = `CurrentTaskDefinitionArn_${opts.profile}_${opts.region}_${in_taskDefinitionName}`;
    awsCache[cacheKey] = undefined;
}

// ******************************

function clearCachedPreviousTaskDefinitionArnsForTaskDefinition (in_taskDefinitionName, in_options) {
    let opts = in_options || {};
    let awsCache = opts.cache || {};
    let cacheKey = `PreviousTaskDefinitionArns_${opts.profile}_${opts.region}_${in_taskDefinitionName}`;
    awsCache[cacheKey] = undefined;
}

// ******************************

function clearCachedDockerRepositoryImagesForRepositoryName (in_dockerRepositoryName, in_options) {
    let opts = in_options || {};
    let awsCache = opts.cache || {};
    let cacheKey = `DockerRepositoryImages_${opts.profile}_${opts.region}_${in_dockerRepositoryName}`;
    awsCache[cacheKey] = undefined;
}

// ******************************

function clearCachedLaunchConfigurationLike (in_launchConfigurationTemplate, in_options) {
    let opts = in_options || {};
    let awsCache = opts.cache || {};
    let cacheKey = `LaunchConfiguration_${opts.profile}_${opts.region}_${in_launchConfigurationTemplate}`;
    awsCache[cacheKey] = undefined;
}

// ******************************

function clearCachedLaunchConfigurationsLike (in_launchConfigurationTemplate, in_options) {
    let opts = in_options || {};
    let awsCache = opts.cache || {};
    let cacheKey = `LaunchConfiguration_${opts.profile}_${opts.region}_${in_launchConfigurationTemplate}`;
    awsCache[cacheKey] = undefined;
}

// ******************************
// Other Functions:
// ******************************

function awsArnToTitle (in_arn) {
    let title = in_arn || '';
    let match = in_arn.match(/arn:aws(?::[a-z0-9-]*){4}\/(.*)/);
    if (match) {
        title = match[1];
    }

    return title;
}

// ******************************

function awsArnToAccountId (in_arn) {
    let title = in_arn || '';
    let match = in_arn.match(/arn:aws:.*:([0-9]+):.*/);
    if (match) {
        title = match[1];
    }

    return title;
}

// ******************************

function awsCmd (in_args, in_options) {
    let opts = in_options || {};
    let hide = opts.hide;

    if (!awsInstalled()) {
        throw new Error('AWS-CLI isn\'t installed');
    }

    if (!in_args) {
        return false;
    }

    let args = in_args;

    if (!Array.isArray(args)) {
        args = [args];
    }

    if (!opts.no_profile) {
        args.push('--profile');

        if (opts.profile) {
            args.push(opts.profile);
        } else {
            args.push('default');
        }
    }

    if (opts.region) {
        args.push('--region');
        args.push(opts.region);
    }

    return exec.cmdSync(g_AWS_CMD, args, {
        indent: '  ',
        hide: hide
    });
}

// ******************************

function parseAwsCmdResult (in_cmdResult) {
    if (in_cmdResult.hasError) {
        in_cmdResult.throwError();
    }

    if (! in_cmdResult.result) {
        throw new Error('Failed to parse empty result...');
    }

    let jsonObject;
    try {
        jsonObject = JSON.parse(in_cmdResult.result);
    } catch (e) {
        throw new Error('\nFailed to parse "' + in_cmdResult.result + '":\n' + e.stack);
    }

    return jsonObject;
}

// ******************************

function awsInstalled () {
    if (g_AWS_CLI_INSTALLED === undefined) {
        g_AWS_CLI_INSTALLED = !!awsVersion('aws');
        if (!g_AWS_CLI_INSTALLED) {
            g_AWS_CLI_INSTALLED = !!awsVersion('aws.cmd');
        }
    }
    return g_AWS_CLI_INSTALLED;
}

// ******************************

function awsVersion (awsCmd) {
    g_AWS_CMD = awsCmd;

    let cmdResult = exec.cmdSync(g_AWS_CMD, ['--version'], {
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
// Helper Functions:
// ******************************

function _getAutoScalingGroupForAutoScalingGroupName (in_autoScalingGroupName, in_options) {
    let opts = in_options || {};

    let awsCache = opts.cache || {};
    let cacheKey = `AutoScalingGroup_${opts.profile}_${opts.region}_${in_autoScalingGroupName}`;
    let cacheItem = awsCache[cacheKey];
    let cacheVal = (cacheItem || {}).val;
    if (cacheVal !== undefined) {
        return cacheVal;
    }

    if (opts.verbose) {
        cprint.cyan('Retrieving Auto Scaling Group Name for Auto Scaling Group "' + in_autoScalingGroupName + '"...');
    }

    let autoScalingGroups = getAutoScalingGroups(in_options);
    if (!autoScalingGroups || !autoScalingGroups.length) {
        if (!opts.hideWarnings) {
            cprint.yellow('Couldn\'t find any AWS Auto Scaling Groups');
        }
        return;
    }

    let autoScalingGroup = autoScalingGroups
        .filter(obj => opts.partialMatch ? _partialStrMatch(obj.AutoScalingGroupName, in_autoScalingGroupName) : obj.AutoScalingGroupName === in_autoScalingGroupName)
        .find(() => true);


    if (!autoScalingGroup) {
        if (!opts.hideWarnings) {
            cprint.yellow('Couldn\'t find Auto Scaling Group Name for Auto Scaling Group "' + in_autoScalingGroupName + '"');
        }
        return;
    }

    awsCache[cacheKey] = {
        val: autoScalingGroup,
        expires: date.getTimestamp() + cache.durations.week
    };

    return autoScalingGroup;
}

// ******************************

function _getRoleArns (in_options) {
    let opts = in_options || {};

    let awsCache = opts.cache || {};
    let cacheKey = `RoleArns_${opts.profile}_${opts.region}`;
    let cacheItem = awsCache[cacheKey];
    let cacheVal = (cacheItem || {}).val;
    if (cacheVal !== undefined) {
        return cacheVal;
    }

    if (opts.verbose) {
        cprint.cyan('Retrieving AWS Role ARNs...');
    }

    let cmdResult = awsCmd([
        'iam',
        'list-roles'
    ], {
        hide: !opts.verbose,
        profile: opts.profile,
        region: opts.region
    });

    if (cmdResult.hasError) {
        cmdResult.throwError();
        return [];
    }

    let awsRoleArns = [];
    let awsResult = parseAwsCmdResult(cmdResult);
    if (awsResult && awsResult.Roles) {
        awsRoleArns = awsResult.Roles
            .sort()
            .reverse();
    }

    awsCache[cacheKey] = {
        val: awsRoleArns,
        expires: date.getTimestamp() + cache.durations.week
    };

    return awsRoleArns;
}

// ******************************

function _getBucketPaths (in_options) {
    let opts = in_options || {};

    let awsCache = opts.cache || {};
    let cacheKey = `BucketPaths_${opts.profile}_${opts.region}`;
    let cacheItem = awsCache[cacheKey];
    let cacheVal = (cacheItem || {}).val;
    if (cacheVal !== undefined) {
        return cacheVal;
    }

    if (opts.verbose) {
        cprint.cyan('Retrieving all Bucket Paths...');
    }

    let cmdResult = awsCmd([
        's3',
        'ls'
    ], {
        hide: !opts.verbose,
        profile: opts.profile,
        no_profile: opts.no_profile,
        region: opts.region
    });

    if (cmdResult.hasError) {
        cmdResult.throwError();
        return [];
    }

    let awsBucketPaths = [];
    let awsResult = cmdResult.result;
    if (awsResult) {
        awsBucketPaths = awsResult
            .trim()
            .split(/[\r\n]+/)
            .map(obj => {
                let objMatch = obj.match(/([0-9]{4}-[0-9]{2}-[0-9]{2}) ([0-9]{2}:[0-9]{2}:[0-9]{2}) (.*)/);
                if (!objMatch) {
                    return false;
                }

                return {
                    bucketCreatedDate: objMatch[1],
                    bucketCreatedTime: objMatch[2],
                    bucketName: objMatch[3],
                    bucketPath: 's3://' + objMatch[3]
                };
            })
            .filter(obj => obj);
    }

    awsCache[cacheKey] = {
        val: awsBucketPaths,
        expires: date.getTimestamp() + cache.durations.week
    };

    return awsBucketPaths;
}

// ******************************

function _isProfileExpired (profile) {
    if (!profile) {
        return true;
    }

    if (!profile.expiration) {
        return true;
    }

    if (new Date() > new Date(profile.expiration + 'Z')) {
        return true;
    }

    return false;
}

// ******************************

function _formatSessionExpiration (in_expiration) {
    // Returns an ISO 8601 formatted date string sans the time zone Z and T date and time separator
    let isoFormattedExpiration = new Date(in_expiration).toISOString();
    return isoFormattedExpiration.replace('T', ' ').replace('.000Z', '');
}

// ******************************

function _partialStrMatch (in_str1, in_str2) {
    return (in_str1 || '').trim().toLowerCase().indexOf((in_str2 || '').trim().toLowerCase()) > -1;
}

// ******************************
// Exports:
// ******************************

module.exports['addRoleToInstanceProfile'] = addRoleToInstanceProfile;
module.exports['arnToTitle'] = awsArnToTitle;
module.exports['arnToAccountId'] = awsArnToAccountId;
module.exports['attachInlinePolicyToUser'] = attachInlinePolicyToUser;
module.exports['attachRolePolicy'] = attachRolePolicy;
module.exports['clearCachedAutoScalingGroupInstanceCount'] = clearCachedAutoScalingGroupInstanceCount;
module.exports['clearCachedAutoScalingGroups'] = clearCachedAutoScalingGroups;
module.exports['clearCachedCurrentTaskDefinitionArnForTaskDefinition'] = clearCachedCurrentTaskDefinitionArnForTaskDefinition;
module.exports['clearCachedDockerRepositoryImagesForRepositoryName'] = clearCachedDockerRepositoryImagesForRepositoryName;
module.exports['clearCachedLatestTaskDefinitionArnForTaskDefinition'] = clearCachedLatestTaskDefinitionArnForTaskDefinition;
module.exports['clearCachedLaunchConfigurationLike'] = clearCachedLaunchConfigurationLike;
module.exports['clearCachedLaunchConfigurationsLike'] = clearCachedLaunchConfigurationsLike;
module.exports['clearCachedPreviousTaskDefinitionArnsForTaskDefinition'] = clearCachedPreviousTaskDefinitionArnsForTaskDefinition;
module.exports['clearCachedTaskDefinitionArnForTaskDefinition'] = clearCachedTaskDefinitionArnForTaskDefinition;
module.exports['cmd'] = awsCmd;
module.exports['createBucket'] = createBucket;
module.exports['createCluster'] = createCluster;
module.exports['createClusterService'] = createClusterService;
module.exports['createDockerRepository'] = createDockerRepository;
module.exports['createInstanceProfile'] = createInstanceProfile;
module.exports['createRole'] = createRole;
module.exports['createUser'] = createUser;
module.exports['createUserAccessKey'] = createUserAccessKey;
module.exports['deleteDockerRepositoryImages'] = deleteDockerRepositoryImages;
module.exports['deleteLaunchConfiguration'] = deleteLaunchConfiguration;
module.exports['deployTaskDefinitionToCluster'] = deployTaskDefinitionToCluster;
module.exports['deregisterTaskDefinition'] = deregisterTaskDefinition;
module.exports['getAutoScalingGroupForLaunchConfiguration'] = getAutoScalingGroupForLaunchConfiguration;
module.exports['getAutoScalingGroupInstanceCount'] = getAutoScalingGroupInstanceCount;
module.exports['getAutoScalingGroups'] = getAutoScalingGroups;
module.exports['getAwsAutoScalingGroupName'] = getAwsAutoScalingGroupName;
module.exports['getAwsBucketName'] = getAwsBucketName;
module.exports['getAwsClusterName'] = getAwsClusterName;
module.exports['getAwsClusterServiceName'] = getAwsClusterServiceName;
module.exports['getAwsClusterUrl'] = getAwsClusterUrl;
module.exports['getAwsTaskDefinitionName'] = getAwsTaskDefinitionName;
module.exports['getBucketNameForBucketName'] = getBucketNameForBucketName;
module.exports['getBucketPathForBucketName'] = getBucketPathForBucketName;
module.exports['getClusterArnForClusterName'] = getClusterArnForClusterName;
module.exports['getClusterServiceArnForClusterName'] = getClusterServiceArnForClusterName;
module.exports['getClusterServiceVersionForTaskDefinition'] = getClusterServiceVersionForTaskDefinition;
module.exports['getClusterTaskArnsForCluster'] = getClusterTaskArnsForCluster;
module.exports['getContainerInstance'] = getContainerInstance;
module.exports['getCurrentTaskDefinitionArnForTaskDefinition'] = getCurrentTaskDefinitionArnForTaskDefinition;
module.exports['getDefaultVpcSecurityGroupIdForVpc'] = getDefaultVpcSecurityGroupIdForVpc;
module.exports['getDockerCredentials'] = getDockerCredentials;
module.exports['getDockerImageName'] = getDockerImageName;
module.exports['getDockerRepositoryForDockerImageName'] = getDockerRepositoryForDockerImageName;
module.exports['getDockerRepositoryImagesForRepositoryName'] = getDockerRepositoryImagesForRepositoryName;
module.exports['getDockerRepositoryUrl'] = getDockerRepositoryUrl;
module.exports['getEnvironmentCluster'] = getEnvironmentCluster;
module.exports['getInstanceIdsWithTags'] = getInstanceIdsWithTags;
module.exports['getLatestTaskDefinitionArnForTaskDefinition'] = getLatestTaskDefinitionArnForTaskDefinition;
module.exports['getLaunchConfigurationLike'] = getLaunchConfigurationLike;
module.exports['getLaunchConfigurationsLike'] = getLaunchConfigurationsLike;
module.exports['getMergedServiceConfig'] = getMergedAwsServiceConfig;
module.exports['getPreviousTaskDefinitionArnsForTaskDefinition'] = getPreviousTaskDefinitionArnsForTaskDefinition;
module.exports['getRoleArnForRoleName'] = getRoleArnForRoleName;
module.exports['getRoleCredentials'] = getRoleCredentials;
module.exports['getRoleCredentialsForRoleName'] = getRoleCredentialsForRoleName;
module.exports['getRoleNameForRoleName'] = getRoleNameForRoleName;
module.exports['getSecretKey'] = getSecretKey;
module.exports['getServiceConfig'] = getServiceConfig;
module.exports['getServiceRole'] = getServiceRole;
module.exports['getServiceStateFromAutoScalingGroupInstanceCount'] = getServiceStateFromAutoScalingGroupInstanceCount;
module.exports['getTargetGroupArnForTargetGroupName'] = getTargetGroupArnForTargetGroupName;
module.exports['getTargetGroups'] = getTargetGroups;
module.exports['getTaskDefinition'] = getTaskDefinition;
module.exports['getTaskDefinitionArnForClusterService'] = getTaskDefinitionArnForClusterService;
module.exports['getTaskDetails'] = getTaskDetails;
module.exports['getTasks'] = getTasks;
module.exports['getUserArnForUsername'] = getUserArnForUsername;
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
