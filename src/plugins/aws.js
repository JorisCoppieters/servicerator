'use strict'; // JS: ES6

// ******************************
// Requires:
// ******************************

let cprint = require('color-print');

let aws = require('../utils/aws');
let awsInstanceTypes = require('../utils/aws.instance.types');
let cache = require('../utils/cache');
let obj = require('../utils/object');
let date = require('../utils/date');
let docker = require('../utils/docker');
let env = require('../utils/env');
let fs = require('../utils/filesystem');
let print = require('../utils/print');
let service = require('../utils/service');
let str = require('../utils/string');
let sync = require('../utils/sync');

// ******************************
// Functions:
// ******************************

function printAwsServiceInfo (in_serviceConfig, in_environment, in_extra) {
    let serviceConfig = service.accessConfig(aws.getMergedServiceConfig(in_serviceConfig, in_environment), {
        cwd: 'STRING',
        docker: {
            image: {
                name: 'STRING',
                version: 'STRING'
            }
        },
        service: {
            clusters: [
                {
                    auto_scaling_group: {
                        name: 'STRING'
                    },
                    aws: {
                        access_key: 'STRING',
                        account_id: 'STRING',
                        profile: 'STRING',
                        region: 'STRING',
                        service_role: 'STRING',
                        bucket: {
                            name: 'STRING',
                            permissions: [
                                'STRING'
                            ],
                            region: 'STRING',
                            username: 'STRING'
                        },
                        image: {
                            name: 'STRING'
                        }
                    },
                    role: 'STRING',
                    default: 'BOOLEAN',
                    environment: 'STRING',
                    name: 'STRING',
                    service_name: 'STRING',
                    vpc_name: 'STRING'
                }
            ],
            name: 'STRING'
        }
    });

    _assertAwsIsInstalled();

    let serviceName = serviceConfig.service.name || false;

    let awsCache = cache.load(serviceConfig.cwd, 'aws');

    cprint.magenta('-- AWS --');

    const cluster = _loadCluster(serviceConfig, in_environment);

    let awsClusterName = aws.getAwsClusterName(in_serviceConfig, {
        cluster: cluster
    });

    let awsClusterServiceName = aws.getAwsClusterServiceName(in_serviceConfig, {
        cluster: cluster
    });

    let awsAutoScalingGroupName = aws.getAwsAutoScalingGroupName(in_serviceConfig, {
        cache: awsCache,
        cluster: cluster
    });

    let awsAccessKey = cluster.aws.access_key || false;
    let awsSecretKey = false;
    if (awsAccessKey) {
        awsSecretKey = aws.getSecretKey(in_serviceConfig, in_environment);
    }

    let awsAccountId = cluster.aws.account_id || false;

    if (awsAccountId) {
        print.keyVal('AWS Account Id', awsAccountId);
    }

    print.keyVal('AWS Access Key', awsAccessKey || '(Not Set)');
    print.keyVal('AWS Secret Key', awsSecretKey ? '*******' : '(Not Set)');
    print.out('\n');

    let environment = cluster.environment;
    let environmentTitle = str.toTitleCase(environment);
    let prefixedEnvironmentTitle = 'AWS ' + environmentTitle;

    let awsDockerImageName = aws.getDockerImageName(in_serviceConfig, cluster);
    if (awsDockerImageName) {
        cprint.magenta('-- AWS Docker --');
        let dockerRepositoryStore = aws.getDockerRepositoryUrl(in_serviceConfig, in_environment);
        let dockerImageVersion = serviceConfig.docker.image.version || 'latest';
        let dockerImagePath = dockerRepositoryStore + '/' + awsDockerImageName + ':' + dockerImageVersion;

        print.keyVal('AWS Docker Image Path', dockerImagePath);
        print.out('\n');
    }

    if (serviceName) {
        cprint.magenta('-- ' + prefixedEnvironmentTitle + ' Clusters State --');

        print.keyVal(prefixedEnvironmentTitle + ' Cluster Name', awsClusterName || '(Not Set)');

        if (awsAutoScalingGroupName) {
            print.keyVal(prefixedEnvironmentTitle + ' Cluster State', '...', true);
            let awsAutoScalingGroupInstanceCount = aws.getAutoScalingGroupInstanceCount(awsAutoScalingGroupName, {
                cache: awsCache,
                profile: cluster.aws.profile,
                region: cluster.aws.region,
                showWarning: true
            });
            print.clearLine();

            if (awsAutoScalingGroupInstanceCount !== undefined) {
                let serviceState = aws.getServiceStateFromAutoScalingGroupInstanceCount(awsAutoScalingGroupInstanceCount);
                if (serviceState === 'Down') {
                    serviceState = cprint.toYellow('Down');
                }
                print.keyVal(prefixedEnvironmentTitle + ' Cluster State', serviceState);
                print.keyVal(prefixedEnvironmentTitle + ' Cluster Instances', awsAutoScalingGroupInstanceCount);
            } else {
                print.keyVal(prefixedEnvironmentTitle + ' Cluster State', '???');
            }
        }

        if (in_extra && awsClusterName && awsClusterServiceName) {
            print.keyVal(prefixedEnvironmentTitle + ' Cluster Service Name', awsClusterServiceName);

            print.keyVal(prefixedEnvironmentTitle + ' Cluster Service Running', '...', true);
            let awsClusterServiceArn = aws.getClusterServiceArnForClusterName(awsClusterName, awsClusterServiceName, {
                cache: awsCache,
                profile: cluster.aws.profile,
                region: cluster.aws.region
            });
            print.clearLine();

            if (awsClusterServiceArn) {
                print.keyVal(prefixedEnvironmentTitle + ' Cluster Service Running', 'Yes');

                print.keyVal(prefixedEnvironmentTitle + ' Cluster Service Role', '...', true);

                let awsRoleName = aws.getServiceRole(in_serviceConfig, {
                    cache: awsCache,
                    cluster: cluster
                });

                if (awsRoleName) {
                    print.keyVal(prefixedEnvironmentTitle + ' Cluster Service Role', awsRoleName);
                } else {
                    print.keyVal(prefixedEnvironmentTitle + ' Cluster Service Role', '???');
                }

                print.keyVal(prefixedEnvironmentTitle + ' Cluster Service Task Definition', '...', true);
                let awsTaskDefinitionArn = aws.getTaskDefinitionArnForClusterService(awsClusterName, awsClusterServiceArn, {
                    cache: awsCache,
                    profile: cluster.aws.profile,
                    region: cluster.aws.region
                });
                print.clearLine();

                if (awsTaskDefinitionArn) {
                    let awsTaskDefinitionName = aws.arnToTitle(awsTaskDefinitionArn);
                    print.keyVal(prefixedEnvironmentTitle + ' Cluster Service Task Definition', awsTaskDefinitionName);
                } else {
                    print.keyVal(prefixedEnvironmentTitle + ' Cluster Service Task Definition', '???');
                }

                print.keyVal(prefixedEnvironmentTitle + ' Cluster Service Version', '...', true);
                let clusterServiceVersion = aws.getClusterServiceVersionForTaskDefinition(awsTaskDefinitionArn, {
                    cache: awsCache,
                    profile: cluster.aws.profile,
                    region: cluster.aws.region
                });
                print.clearLine();

                if (clusterServiceVersion) {
                    print.keyVal(prefixedEnvironmentTitle + ' Cluster Service Version', clusterServiceVersion);
                } else {
                    print.keyVal(prefixedEnvironmentTitle + ' Cluster Service Version', '???');
                }

                print.keyVal(prefixedEnvironmentTitle + ' Cluster Tasks', '...', true);
                let awsClusterTaskArns = aws.getClusterTaskArnsForCluster(awsClusterName, {
                    cache: awsCache,
                    profile: cluster.aws.profile,
                    region: cluster.aws.region
                });
                let awsClusterTaskDetails = aws.getTaskDetails(awsClusterName, awsClusterTaskArns, {
                    cache: awsCache,
                    profile: cluster.aws.profile,
                    region: cluster.aws.region
                });
                print.clearLine();

                if (awsClusterTaskDetails && awsClusterTaskDetails.length) {
                    print.keyVal(prefixedEnvironmentTitle + ' Cluster Tasks', JSON.stringify(awsClusterTaskDetails, null, 4));
                } else {
                    print.keyVal(prefixedEnvironmentTitle + ' Cluster Tasks', '[]');
                }
            } else {
                print.keyVal(prefixedEnvironmentTitle + ' Cluster Service Running', cprint.toYellow('No'));
            }
        }

        print.out('\n');

        if (in_extra) {
            let instanceIds = aws.getInstanceIdsWithTags([
                {
                    key: 'Service',
                    vals: [
                        serviceName
                    ]
                },
                {
                    key: 'Environment',
                    vals: [
                        environment
                    ]
                }
            ], {
                profile: cluster.aws.profile,
                region: cluster.aws.region
            });

            (instanceIds || []).forEach(i => {
                cprint.magenta('-- AWS ' + environmentTitle + ' Instance --');
                print.keyVal('Instance Id', i.InstanceId);
                print.keyVal('Instance Ip Address', i.IpAddress);
                print.keyVal('Instance Type', i.InstanceType);
                print.keyVal('Instance Lifecycle', i.InstanceLifecycle === 'spot' ? 'spot' : 'normal');
                print.out('\n');
            });

            let awsVpcName = cluster.vpc_name;
            if (awsVpcName) {
                cprint.magenta('-- AWS ' + environmentTitle + ' Network --');

                print.keyVal(prefixedEnvironmentTitle + ' VPC Name', awsVpcName);

                if (cluster.vpc_name) {
                    print.keyVal(prefixedEnvironmentTitle + ' VPC Id', '...', true);
                    let awsVpcId = aws.getVpcIdForVpc(cluster.vpc_name, {
                        cache: awsCache,
                        profile: cluster.aws.profile,
                        region: cluster.aws.region
                    });
                    print.clearLine();

                    if (awsVpcId) {
                        print.keyVal(prefixedEnvironmentTitle + ' VPC Id', awsVpcId);
                    } else {
                        print.keyVal(prefixedEnvironmentTitle + ' VPC Id', '???');
                    }

                    print.keyVal(prefixedEnvironmentTitle + ' VPC Default Security Group Id', '...', true);
                    let awsDefaultVpcSecurityGroupId = aws.getDefaultVpcSecurityGroupIdForVpc(awsVpcId, {
                        cache: awsCache,
                        profile: cluster.aws.profile,
                        region: cluster.aws.region
                    });
                    print.clearLine();

                    if (awsDefaultVpcSecurityGroupId) {
                        print.keyVal(prefixedEnvironmentTitle + ' VPC Default Security Group Id', awsDefaultVpcSecurityGroupId);
                    } else {
                        print.keyVal(prefixedEnvironmentTitle + ' VPC Default Security Group Id', '???');
                    }
                }

                print.out('\n');
            }
        }
    }

    let awsBucketName = aws.getAwsBucketName(in_serviceConfig, {
        cache: awsCache,
        cluster: cluster
    });
    if (awsBucketName) {
        cprint.magenta('-- ' + prefixedEnvironmentTitle + ' Bucket State' + ' --');

        print.keyVal(prefixedEnvironmentTitle + ' Bucket Name', awsBucketName);

        let awsBucketPath = aws.getBucketPathForBucketName(awsBucketName, {
            cache: awsCache,
            profile: cluster.aws.profile,
            region: cluster.aws.region
        });
        print.keyVal(prefixedEnvironmentTitle + ' Bucket Path', awsBucketPath ? awsBucketPath : cprint.toYellow('Does not exist!'));

        print.out('\n');
    }

    if (service.hasConfigFile(serviceConfig.cwd)) {
        cache.save(serviceConfig.cwd, 'aws', awsCache);
    }

    cprint.magenta('----');
    return true;
}

// ******************************

function awsTagDockerImage(in_serviceConfig, in_environment) {
    let serviceConfig = service.accessConfig(aws.getMergedServiceConfig(in_serviceConfig, in_environment), {
        docker: {
            image: {
                name: 'STRING'
            },
            organization: 'STRING'
        },
        service: {
            clusters: [
                {
                    default: 'BOOLEAN',
                    environment: 'STRING',
                    aws: {
                        account_id: 'STRING',
                        region: 'STRING',
                        image: {
                            name: 'STRING'
                        }
                    }
                }
            ]
        },
        cwd: 'STRING'
    });

    _assertAwsIsInstalled();
    _assertDockerIsInstalled();
    _assertDockerIsRunning();

    const cluster = _loadCluster(serviceConfig, in_environment);

    let dockerRepositoryStore = aws.getDockerRepositoryUrl(in_serviceConfig, in_environment);
    let awsDockerImageName = aws.getDockerImageName(in_serviceConfig, cluster);
    if (!awsDockerImageName) {
        throw new Error('AWS docker image name not set');
    }

    let dockerImageName = aws.getDockerImageName(in_serviceConfig);
    if (!dockerImageName) {
        throw new Error('Docker image name not set');
    }

    let dockerImagePath = dockerRepositoryStore + '/' + awsDockerImageName;

    let dockerUsername = docker.getUsername(in_serviceConfig);
    if (!dockerUsername) {
        throw new Error('Docker Image username not set');
    }

    let dockerRepository = serviceConfig.docker.organization || dockerUsername;
    let dockerFullImagePath = dockerRepository + '/' + dockerImageName;

    let dockerImageTags = docker.getImageTags(in_serviceConfig, {
        includeVersionControlTags: true
    });

    let dockerImageTaggedPaths = [];
    dockerImageTags.forEach(t => {
        dockerImageTaggedPaths.push(dockerImagePath + ':' + t);
    });

    let noErrors = true;

    dockerImageTaggedPaths
        .forEach(tag => {
            let args = ['tag', dockerFullImagePath, tag];
            cprint.cyan('Tagging Docker image...');
            let cmdResult = docker.cmd(args);
            if (cmdResult.hasError) {
                cmdResult.throwError();
                noErrors = false;
            }
        });


    let args = ['images', '--format', '{{.Repository}}:{{.Tag}}\t{{.ID}}'];
    let cmdResult = docker.cmd(args, {
        hide: true
    });

    if (cmdResult.hasError) {
        cmdResult.throwError();
        return;
    }

    let otherImageTags = cmdResult.rows
        .filter(r => r.match(new RegExp('^' + dockerImagePath + ':')))
        .filter(r => !r.match(/<none>/))
        .map(r => r.split(/\t/)[0])
        .filter(r => dockerImageTaggedPaths.indexOf(r) < 0);

    if (otherImageTags.length) {
        cprint.cyan('Removing old Docker images for service...');
        docker.cmd(['rmi'].concat(otherImageTags), {
            async: true
        });
    }

    return noErrors;
}

// ******************************

function awsPushDockerImage(in_serviceConfig, in_environment) {
    let serviceConfig = service.accessConfig(aws.getMergedServiceConfig(in_serviceConfig, in_environment), {
        docker: {
            image: {
                name: 'STRING'
            }
        },
        service: {
            clusters: [
                {
                    default: 'BOOLEAN',
                    environment: 'STRING',
                    aws: {
                        account_id: 'STRING',
                        region: 'STRING',
                        image: {
                            name: 'STRING'
                        }
                    }
                }
            ]
        },
        cwd: 'STRING'
    });

    _assertAwsIsInstalled();
    _assertDockerIsInstalled();
    _assertDockerIsRunning();

    let awsDockerCredentials = awsDockerLogin(in_serviceConfig, in_environment);
    if (!awsDockerCredentials) {
        throw new Error('Failed to get AWS Docker credentials');
    }

    const cluster = _loadCluster(serviceConfig, in_environment);

    if (!awsTagDockerImage(in_serviceConfig, in_environment)) {
        return false;
    }

    let dockerRepositoryStore = aws.getDockerRepositoryUrl(in_serviceConfig, in_environment);
    let awsDockerImageName = aws.getDockerImageName(in_serviceConfig, cluster);
    if (!awsDockerImageName) {
        throw new Error('AWS docker image name not set');
    }

    let dockerImagePath = dockerRepositoryStore + '/' + awsDockerImageName;

    let tasks = [
        docker.getImageExecTask(
            awsDockerCredentials.username,
            awsDockerCredentials.password,
            dockerImagePath,
            dockerRepositoryStore, {
                value: 'push',
                displayName: 'Pushing'
            }
        )
    ];

    sync.runTasks(tasks);
    return true;
}

// ******************************

function awsDeploy (in_serviceConfig, in_stopTasks, in_environment) {
    let serviceConfig = service.accessConfig(aws.getMergedServiceConfig(in_serviceConfig, in_environment), {
        cwd: 'STRING',
        docker: {
            image: {
                name: 'STRING',
                version: 'STRING'
            }
        },
        service: {
            clusters: [
                {
                    aws: {
                        account_id: 'STRING',
                        profile: 'STRING',
                        region: 'STRING',
                        image: {
                            name: 'STRING'
                        }
                    },
                    default: 'BOOLEAN',
                    environment: 'STRING',
                    tasks: {
                        count: 'NUMBER'
                    },
                    name: 'STRING',
                    service_name: 'STRING',
                    task_definition: {
                        name: 'STRING'
                    }
                }
            ],
            name: 'STRING'
        }
    });

    _assertAwsIsInstalled();

    let serviceName = serviceConfig.service.name;
    if (!serviceName) {
        throw new Error('Service name not set');
    }

    const cluster = _loadCluster(serviceConfig, in_environment);

    let environment = cluster.environment;
    let environmentTitle = str.toTitleCase(environment);

    let awsTaskDefinitionName = aws.getAwsTaskDefinitionName(in_serviceConfig, {
        cluster: cluster
    });

    if (!awsTaskDefinitionName) {
        throw new Error('Service task definition name not set');
    }

    let awsDockerImageName = aws.getDockerImageName(in_serviceConfig, cluster);
    if (!awsDockerImageName) {
        throw new Error('AWS docker image name not set');
    }

    let dockerImageVersion = serviceConfig.docker.image.version || 'latest';

    let awsDockerRepositoryUrl = aws.getDockerRepositoryUrl(in_serviceConfig, in_environment);
    if (!awsDockerRepositoryUrl) {
        throw new Error('AWS docker repository not set');
    }

    let awsTaskDefinitionImagePath = awsDockerRepositoryUrl + '/' + awsDockerImageName + ':' + dockerImageVersion;

    let awsClusterName = aws.getAwsClusterName(in_serviceConfig, {
        cluster: cluster
    });

    let awsClusterServiceName = aws.getAwsClusterServiceName(in_serviceConfig, {
        cluster: cluster
    });

    let awsClusterServiceTasksCount = cluster.tasks.count || 1;

    let awsCache = cache.load(serviceConfig.cwd, 'aws');

    cprint.magenta('-- Deploy --');
    print.keyVal('AWS Task Definition Name', awsTaskDefinitionName);
    print.keyVal('AWS Task Definition Image Path', awsTaskDefinitionImagePath);

    print.keyVal('AWS Task Definition', '...', true);
    let taskDefinitionArn = aws.getLatestTaskDefinitionArnForTaskDefinition(awsTaskDefinitionName, {
        cache: awsCache,
        showWarning: true,
        profile: cluster.aws.profile,
        region: cluster.aws.region
    });
    if (!taskDefinitionArn) {
        return;
    }

    let awsClusterServiceArn = aws.getClusterServiceArnForClusterName(awsClusterName, awsClusterServiceName, {
        cache: awsCache,
        showWarning: true,
        profile: cluster.aws.profile,
        region: cluster.aws.region
    });
    if (!awsClusterServiceArn) {
        return;
    }

    print.clearLine();
    print.keyVal('AWS Task Definition', awsTaskDefinitionName);

    print.keyVal('AWS ' + environmentTitle + ' Cluster Name', awsClusterName);
    print.keyVal('AWS ' + environmentTitle + ' Cluster Service Name', awsClusterServiceName);
    print.keyVal('AWS ' + environmentTitle + ' Cluster Service Tasks Count', awsClusterServiceTasksCount);

    print.keyVal('AWS ' + environmentTitle + ' Cluster Tasks', '...', true);
    let awsClusterTaskArns = aws.getClusterTaskArnsForCluster(awsClusterName, {
        cache: awsCache,
        showWarning: true,
        profile: cluster.aws.profile,
        region: cluster.aws.region
    });
    if (!awsClusterTaskArns) {
        return;
    }
    print.clearLine();
    let awsClusterTaskNames = awsClusterTaskArns.map(a => aws.arnToTitle(a));
    print.keyVal('AWS ' + environmentTitle + ' Cluster Tasks', JSON.stringify(awsClusterTaskNames, null, 4));

    if (in_stopTasks) {
        awsClusterTaskArns.forEach(t => {
            aws.stopClusterTask(awsClusterName, t, {
                profile: cluster.aws.profile,
                region: cluster.aws.region
            });
        });
    }

    aws.deployTaskDefinitionToCluster(awsClusterName, awsClusterServiceArn, taskDefinitionArn, awsClusterServiceTasksCount, {
        profile: cluster.aws.profile,
        region: cluster.aws.region
    });

    if (service.hasConfigFile(serviceConfig.cwd)) {
        cache.save(serviceConfig.cwd, 'aws', awsCache);
    }

    cprint.magenta('----');
    return true;
}

// ******************************

function awsDeployNewTaskDefinition (in_serviceConfig, in_forceModelUpdate, in_stopTasks, in_environment) {
    if (!awsPushDockerImage(in_serviceConfig, in_environment)) {
        return false;
    }

    if (!awsCreateTaskDefinition(in_serviceConfig, in_forceModelUpdate, in_environment)) {
        return;
    }

    if (!awsDeploy(in_serviceConfig, in_stopTasks, in_environment)) {
        return;
    }

    if (!awsCleanTaskDefinitions(in_serviceConfig, in_environment)) {
        return;
    }

    return true;
}

// ******************************

function awsDeployNewLaunchConfiguration (in_serviceConfig, in_environment) {
    if (!awsCreateLaunchConfiguration(in_serviceConfig, in_environment)) {
        return;
    }

    if (!awsUpdateAutoScalingGroup(in_serviceConfig, in_environment)) {
        return;
    }

    if (!awsCleanLaunchConfigurations(in_serviceConfig, in_environment)) {
        return;
    }

    return true;
}

// ******************************

function awsGetDockerCommand (in_serviceConfig, in_environment) {
    let serviceConfig = service.accessConfig(aws.getMergedServiceConfig(in_serviceConfig, in_environment), {
        cwd: 'STRING',
        docker: {
            image: {
                name: 'STRING',
                version: 'STRING'
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
            }
        },
        model: {
            version: 'STRING'
        },
        service: {
            clusters: [
                {
                    aws: {
                        account_id: 'STRING',
                        bucket: {
                            name: 'STRING'
                        },
                        profile: 'STRING',
                        region: 'STRING',
                        image: {
                            name: 'STRING'
                        }
                    },
                    default: 'BOOLEAN',
                    environment: 'STRING',
                    tasks: {
                        count: 'NUMBER'
                    },
                    name: 'STRING',
                    service_name: 'STRING',
                    task_definition: {
                        name: 'STRING'
                    }
                }
            ],
            name: 'STRING'
        }
    });

    _assertAwsIsInstalled();

    let awsCache = cache.load(serviceConfig.cwd, 'aws');

    let serviceName = serviceConfig.service.name;
    if (!serviceName) {
        throw new Error('Service name not set');
    }

    const cluster = _loadCluster(serviceConfig, in_environment);

    let memoryLimit = serviceConfig.docker.container.memory_limit || false;

    let awsDockerImageName = aws.getDockerImageName(in_serviceConfig, cluster);
    if (!awsDockerImageName) {
        throw new Error('AWS docker image name not set');
    }

    let dockerImageVersion = serviceConfig.docker.image.version || 'latest';

    let awsDockerRepositoryUrl = aws.getDockerRepositoryUrl(in_serviceConfig, in_environment);
    if (!awsDockerRepositoryUrl) {
        throw new Error('AWS docker repository not set');
    }

    let awsTaskDefinitionImagePath = awsDockerRepositoryUrl + '/' + awsDockerImageName + ':' + dockerImageVersion;

    let args = [];
    args.push('run');
    args.push('--rm');
    args.push('--name');
    args.push(serviceName);
    args.push('--interactive');
    args.push('--tty');

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

    let volumeArgs = {};

    serviceConfig.docker.container.volumes.forEach(volume => {
        if (!volume.host || !volume.container || volume.local) {
            return;
        }
        volumeArgs[volume.container] = volume.host;
    });

    Object.keys(volumeArgs).forEach(volumeContainer => {
        let volumeHost = volumeArgs[volumeContainer];
        volumeHost = '"' + volumeHost + '"';
        volumeHost = service.replaceConfigReferences(in_serviceConfig, volumeHost);
        volumeContainer = service.replaceConfigReferences(in_serviceConfig, volumeContainer);
        args.push('--volume');
        args.push(volumeHost + ':' + volumeContainer);
    });

    let environmentVariableArgs = {};

    serviceConfig.docker.container.environment_variables.forEach(environment_variable => {
        if (!environment_variable.key || !environment_variable.value || environment_variable.local) {
            return;
        }

        environmentVariableArgs[environment_variable.key] = environment_variable.value;
    });

    let environmentVariableReplacements = {};
    environmentVariableReplacements['MODEL_BUCKET'] = 'Unknown';

    let awsBucketName = aws.getAwsBucketName(in_serviceConfig, {
        cache: awsCache,
        cluster: cluster
    });
    if (awsBucketName) {
        environmentVariableReplacements['MODEL_BUCKET'] = `${awsBucketName}`;
    }

    environmentVariableReplacements['SERVICE_NAME'] = serviceConfig.service.name;
    environmentVariableReplacements['SERVICE_VERSION'] = serviceConfig.docker.image.version;
    environmentVariableReplacements['MODEL_VERSION'] = serviceConfig.model.version;

    Object.keys(environmentVariableArgs).forEach(key => {
        let value = environmentVariableArgs[key];

        key = service.replaceConfigReferences(in_serviceConfig, key, environmentVariableReplacements);
        value = service.replaceConfigReferences(in_serviceConfig, value, environmentVariableReplacements);

        args.push('--env');
        args.push(key + '=' + value);
    });

    args.push(awsTaskDefinitionImagePath);
    args.push('bash');

    cprint.white('docker' + args
        .reduce((s, a, idx) => {
            if (a.match(/^--.*/)) {
                return s + ' \\\n  ' + a;
            } else if (idx == args.length - 1) {
                return s + ' \\\n    ' + a;
            } else if (idx == args.length - 2) {
                return s + ' \\\n    ' + a;
            } else {
                return s + ' ' + a;
            }
        }, '')
    );

    if (service.hasConfigFile(serviceConfig.cwd)) {
        cache.save(serviceConfig.cwd, 'aws', awsCache);
    }
}

// ******************************

function awsCreateAll (in_serviceConfig, in_environment) {
    if (!awsCreateInfrastructure(in_serviceConfig, in_environment)) {
        return;
    }

    if (!awsCreateDeliveryStructure(in_serviceConfig, in_environment)) {
        return;
    }

    return true;
}

// ******************************

function awsCreateInfrastructure (in_serviceConfig, in_environment) {
    if (!awsCreateLaunchConfiguration(in_serviceConfig, in_environment)) {
        return;
    }

    if (!awsCreateLoadBalancer(in_serviceConfig, in_environment)) {
        return;
    }

    if (!awsCreateAutoScalingGroup(in_serviceConfig, in_environment)) {
        return;
    }

    if (!awsCreateBucket(in_serviceConfig, in_environment)) {
        return;
    }

    if (!awsCreateBucketUser(in_serviceConfig, in_environment)) {
        return;
    }

    return true;
}

// ******************************

function awsCreateLaunchConfiguration (in_serviceConfig, in_environment) {
    let serviceConfig = service.accessConfig(aws.getMergedServiceConfig(in_serviceConfig, in_environment), {
        cwd: 'STRING',
        service: {
            clusters: [
                {
                    aws: {
                        profile: 'STRING',
                        region: 'STRING'
                    },
                    default: 'BOOLEAN',
                    environment: 'STRING',
                    identity_file: 'STRING',
                    instance: {
                        ami: 'STRING',
                        assign_public_ip: 'BOOLEAN',
                        iam_role: 'STRING',
                        type: 'STRING',
                        user_data: [
                            'STRING'
                        ],
                        volumes: [
                            {
                                DeviceName: 'STRING',
                                Ebs: {
                                    DeleteOnTermination: 'BOOLEAN',
                                    Encrypted: 'BOOLEAN',
                                    SnapshotId: 'STRING',
                                    VolumeSize: 'NUMBER',
                                    VolumeType: 'STRING'
                                }
                            }
                        ]
                    },
                    launch_configuration: {
                        name: 'STRING',
                        security_groups: [
                            'STRING'
                        ]
                    },
                    name: 'STRING',
                    vpc_name: 'STRING'
                }
            ],
            name: 'STRING'
        }
    });

    _assertAwsIsInstalled();

    let serviceName = serviceConfig.service.name;
    if (!serviceName) {
        throw new Error('Service name not set');
    }

    const cluster = _loadCluster(serviceConfig, in_environment);

    let environment = cluster.environment;
    let environmentTitle = str.toTitleCase(environment);

    let timestampTagTemplate = '[0-9]{4}-[0-9]{2}-[0-9]{2}-[0-9]{10}';

    let awsLaunchConfigurationTemplateName = cluster.launch_configuration.name;
    if (!awsLaunchConfigurationTemplateName) {
        throw new Error('Launch configuration name not set');
    }
    let awsLaunchConfigurationName = awsLaunchConfigurationTemplateName + '-' + date.getTimestampTag();

    let awsLaunchConfigurationSecurityGroupNames = cluster.launch_configuration.security_groups || [];

    let awsClusterName = aws.getAwsClusterName(in_serviceConfig, {
        cluster: cluster
    });

    let awsInstanceType = cluster.instance.type || 't2.micro';
    let awsIamRole = cluster.instance.iam_role;
    let awsAmi = cluster.instance.ami;
    let pemKeyName = cluster.identity_file;
    let assignPublicIp = cluster.instance.assign_public_ip;

    if (!awsAmi) {
        throw new Error('AWS AMI not set');
    }

    let awsCache = cache.load(serviceConfig.cwd, 'aws');

    cprint.magenta('-- Launch Configuration --');
    print.keyVal('AWS Instance Type', awsInstanceType);
    if (awsIamRole) {
        print.keyVal('AWS IAM Role', awsIamRole);
    }
    print.keyVal('AWS AMI', awsAmi);

    print.keyVal('AWS ' + environmentTitle + ' Launch Configuration', awsLaunchConfigurationName);

    if (pemKeyName) {
        print.keyVal('AWS ' + environmentTitle + ' PEM Key', pemKeyName);
    }

    let awsVpcName = cluster.vpc_name;
    if (!awsVpcName) {
        throw new Error('AWS VPC Name not set');
    }
    print.keyVal('AWS ' + environmentTitle + ' VPC Name', awsVpcName);

    print.keyVal('AWS ' + environmentTitle + ' VPC Id', '...', true);
    let awsVpcId = aws.getVpcIdForVpc(awsVpcName, {
        cache: awsCache,
        showWarning: true,
        profile: cluster.aws.profile,
        region: cluster.aws.region
    });
    if (!awsVpcId) {
        return;
    }
    print.clearLine();
    print.keyVal('AWS ' + environmentTitle + ' VPC Id', awsVpcId);

    let awsLaunchConfigurationSecurityGroupsFound = true;
    let awsLaunchConfigurationSecurityGroups = [];

    if (awsLaunchConfigurationSecurityGroupNames.length) {
        awsLaunchConfigurationSecurityGroups = awsLaunchConfigurationSecurityGroupNames
            .map(name => {
                print.keyVal('AWS ' + environmentTitle + ' VPC "' + name + '" Security Group Id', '...', true);
                let awsVpcSecurityGroupId = aws.getVpcSecurityGroupIdFromGroupName(awsVpcId, name, {
                    cache: awsCache,
                    profile: cluster.aws.profile,
                    region: cluster.aws.region
                });
                if (!awsVpcSecurityGroupId) {
                    awsLaunchConfigurationSecurityGroupsFound = false;
                    return;
                }
                print.clearLine();
                print.keyVal('AWS ' + environmentTitle + ' VPC "' + name + '" Security Group Id', awsVpcSecurityGroupId);
                return awsVpcSecurityGroupId;
            });

    } else {
        print.keyVal('AWS ' + environmentTitle + ' VPC Default Security Group Id', '...', true);
        let awsDefaultVpcSecurityGroupId = aws.getDefaultVpcSecurityGroupIdForVpc(awsVpcId, {
            cache: awsCache,
            profile: cluster.aws.profile,
            region: cluster.aws.region
        });
        if (!awsDefaultVpcSecurityGroupId) {
            return;
        }
        print.clearLine();
        print.keyVal('AWS ' + environmentTitle + ' VPC Default Security Group Id', awsDefaultVpcSecurityGroupId);
        awsLaunchConfigurationSecurityGroups.push(awsDefaultVpcSecurityGroupId);
    }

    if (!awsLaunchConfigurationSecurityGroupsFound) {
        return;
    }

    let userData = (cluster.instance.user_data || []).join('\n');
    userData = service.replaceConfigReferences(in_serviceConfig, userData, {
        'ENVIRONMENT': environment,
        'AWS_CLUSTER_NAME': awsClusterName
    });

    let blockDeviceMappings = JSON.stringify(cluster.instance.volumes || []);

    cprint.cyan('Creating launch configuration...');

    let args = [
        'autoscaling',
        'create-launch-configuration',

        '--instance-monitoring',
        '{"Enabled": false}',

        '--launch-configuration-name',
        awsLaunchConfigurationName,

        '--security-groups',
        JSON.stringify(awsLaunchConfigurationSecurityGroups),

        '--instance-type',
        awsInstanceType,

        '--image-id',
        awsAmi
    ];

    if (assignPublicIp) {
        args.push('--associate-public-ip-address');
    }

    if (awsIamRole) {
        args.push('--iam-instance-profile');
        args.push(awsIamRole);
    }

    if (blockDeviceMappings) {
        args.push('--block-device-mappings');
        args.push(blockDeviceMappings);
    }

    if (userData) {
        args.push('--user-data');
        let path = require('path');
        let tempFolder = env.getTemp();
        let tempUserDataFile = fs.writeFile(path.resolve(tempFolder, 'user-data'), userData, true);
        tempUserDataFile = tempUserDataFile.replace(/\\/g, '/');
        args.push('file://' + tempUserDataFile);
    }

    if (pemKeyName) {
        args.push('--key-name');
        args.push(pemKeyName);
    }

    let cmdResult = aws.cmd(args, {
        profile: cluster.aws.profile,
        region: cluster.aws.region
    });

    if (cmdResult.hasError) {
        cmdResult.throwError();
        return false;
    } else {
        cmdResult.printResult('  ');
        cprint.green('Created launch configuration');
        aws.clearCachedLaunchConfigurationLike(awsLaunchConfigurationTemplateName + '-' + timestampTagTemplate, {
            cache: awsCache,
            profile: cluster.aws.profile,
            region: cluster.aws.region
        });
        aws.clearCachedLaunchConfigurationsLike(awsLaunchConfigurationTemplateName + '-' + timestampTagTemplate, {
            cache: awsCache,
            profile: cluster.aws.profile,
            region: cluster.aws.region
        });
    }

    if (service.hasConfigFile(serviceConfig.cwd)) {
        cache.save(serviceConfig.cwd, 'aws', awsCache);
    }

    cprint.magenta('----');
    return true;
}

// ******************************

function awsCreateLoadBalancer (in_serviceConfig, in_environment) {
    let serviceConfig = service.accessConfig(aws.getMergedServiceConfig(in_serviceConfig, in_environment), {
        cwd: 'STRING',
        service: {
            clusters: [
                {
                    aws: {
                        profile: 'STRING',
                        region: 'STRING'
                    },
                    default: 'BOOLEAN',
                    environment: 'STRING',
                    load_balancer: {
                        healthcheck: {
                            healthy_threshold: 'NUMBER',
                            interval: 'NUMBER',
                            target: 'STRING',
                            timeout: 'NUMBER',
                            unhealthy_threshold: 'NUMBER'
                        },
                        name: 'STRING',
                        ports: [
                            {
                                instance_port: 'NUMBER',
                                instance_protocol: 'STRING',
                                load_balancer_port: 'NUMBER',
                                protocol: 'STRING',
                                ssl_certificate_id: 'STRING'
                            }
                        ],
                        security_groups: [
                            'STRING'
                        ],
                        subnets: [
                            'STRING'
                        ],
                        tags: [
                            {
                                key: 'STRING',
                                val: 'STRING'
                            }
                        ]
                    },
                    name: 'STRING',
                    vpc_name: 'STRING'
                }
            ],
            name: 'STRING'
        }
    });

    _assertAwsIsInstalled();

    let serviceName = serviceConfig.service.name;
    if (!serviceName) {
        throw new Error('Service name not set');
    }

    const cluster = _loadCluster(serviceConfig, in_environment);

    let environment = cluster.environment;
    let environmentTitle = str.toTitleCase(environment);

    let awsLoadBalancerName = cluster.load_balancer.name;
    if (!awsLoadBalancerName) {
        throw new Error('Load balancer name not set');
    }

    let awsLoadBalancerSecurityGroupNames = cluster.load_balancer.security_groups || [];

    let awsVpcSubnetNames = (cluster.load_balancer.subnets || []);
    if (!awsVpcSubnetNames.length) {
        throw new Error('No VPC subnet names set');
    }

    let awsCache = cache.load(serviceConfig.cwd, 'aws');

    cprint.magenta('-- Load Balancer --');

    print.keyVal('AWS ' + environmentTitle + ' Load Balancer', awsLoadBalancerName);

    let awsVpcName = cluster.vpc_name;
    print.keyVal('AWS ' + environmentTitle + ' VPC Name', awsVpcName);

    print.keyVal('AWS ' + environmentTitle + ' VPC Id', '...', true);
    let awsVpcId = aws.getVpcIdForVpc(awsVpcName, {
        cache: awsCache,
        showWarning: true,
        profile: cluster.aws.profile,
        region: cluster.aws.region
    });
    if (!awsVpcId) {
        return;
    }
    print.clearLine();
    print.keyVal('AWS ' + environmentTitle + ' VPC Id', awsVpcId);

    let awsLoadBalancerSecurityGroupsFound = true;
    let awsLoadBalancerSecurityGroups = [];

    if (awsLoadBalancerSecurityGroupNames.length) {
        awsLoadBalancerSecurityGroups = awsLoadBalancerSecurityGroupNames
            .map(name => {
                print.keyVal('AWS ' + environmentTitle + ' VPC "' + name + '" Security Group Id', '...', true);
                let awsVpcSecurityGroupId = aws.getVpcSecurityGroupIdFromGroupName(awsVpcId, name, {
                    cache: awsCache,
                    profile: cluster.aws.profile,
                    region: cluster.aws.region
                });
                if (!awsVpcSecurityGroupId) {
                    awsLoadBalancerSecurityGroupsFound = false;
                    return;
                }
                print.clearLine();
                print.keyVal('AWS ' + environmentTitle + ' VPC "' + name + '" Security Group Id', awsVpcSecurityGroupId);
                return awsVpcSecurityGroupId;
            });

    } else {
        print.keyVal('AWS ' + environmentTitle + ' VPC Default Security Group Id', '...', true);
        let awsDefaultVpcSecurityGroupId = aws.getDefaultVpcSecurityGroupIdForVpc(awsVpcId, {
            cache: awsCache,
            profile: cluster.aws.profile,
            region: cluster.aws.region
        });
        if (!awsDefaultVpcSecurityGroupId) {
            return;
        }
        print.clearLine();
        print.keyVal('AWS ' + environmentTitle + ' VPC Default Security Group Id', awsDefaultVpcSecurityGroupId);
        awsLoadBalancerSecurityGroups.push(awsDefaultVpcSecurityGroupId);
    }

    if (!awsLoadBalancerSecurityGroupsFound) {
        return;
    }

    let awsVpcSubnetIdsFound = true;
    let awsVpcSubnetIds = awsVpcSubnetNames
        .map(awsVpcSubnetName => {
            print.keyVal('AWS ' + environmentTitle + ' VPC "' + awsVpcSubnetName + '" Subnet Id', '...', true);
            let awsVpcSubnetId = aws.getVpcSubnetIdForVpc(awsVpcId, awsVpcSubnetName, {
                cache: awsCache,
                profile: cluster.aws.profile,
                region: cluster.aws.region
            });
            if (!awsVpcSubnetId) {
                awsVpcSubnetIdsFound = false;
                return;
            }
            print.clearLine();
            print.keyVal('AWS ' + environmentTitle + ' VPC "' + awsVpcSubnetName + '" Subnet Id', awsVpcSubnetId);
            return awsVpcSubnetId;
        });

    if (!awsVpcSubnetIdsFound) {
        return;
    }

    let tagsDict = {
        LoadBalancer: awsLoadBalancerName
    };

    let clusterTags = cluster.load_balancer.tags || [];
    clusterTags.forEach(t => {
        tagsDict[t.key] = t.val;
    });

    let tags = Object.keys(tagsDict).map(key => {
        let val = tagsDict[key];
        return {
            Key: key,
            Value: val
        };
    });

    let listeners = cluster.load_balancer.ports
        .map(port => {
            let awsPort = {};
            awsPort['Protocol'] = port.protocol;
            awsPort['LoadBalancerPort'] = port.load_balancer_port;
            awsPort['InstanceProtocol'] = port.instance_protocol;
            awsPort['InstancePort'] = port.instance_port;

            if (port.ssl_certificate_id) {
                awsPort['SSLCertificateId'] = port.ssl_certificate_id;
            }
            return awsPort;
        });

    let healthcheck = cluster.load_balancer.healthcheck || false;
    let awsHealthcheck = {};
    if (healthcheck) {
        awsHealthcheck['Target'] = healthcheck.target;
        awsHealthcheck['Interval'] = healthcheck.interval;
        awsHealthcheck['Timeout'] = healthcheck.timeout;
        awsHealthcheck['UnhealthyThreshold'] = healthcheck.unhealthy_threshold;
        awsHealthcheck['HealthyThreshold'] = healthcheck.healthy_threshold;
    }

    let listenerArgs = listeners
        .map(l => {
            return Object.keys(l)
                .map(k => {
                    let v = l[k];
                    return `${k}=${v}`;
                });
        });

    cprint.cyan('Creating load balancer...');

    let args = [
        'elb',
        'create-load-balancer',

        '--load-balancer-name',
        awsLoadBalancerName,

        '--security-groups',
        JSON.stringify(awsLoadBalancerSecurityGroups),

        '--tags',
        JSON.stringify(tags)
    ];

    args = args.concat('--listeners').concat(listenerArgs);
    args = args.concat('--subnets').concat(awsVpcSubnetIds);

    let cmdResult = aws.cmd(args, {
        profile: cluster.aws.profile,
        region: cluster.aws.region
    });
    if (cmdResult.hasError) {
        cmdResult.throwError();
        return false;
    } else {
        cmdResult.printResult('  ');
        cprint.green('Created load balancer');
    }

    if (awsHealthcheck) {
        let healthCheckArgs = Object.keys(awsHealthcheck)
            .map(k => {
                let v = awsHealthcheck[k];
                return `${k}=${v}`;
            })
            .join(',');

        let args = [
            'elb',
            'configure-health-check',

            '--load-balancer-name',
            awsLoadBalancerName,

            '--health-check',
            healthCheckArgs
        ];

        let cmdResult = aws.cmd(args, {
            profile: cluster.aws.profile,
            region: cluster.aws.region
        });
        if (cmdResult.hasError) {
            cmdResult.throwError();
            return false;
        } else {
            cmdResult.printResult('  ');
            cprint.green('Added health check to load balancer');
        }
    }

    if (service.hasConfigFile(serviceConfig.cwd)) {
        cache.save(serviceConfig.cwd, 'aws', awsCache);
    }

    cprint.magenta('----');
    return true;
}

// ******************************

function awsCreateAutoScalingGroup (in_serviceConfig, in_environment) {
    let serviceConfig = service.accessConfig(aws.getMergedServiceConfig(in_serviceConfig, in_environment), {
        cwd: 'STRING',
        docker: {
            image: {
                name: 'STRING'
            }
        },
        service: {
            clusters: [
                {
                    auto_scaling_group: {
                        health_check_grace_period: 'NUMBER',
                        count: 'NUMBER',
                        name: 'STRING',
                        subnets: [
                            'STRING'
                        ]
                    },
                    aws: {
                        profile: 'STRING',
                        region: 'STRING',
                        image: {
                            name: 'STRING'
                        }
                    },
                    default: 'BOOLEAN',
                    environment: 'STRING',
                    instance: {
                        tags: [
                            {
                                key: 'STRING',
                                val: 'STRING'
                            }
                        ]
                    },
                    launch_configuration: {
                        name: 'STRING'
                    },
                    load_balancer: {
                        name: 'STRING'
                    },
                    name: 'STRING',
                    vpc_name: 'STRING'
                }
            ],
            name: 'STRING'
        }
    });

    _assertAwsIsInstalled();

    let serviceName = serviceConfig.service.name;
    if (!serviceName) {
        throw new Error('Service name not set');
    }

    const cluster = _loadCluster(serviceConfig, in_environment);

    let awsDockerImageName = aws.getDockerImageName(in_serviceConfig, cluster);
    if (!awsDockerImageName) {
        throw new Error('AWS docker image name not set');
    }

    let environment = cluster.environment;
    let environmentTitle = str.toTitleCase(environment);

    let awsLaunchConfigurationTemplateName = cluster.launch_configuration.name;
    if (!awsLaunchConfigurationTemplateName) {
        throw new Error('Launch configuration name not set');
    }

    let awsAutoScalingGroupName = aws.getAwsAutoScalingGroupName(in_serviceConfig, {
        cache: awsCache,
        cluster: cluster
    });
    if (!awsAutoScalingGroupName) {
        throw new Error('Auto scaling group name not set');
    }

    let awsVpcName = cluster.vpc_name;
    if (!awsVpcName) {
        throw new Error('VPC name not set');
    }

    let awsVpcSubnetNames = (cluster.auto_scaling_group.subnets || []);
    if (!awsVpcSubnetNames.length) {
        throw new Error('No VPC subnet names set');
    }

    let healthCheckGracePeriod = cluster.auto_scaling_group.health_check_grace_period || 300;

    let awsLoadBalancerName = cluster.load_balancer.name;

    let awsCache = cache.load(serviceConfig.cwd, 'aws');

    let desiredInstanceCount = obj.positiveNumberOr(cluster.auto_scaling_group.count, 0);

    let awsAutoScalingGroupMinSize = 0;
    let awsAutoScalingGroupMaxSize = desiredInstanceCount + 2;

    cprint.magenta('-- Auto Scaling Group --');

    print.keyVal('AWS ' + environmentTitle + ' Auto Scaling Group', awsAutoScalingGroupName);

    let timestampTagTemplate = '[0-9]{4}-[0-9]{2}-[0-9]{2}-[0-9]{10}';

    print.keyVal('AWS ' + environmentTitle + ' Launch Configuration', '...', true);
    let awsLaunchConfigurationName = aws.getLaunchConfigurationLike(awsLaunchConfigurationTemplateName + '-' + timestampTagTemplate, {
        cache: awsCache,
        showWarning: true,
        profile: cluster.aws.profile,
        region: cluster.aws.region
    });
    if (!awsLaunchConfigurationName) {
        return;
    }
    print.clearLine();
    print.keyVal('AWS ' + environmentTitle + ' Launch Configuration', awsLaunchConfigurationName);

    print.keyVal('AWS ' + environmentTitle + ' VPC Name', awsVpcName);

    print.keyVal('AWS ' + environmentTitle + ' VPC Id', '...', true);
    let awsVpcId = aws.getVpcIdForVpc(awsVpcName, {
        cache: awsCache,
        showWarning: true,
        profile: cluster.aws.profile,
        region: cluster.aws.region
    });
    if (!awsVpcId) {
        return;
    }
    print.clearLine();
    print.keyVal('AWS ' + environmentTitle + ' VPC Id', awsVpcId);

    let awsVpcSubnetIdsFound = true;
    let awsVpcSubnetIds = awsVpcSubnetNames
        .map(awsVpcSubnetName => {
            print.keyVal('AWS ' + environmentTitle + ' VPC "' + awsVpcSubnetName + '" Subnet Id', '...', true);
            let awsVpcSubnetId = aws.getVpcSubnetIdForVpc(awsVpcId, awsVpcSubnetName, {
                cache: awsCache,
                profile: cluster.aws.profile,
                region: cluster.aws.region
            });
            if (!awsVpcSubnetId) {
                awsVpcSubnetIdsFound = false;
                return;
            }
            print.clearLine();
            print.keyVal('AWS ' + environmentTitle + ' VPC "' + awsVpcSubnetName + '" Subnet Id', awsVpcSubnetId);
            return awsVpcSubnetId;
        });

    if (!awsVpcSubnetIdsFound) {
        return;
    }

    cprint.cyan('Creating auto scaling group...');

    let tagsDict = {
        Environment: environment,
        ServiceName: serviceName,
        Name: serviceName + '-group-instance'
    };

    if (awsDockerImageName) {
        tagsDict.DockerImageName = awsDockerImageName;
    }

    let clusterTags = cluster.instance.tags || [];
    clusterTags.forEach(t => {
        tagsDict[t.key] = t.val;
    });

    let tags = Object.keys(tagsDict).map(key => {
        let val = tagsDict[key];
        return {
            ResourceId: awsAutoScalingGroupName,
            ResourceType: 'auto-scaling-group',
            Key: key,
            Value: val,
            PropagateAtLaunch: true
        };
    });

    let args = [
        'autoscaling',
        'create-auto-scaling-group',

        '--auto-scaling-group-name',
        awsAutoScalingGroupName,

        '--launch-configuration-name',
        awsLaunchConfigurationName,

        '--min-size',
        awsAutoScalingGroupMinSize,

        '--max-size',
        awsAutoScalingGroupMaxSize,

        '--vpc-zone-identifier',
        awsVpcSubnetIds.join(','),

        '--health-check-grace-period',
        healthCheckGracePeriod,

        '--termination-policies',
        'OldestInstance',

        '--tags',
        JSON.stringify(tags)
    ];

    let cmdResult = aws.cmd(args, {
        profile: cluster.aws.profile,
        region: cluster.aws.region
    });
    if (cmdResult.hasError) {
        cmdResult.throwError();
        return false;
    } else {
        cmdResult.printResult('  ');
        cprint.green('Created auto scaling group');
    }

    if (awsLoadBalancerName) {
        let args = [
            'autoscaling',
            'attach-load-balancers',

            '--auto-scaling-group-name',
            awsAutoScalingGroupName,

            '--load-balancer-names',
            awsLoadBalancerName
        ];

        let cmdResult = aws.cmd(args, {
            profile: cluster.aws.profile,
            region: cluster.aws.region
        });
        if (cmdResult.hasError) {
            cmdResult.throwError();
            return false;
        } else {
            cmdResult.printResult('  ');
            cprint.green('Added load balancer to auto scaling group');
        }
    }

    if (service.hasConfigFile(serviceConfig.cwd)) {
        cache.save(serviceConfig.cwd, 'aws', awsCache);
    }

    cprint.magenta('----');
    return true;
}

// ******************************

function awsCreateBucket (in_serviceConfig, in_environment) {
    let serviceConfig = service.accessConfig(aws.getMergedServiceConfig(in_serviceConfig, in_environment), {
        service: {
            clusters: [
                {
                    aws: {
                        profile: 'STRING',
                        region: 'STRING',
                        bucket: {
                            name: 'STRING'
                        }
                    },
                    default: 'BOOLEAN',
                    environment: 'STRING'
                }
            ]
        },
        cwd: 'STRING'
    });

    _assertAwsIsInstalled();

    const cluster = _loadCluster(serviceConfig, in_environment);

    let awsBucketName = aws.getAwsBucketName(in_serviceConfig, {
        cache: awsCache,
        cluster: cluster
    });
    if (!awsBucketName) {
        throw new Error('Service AWS bucket name is not set or');
    }

    let awsCache = cache.load(serviceConfig.cwd, 'aws');

    cprint.magenta('-- Bucket --');
    print.keyVal('AWS Bucket Name', awsBucketName);

    let awsBucketPath = aws.getBucketPathForBucketName(awsBucketName, {
        cache: awsCache,
        profile: cluster.aws.profile,
        region: cluster.aws.region
    });
    if (awsBucketPath) {
        cprint.green('AWS bucket already exists!');
        return true;
    }

    cprint.cyan('Creating bucket...');

    if (!aws.createBucket(awsBucketName, {
        profile: cluster.aws.profile,
        region: cluster.aws.region
    })) {
        return;
    }

    if (service.hasConfigFile(serviceConfig.cwd)) {
        cache.save(serviceConfig.cwd, 'aws', awsCache);
    }

    cprint.magenta('----');
    return true;
}

// ******************************

function awsCreateBucketUser (in_serviceConfig, in_environment) {
    let serviceConfig = service.accessConfig(aws.getMergedServiceConfig(in_serviceConfig, in_environment), {
        service: {
            clusters: [
                {
                    aws: {
                        profile: 'STRING',
                        region: 'STRING',
                        bucket: {
                            username: 'STRING',
                            name: 'STRING',
                            region: 'STRING',
                            permissions: [
                                'STRING'
                            ]
                        }
                    },
                    default: 'BOOLEAN',
                    environment: 'STRING'
                }
            ]
        },
        cwd: 'STRING'
    });

    _assertAwsIsInstalled();

    let sourceFolder = serviceConfig.cwd || false;

    const cluster = _loadCluster(serviceConfig, in_environment);

    let awsBucketName = aws.getAwsBucketName(in_serviceConfig, {
        cache: awsCache,
        cluster: cluster
    });
    if (!awsBucketName) {
        throw new Error('Service AWS bucket name is not set or');
    }

    let awsBucketUsername = cluster.aws.bucket.username;
    if (!awsBucketUsername) {
        throw new Error('Service bucket username not set');
    }

    let awsBucketUsernamePermissions = cluster.aws.bucket.permissions || false;
    if (!awsBucketUsernamePermissions || !awsBucketUsernamePermissions.length) {
        awsBucketUsernamePermissions = ['read'];
    }

    let awsRegion = cluster.aws.region;

    let awsCache = cache.load(serviceConfig.cwd, 'aws');

    cprint.magenta('-- Bucket User --');
    print.keyVal('AWS Bucket', awsBucketName);
    print.keyVal('AWS Bucket User Name', awsBucketUsername);

    let awsUserArn = aws.getUserArnForUsername(awsBucketUsername, {
        cache: awsCache,
        profile: cluster.aws.profile,
        region: cluster.aws.region
    });
    if (awsUserArn) {
        cprint.green('AWS bucket user already exists!');
        return true;
    }

    cprint.cyan('Creating bucket user...');

    if (!aws.createUser(awsBucketUsername, {
        profile: cluster.aws.profile,
        region: cluster.aws.region
    })) {
        return;
    }

    cprint.cyan('Creating access key...');

    let userObject = aws.createUserAccessKey(awsBucketUsername, {
        profile: cluster.aws.profile,
        region: cluster.aws.region
    });

    if (!userObject) {
        return;
    }

    let bucketUserAccessKey = userObject.AccessKey;
    let bucketUserSecretKey = userObject.SecretKey;
    let bucketRegion = cluster.aws.bucket.region || awsRegion;

    print.keyVal('AWS Bucket User Access Key', bucketUserAccessKey);
    print.keyVal('AWS Bucket User Secrety Key', '*******');

    cprint.cyan('Attaching inline policy to bucket user...');

    let awsBucketUsernameInlinePolicyName = awsBucketUsername + '-' + awsBucketUsernamePermissions.sort().join('-');

    let allActions = [
        's3:HeadBucket'
    ];

    let bucketActions = [
        's3:ListBucket'
    ];

    let bucketContentActions = [];
    if (awsBucketUsernamePermissions.indexOf('read') >= 0) {
        bucketContentActions.push('s3:GetObject');
    }

    if (awsBucketUsernamePermissions.indexOf('write') >= 0) {
        bucketContentActions.push('s3:PutObject');
        bucketContentActions.push('s3:DeleteObject');
    }

    let awsBucketUsernameInlinePolicy = {
        Statement: [
            {
                Action: allActions,
                Effect: 'Allow',
                Resource: [
                    '*'
                ]
            },
            {
                Action: bucketActions,
                Effect: 'Allow',
                Resource: [
                    'arn:aws:s3:::' + awsBucketName
                ]
            },
            {
                Action: bucketContentActions,
                Effect: 'Allow',
                Resource: [
                    'arn:aws:s3:::' + awsBucketName + '/*'
                ]
            }
        ],
        Version: '2012-10-17'
    };

    if (!aws.attachInlinePolicyToUser(awsBucketUsername, awsBucketUsernameInlinePolicyName, awsBucketUsernameInlinePolicy, {
        profile: cluster.aws.profile,
        region: cluster.aws.region
    })) {
        return;
    }

    let path = require('path');

    let awsFolder = path.resolve(sourceFolder, '.aws');
    if (!fs.folderExists(awsFolder)) {
        fs.createFolder(awsFolder);
    }

    let awsCredentialsFile = path.resolve(awsFolder, 'credentials');
    let awsConfigFile = path.resolve(awsFolder, 'config');

    cprint.cyan('Setting up AWS files...');

    fs.writeFile(awsCredentialsFile, [
        '[default]',
        `aws_access_key_id = ${bucketUserAccessKey}`,
        `aws_secret_access_key = ${bucketUserSecretKey}`,
        ''
    ].join('\n'), true);

    fs.writeFile(awsConfigFile, [
        '[default]',
        `bucket_location = ${bucketRegion}`,
        ''
    ].join('\n'), true);


    if (service.hasConfigFile(serviceConfig.cwd)) {
        cache.save(serviceConfig.cwd, 'aws', awsCache);
    }

    cprint.magenta('----');
    return true;
}

// ******************************

function awsCreateDeliveryStructure (in_serviceConfig, in_environment) {
    awsCreateRepository(in_serviceConfig, in_environment);

    if (!awsCreateTaskDefinition(in_serviceConfig, false, in_environment)) {
        return;
    }

    if (!awsCreateCluster(in_serviceConfig, in_environment)) {
        return;
    }

    if (!awsCreateClusterService(in_serviceConfig, in_environment)) {
        return;
    }

    return true;
}

// ******************************

function awsCreateRepository (in_serviceConfig, in_environment) {
    let serviceConfig = service.accessConfig(aws.getMergedServiceConfig(in_serviceConfig, in_environment), {
        cwd: 'STRING',
        docker: {
            image: {
                name: 'STRING'
            }
        },
        service: {
            clusters: [
                {
                    aws: {
                        profile: 'STRING',
                        region: 'STRING',
                        image: {
                            name: 'STRING'
                        }
                    },
                    default: 'BOOLEAN',
                    environment: 'STRING'
                }
            ]
        }
    });

    _assertAwsIsInstalled();

    let awsDockerRepositoryUrl = aws.getDockerRepositoryUrl(in_serviceConfig, in_environment);
    if (!awsDockerRepositoryUrl) {
        throw new Error('AWS docker repository not set');
    }

    const cluster = _loadCluster(serviceConfig, in_environment);

    let awsDockerImageName = aws.getDockerImageName(in_serviceConfig, cluster);
    if (!awsDockerImageName) {
        throw new Error('AWS docker image name not set');
    }

    let awsCache = cache.load(serviceConfig.cwd, 'aws');

    cprint.magenta('-- AWS Docker Repository --');
    print.keyVal('AWS Docker Image Name', awsDockerImageName);
    print.keyVal('AWS Docker Repository Url', awsDockerRepositoryUrl);

    let awsDockerRepository = aws.getDockerRepositoryForDockerImageName(awsDockerImageName, {
        cache: awsCache,
        verbose: true,
        profile: cluster.aws.profile,
        region: cluster.aws.region
    });
    if (awsDockerRepository) {
        cprint.green('Repository already exists!');
        return true;
    }

    cprint.cyan('Creating repository...');
    if (!aws.createDockerRepository(awsDockerImageName, {
        profile: cluster.aws.profile,
        region: cluster.aws.region
    })) {
        return;
    }

    if (service.hasConfigFile(serviceConfig.cwd)) {
        cache.save(serviceConfig.cwd, 'aws', awsCache);
    }

    cprint.magenta('----');
    return true;
}

// ******************************

function awsCreateTaskDefinition (in_serviceConfig, in_forceModelUpdate, in_environment) {
    let serviceConfig = service.accessConfig(aws.getMergedServiceConfig(in_serviceConfig, in_environment), {
        cwd: 'STRING',
        model: {
            version: 'STRING',
            dynamic: 'BOOLEAN'
        },
        docker: {
            container: {
                commands: [
                    {
                        local: 'BOOLEAN',
                        val: 'STRING'
                    }
                ],
                environment_variables: [
                    {
                        key: 'STRING',
                        local: 'BOOLEAN',
                        prod: 'BOOLEAN',
                        value: 'STRING'
                    }
                ],
                logging_support: 'BOOLEAN',
                memory_limit: 'NUMBER',
                ports: [
                    {
                        container: 'NUMBER',
                        host: 'NUMBER',
                        local: 'BOOLEAN'
                    }
                ],
                volumes: [
                    {
                        container: 'STRING',
                        host: 'STRING',
                        local: 'BOOLEAN',
                        name: 'STRING'
                    }
                ]
            },
            image: {
                name: 'STRING',
                version: 'STRING'
            }
        },
        service: {
            name: 'STRING',
            clusters: [
                {
                    aws: {
                        account_id: 'STRING',
                        bucket: {
                            name: 'STRING'
                        },
                        profile: 'STRING',
                        region: 'STRING',
                        service_role: 'STRING',
                        image: {
                            name: 'STRING'
                        }
                    },
                    role: 'STRING',
                    default: 'BOOLEAN',
                    environment: 'STRING',
                    task_definition: {
                        name: 'STRING'
                    }
                }
            ]
        }
    });

    _assertAwsIsInstalled();

    let loggingSupport = !!serviceConfig.docker.container.logging_support;

    let serviceName = serviceConfig.service.name;
    if (!serviceName) {
        throw new Error('Service name not set');
    }

    const cluster = _loadCluster(serviceConfig, in_environment);

    let awsDockerImageName = aws.getDockerImageName(in_serviceConfig, cluster);
    if (!awsDockerImageName) {
        throw new Error('AWS docker image name not set');
    }

    let dockerImageVersion = serviceConfig.docker.image.version || 'latest';

    let awsTaskDefinitionName = aws.getAwsTaskDefinitionName(in_serviceConfig, {
        cluster: cluster
    });

    if (!awsTaskDefinitionName) {
        throw new Error('Service task definition name not set');
    }

    let awsDockerRepositoryUrl = aws.getDockerRepositoryUrl(in_serviceConfig, in_environment);
    if (!awsDockerRepositoryUrl) {
        throw new Error('AWS docker repository not set');
    }

    let awsTaskDefinitionImagePath = awsDockerRepositoryUrl + '/' + awsDockerImageName + ':' + dockerImageVersion;
    let awsTaskDefinitionMemoryLimit = serviceConfig.docker.container.memory_limit || 500;

    let awsCache = cache.load(serviceConfig.cwd, 'aws');

    let environment = cluster.environment;

    cprint.magenta('-- Task Definition --');
    print.keyVal('AWS Task Definition Name', awsTaskDefinitionName);
    print.keyVal('AWS Task Definition Image Path', awsTaskDefinitionImagePath);

    print.keyVal('AWS Task Definition Role', '...', true);

    let awsRoleName = aws.getServiceRole(in_serviceConfig, {
        cache: awsCache,
        cluster: cluster,
        verbose: true
    });

    let taskDefinitionRoleArn = false;

    if (awsRoleName) {
        taskDefinitionRoleArn = aws.getRoleArnForRoleName(awsRoleName, {
            cache: awsCache,
            profile: cluster.aws.profile,
            region: cluster.aws.region
        });
        if (!taskDefinitionRoleArn) {
            return;
        }

        print.clearLine();
        print.keyVal('AWS Task Definition Role', taskDefinitionRoleArn);
    }

    let serviceContainerDefinition = {
        'cpu': 0,
        'essential': true,
        'image': awsTaskDefinitionImagePath,
        'memoryReservation': awsTaskDefinitionMemoryLimit,
        'name': 'service',
        'volumesFrom': []
    };

    serviceConfig.docker.container.commands.forEach(command => {
        if (command.local) {
            return;
        }

        serviceContainerDefinition.command = command.val
            .split(' ');
        return;
    });

    let modelVersion = serviceConfig.model.version;
    if (serviceConfig.model.dynamic && !in_forceModelUpdate) {
        let awsTaskDefinitionName = aws.getAwsTaskDefinitionName(in_serviceConfig, {
            cluster: cluster
        });

        if (!awsTaskDefinitionName) {
            throw new Error('Service task definition name not set');
        }

        let lastTaskDefinitionArn = aws.getCurrentTaskDefinitionArnForTaskDefinition(awsTaskDefinitionName, {
            cache: awsCache,
            verbose: true,
            profile: cluster.aws.profile,
            region: cluster.aws.region
        });

        if (lastTaskDefinitionArn) {
            let lastTaskDefinition = aws.getTaskDefinition(lastTaskDefinitionArn, {
                cache: awsCache,
                verbose: true,
                profile: cluster.aws.profile,
                region: cluster.aws.region
            });

            let oldContainerDefinition = awsTaskDefinitionName.replace('-task-definition', '');
            if (lastTaskDefinition) {
                let modelVersionVariable = lastTaskDefinition.containerDefinitions
                    .filter(container => [oldContainerDefinition, 'service'].indexOf(container.name) >= 0)
                    .map(container => container.environment[0])
                    .find(environmentVariable => environmentVariable.name === 'MODEL_VERSION');

                modelVersion = modelVersionVariable ? modelVersionVariable.value : modelVersion;
            }
        }
    }

    let isProdEnv = ['production', 'prod'].indexOf(environment.toLowerCase()) >= 0;

    let environmentVariableReplacements = {};
    environmentVariableReplacements['MODEL_BUCKET'] = 'Unknown';

    let awsBucketName = aws.getAwsBucketName(in_serviceConfig, {
        cache: awsCache,
        cluster: cluster
    });
    if (awsBucketName) {
        environmentVariableReplacements['MODEL_BUCKET'] = `${awsBucketName}`;
    }

    environmentVariableReplacements['SERVICE_NAME'] = serviceConfig.service.name;
    environmentVariableReplacements['SERVICE_VERSION'] = serviceConfig.docker.image.version;
    environmentVariableReplacements['MODEL_VERSION'] = modelVersion;

    serviceContainerDefinition.environment = Object.entries(
        serviceConfig.docker.container.environment_variables
            .filter(environmentVariable => !environmentVariable.local && environmentVariable.key && environmentVariable.value)
            .filter(environmentVariable => isProdEnv || !environmentVariable.prod)
            .map(environmentVariable => {
                return {
                    key: service.replaceConfigReferences(in_serviceConfig, environmentVariable.key),
                    value: service.replaceConfigReferences(in_serviceConfig, environmentVariable.value, environmentVariableReplacements)
                };
            })
            .reduce((arr, environmentVariable) => { arr[environmentVariable.key] = environmentVariable.value; return arr; }, {})
    ) // First filter and reduce to a set of environmentVariables unique by key, then map
        .map(([key, value]) => {
            return {
                'name': key,
                'value': value
            };
        });

    serviceContainerDefinition.portMappings = Object.entries(
        serviceConfig.docker.container.ports
            .filter(port => !port.local && port.host && port.container)
            .reduce((arr, port) => { arr[port.container] = port.host; return arr; }, {})
    ) // First filter and reduce to a set of ports unique by container port, then map
        .map(([container, host]) => {
            return {
                'containerPort': parseInt(container),
                'hostPort': parseInt(host),
                'protocol': 'tcp'
            };
        });

    serviceContainerDefinition.mountPoints = Object.entries(
        serviceConfig.docker.container.volumes
            .filter(volume => !volume.local && volume.container && (volume.name || volume.host))
            .map(volume => {
                return {
                    name: service.replaceConfigReferences(in_serviceConfig, volume.name || volume.host),
                    value: {
                        readOnly: !!volume.readOnly,
                        container: service.replaceConfigReferences(in_serviceConfig, volume.container)
                    }
                };
            })
            .reduce((arr, volume) => { arr[volume.name] = volume.value; return arr; }, {})
    ) // First filter and reduce to a set of volumes unique by volume name, then map
        .map(([name, value]) => {
            return {
                'sourceVolume': name,
                'containerPath': value.container,
                'readOnly': value.readOnly
            };
        });

    let containerVolumes = serviceConfig.docker.container.volumes;

    let containerDefinitions = [serviceContainerDefinition];
    if (loggingSupport) {
        // TODO - remove TM specific filebeat
        let filebeatServiceName = `filebeat-tm-services-${environment}`;
        let awsTaskDefinitionFilebeatImagePath = awsDockerRepositoryUrl + '/' + filebeatServiceName + ':' + 'latest';
        let awsTaskDefinitionFilebeatMemoryLimit = 200;
        let awsTaskDefinitionFilebeatVolumes = [
            {
                'container': '/var/lib/filebeat',
                'host': '/var/lib/filebeat',
                'name': 'filebeat-tm-services-state'
            },
            {
                'container': '/var/log/tm-services/$SERVICE_NAME',
                'host': '/volumes/logs',
                'name': '$SERVICE_NAME-logs'
            },
            {
                'container': '/etc/tm-services',
                'host': '/etc/tm-services',
                'readOnly': true,
                'name': 'tm-services-scripts'
            }
        ];

        let filebeatContainerDefinition = {
            'cpu': 0,
            'environment': [],
            'essential': true,
            'image': awsTaskDefinitionFilebeatImagePath,
            'memoryReservation': awsTaskDefinitionFilebeatMemoryLimit,
            'name': 'filebeat',
            'portMappings': [],
            'volumesFrom': []
        };

        filebeatContainerDefinition.mountPoints = Object.entries(
            awsTaskDefinitionFilebeatVolumes
                .filter(volume => !volume.local && volume.container && (volume.name || volume.host))
                .map(volume => {
                    return {
                        name: service.replaceConfigReferences(in_serviceConfig, volume.name || volume.host),
                        value: {
                            readOnly: !!volume.readOnly,
                            container: service.replaceConfigReferences(in_serviceConfig, volume.container)
                        }
                    };
                })
                .reduce((arr, volume) => { arr[volume.name] = volume.value; return arr; }, {})
        ) // First filter and reduce to a set of volumes unique by volume name, then map
            .map(([name, value]) => {
                return {
                    'sourceVolume': name,
                    'containerPath': value.container,
                    'readOnly': value.readOnly
                };
            });

        containerDefinitions.push(filebeatContainerDefinition);
        containerVolumes = containerVolumes.concat(awsTaskDefinitionFilebeatVolumes);
    }

    let awsTaskDefinitionStructure = {
        'containerDefinitions': containerDefinitions,
        'family': awsTaskDefinitionName,
        'networkMode': 'bridge',
        'placementConstraints': []
    };

    awsTaskDefinitionStructure.volumes = Object.entries(
        containerVolumes
            .filter(volume => !volume.local && volume.container && (volume.name || volume.host))
            .map(volume => {
                return {
                    name: service.replaceConfigReferences(in_serviceConfig, volume.name || volume.host),
                    path: service.replaceConfigReferences(in_serviceConfig, volume.host)
                };
            })
            .reduce((arr, volume) => { arr[volume.name] = volume.path; return arr; }, {})
    ) // First filter and reduce to a set of volumes unique by volume name, then map
        .map(([name, path]) => {
            return {
                'host': {
                    'sourcePath': path
                },
                'name': name
            };
        });

    cprint.cyan('Creating task definition...');

    let args = [
        'ecs',
        'register-task-definition',
        '--cli-input-json',
        JSON.stringify(awsTaskDefinitionStructure)
    ];

    if (taskDefinitionRoleArn) {
        args = args.concat([
            '--task-role-arn', taskDefinitionRoleArn
        ]);
    }

    let cmdResult = aws.cmd(args, {
        profile: cluster.aws.profile,
        region: cluster.aws.region
    });

    if (cmdResult.hasError) {
        cmdResult.throwError();
        return false;
    } else {
        cmdResult.printResult('  ');
        let taskDefinitionArn = (cmdResult.resultObj.taskDefinition || {}).taskDefinitionArn;
        cprint.green('Created task definition "' + taskDefinitionArn + '"');
        aws.clearCachedCurrentTaskDefinitionArnForTaskDefinition(awsTaskDefinitionName, {
            cache: awsCache,
            profile: cluster.aws.profile,
            region: cluster.aws.region
        });
        aws.clearCachedLatestTaskDefinitionArnForTaskDefinition(awsTaskDefinitionName, {
            cache: awsCache,
            profile: cluster.aws.profile,
            region: cluster.aws.region
        });
        aws.clearCachedPreviousTaskDefinitionArnsForTaskDefinition(awsTaskDefinitionName, {
            cache: awsCache,
            profile: cluster.aws.profile,
            region: cluster.aws.region
        });
    }

    if (service.hasConfigFile(serviceConfig.cwd)) {
        cache.save(serviceConfig.cwd, 'aws', awsCache);
    }

    cprint.magenta('----');
    return true;
}

// ******************************

function awsCreateCluster (in_serviceConfig, in_environment) {
    let serviceConfig = service.accessConfig(aws.getMergedServiceConfig(in_serviceConfig, in_environment), {
        cwd: 'STRING',
        service: {
            clusters: [
                {
                    aws: {
                        profile: 'STRING',
                        region: 'STRING'
                    },
                    default: 'BOOLEAN',
                    environment: 'STRING',
                    name: 'STRING'
                }
            ],
            name: 'STRING'
        }
    });

    _assertAwsIsInstalled();

    let serviceName = serviceConfig.service.name;
    if (!serviceName) {
        throw new Error('Service name not set');
    }

    const cluster = _loadCluster(serviceConfig, in_environment);

    let environment = cluster.environment;
    let environmentTitle = str.toTitleCase(environment);

    let awsClusterName = aws.getAwsClusterName(in_serviceConfig, {
        cluster: cluster
    });

    if (!awsClusterName) {
        throw new Error('Cluster name not set');
    }

    let awsCache = cache.load(serviceConfig.cwd, 'aws');

    cprint.magenta('-- AWS ' + environmentTitle + ' Cluster --');
    print.keyVal('AWS ' + environmentTitle + ' Cluster Name', awsClusterName);

    let awsClusterArn = aws.getClusterArnForClusterName(awsClusterName, {
        cache: awsCache,
        profile: cluster.aws.profile,
        region: cluster.aws.region
    });
    if (awsClusterArn) {
        cprint.green('Cluster already exists!');
        return true;
    }

    cprint.cyan('Creating cluster...');
    if (!aws.createCluster(awsClusterName, {
        profile: cluster.aws.profile,
        region: cluster.aws.region
    })) {
        return;
    }

    if (service.hasConfigFile(serviceConfig.cwd)) {
        cache.save(serviceConfig.cwd, 'aws', awsCache);
    }

    cprint.magenta('----');
    return true;
}

// ******************************

function awsCreateClusterService (in_serviceConfig, in_environment) {
    let serviceConfig = service.accessConfig(aws.getMergedServiceConfig(in_serviceConfig, in_environment), {
        cwd: 'STRING',
        docker: {
            container: {
                ports: [
                    {
                        container: 'NUMBER',
                        host: 'NUMBER',
                        local: 'BOOLEAN'
                    }
                ]
            },
            image: {
                name: 'STRING',
                version: 'STRING'
            }
        },
        service: {
            clusters: [
                {
                    auto_scaling_group: {
                        health_check_grace_period: 'NUMBER',
                        count: 'NUMBER'
                    },
                    aws: {
                        profile: 'STRING',
                        region: 'STRING'
                    },
                    default: 'BOOLEAN',
                    environment: 'STRING',
                    tasks: {
                        count: 'NUMBER'
                    },
                    load_balancer: {
                        name: 'STRING'
                    },
                    target_group: {
                        name: 'STRING'
                    },
                    name: 'STRING',
                    role: 'STRING',
                    service_name: 'STRING',
                    task_definition: {
                        name: 'STRING'
                    }
                }
            ],
            name: 'STRING'
        }
    });

    _assertAwsIsInstalled();

    let serviceName = serviceConfig.service.name;
    if (!serviceName) {
        throw new Error('Service name not set');
    }

    const cluster = _loadCluster(serviceConfig, in_environment);

    let awsTaskDefinitionName = aws.getAwsTaskDefinitionName(in_serviceConfig, {
        cluster: cluster
    });

    if (!awsTaskDefinitionName) {
        throw new Error('Service task definition name not set');
    }

    let awsDockerRepositoryUrl = aws.getDockerRepositoryUrl(in_serviceConfig, in_environment);
    if (!awsDockerRepositoryUrl) {
        throw new Error('AWS docker repository not set');
    }

    let environment = cluster.environment;
    let environmentTitle = str.toTitleCase(environment);

    let awsClusterName = aws.getAwsClusterName(in_serviceConfig, {
        cluster: cluster
    });

    if (!awsClusterName) {
        throw new Error('Cluster name not set');
    }

    let awsClusterServiceName = aws.getAwsClusterServiceName(in_serviceConfig, {
        cluster: cluster
    });

    if (!awsClusterServiceName) {
        throw new Error('Cluster service name not set');
    }

    let awsCache = cache.load(serviceConfig.cwd, 'aws');

    let desiredInstanceCount = obj.positiveNumberOr(cluster.auto_scaling_group.count, 0);

    let desiredTaskCount = obj.positiveNumberOr(cluster.tasks.count, 10);
    let minimumTaskCount = obj.positiveNumberOr(cluster.tasks.minimum_count, 1);
    let maximumTaskCount = obj.positiveNumberOr(cluster.tasks.maximum_count, 20);

    let minimumHealthyPercent = desiredTaskCount ? parseInt(minimumTaskCount / desiredTaskCount * 100) : 0;
    let maximumHealthyPercent = desiredTaskCount ? parseInt(maximumTaskCount / desiredTaskCount * 100) : 200;

    if (desiredInstanceCount > desiredTaskCount) {
        throw new Error('Your desired instance count is higher than your desired task count');
    }

    let role = cluster.role || 'ecs-access-elb';

    cprint.magenta('-- AWS ' + environmentTitle + ' Cluster Service --');
    print.keyVal('AWS ' + environmentTitle + ' Cluster Name', awsClusterName);
    print.keyVal('AWS ' + environmentTitle + ' Cluster Service Desired Task Count', desiredTaskCount);
    print.keyVal('AWS ' + environmentTitle + ' Role', role);

    let awsTargetGroupName = aws.getAwsTargetGroupName(in_serviceConfig, {
        cache: awsCache,
        cluster: cluster
    });
    let awsTargetGroupArn;

    if (awsTargetGroupName) {
        print.keyVal('AWS Target Group', '...', true);
        awsTargetGroupArn = aws.getTargetGroupArnForTargetGroupName(awsTargetGroupName, {
            cache: awsCache,
            profile: cluster.aws.profile,
            region: cluster.aws.region
        });
        if (!awsTargetGroupArn) {
            return;
        }

        print.clearLine();
        print.keyVal('AWS Target Group', awsTargetGroupName);
    }

    let loadBalancers = [];

    let awsLoadBalancerName = cluster.load_balancer.name;
    let awsContainerName = 'service';

    if (awsTargetGroupArn || awsLoadBalancerName) {
        serviceConfig.docker.container.ports.forEach(port => {
            if (!port.host || !port.container) {
                return;
            }

            if (port.local) {
                return;
            }

            loadBalancers.push({
                targetGroupArn: awsTargetGroupArn,
                loadBalancerName: awsTargetGroupArn ? undefined : awsLoadBalancerName,
                containerName: awsContainerName,
                containerPort: port.container
            });
        });
    }

    if (loadBalancers.length > 1) {
        loadBalancers = [loadBalancers[0]];
    }

    print.keyVal('AWS ' + environmentTitle + ' Load Balancers', JSON.stringify(loadBalancers, null, 4));

    let healthCheckGracePeriod = cluster.auto_scaling_group.health_check_grace_period || 300;

    print.keyVal('AWS Task Definition', '...', true);
    let taskDefinitionArn = aws.getLatestTaskDefinitionArnForTaskDefinition(awsTaskDefinitionName, {
        cache: awsCache,
        showWarning: true,
        profile: cluster.aws.profile,
        region: cluster.aws.region
    });
    if (!taskDefinitionArn) {
        return;
    }

    print.clearLine();
    print.keyVal('AWS Task Definition', awsTaskDefinitionName);

    let awsClusterServiceArn = aws.getClusterServiceArnForClusterName(awsClusterName, awsClusterServiceName, {
        cache: awsCache,
        profile: cluster.aws.profile,
        region: cluster.aws.region
    });
    if (awsClusterServiceArn) {
        cprint.green('Cluster service already exists!');
        return true;
    }

    cprint.cyan('Creating cluster service...');
    if (!aws.createClusterService({
        name: awsClusterName,
        serviceName: awsClusterServiceName,
        taskDefinitionArn: taskDefinitionArn,
        loadBalancers: loadBalancers,
        desiredCount: desiredTaskCount,
        maximumHealthyPercent: maximumHealthyPercent,
        minimumHealthyPercent: minimumHealthyPercent,
        healthCheckGracePeriod: healthCheckGracePeriod
    }, {
        profile: cluster.aws.profile,
        region: cluster.aws.region
    })) {
        return;
    }

    if (service.hasConfigFile(serviceConfig.cwd)) {
        cache.save(serviceConfig.cwd, 'aws', awsCache);
    }

    cprint.magenta('----');
    return true;
}

// ******************************

function awsCreateEC2AccessECSRole (in_serviceConfig, in_environment) {
    let serviceConfig = service.accessConfig(aws.getMergedServiceConfig(in_serviceConfig, in_environment), {
        cwd: 'STRING',
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

    _assertAwsIsInstalled();

    const cluster = _loadCluster(serviceConfig, in_environment);

    let awsRoleName = 'ecsInstanceRole';

    let awsCache = cache.load(serviceConfig.cwd, 'aws');

    cprint.magenta('-- AWS EC2 Access ECS Role --');
    print.keyVal('AWS Role Name', awsRoleName);

    let awsRoleArn = aws.getRoleArnForRoleName(awsRoleName, {
        cache: awsCache,
        showWarning: false,
        profile: cluster.aws.profile,
        region: cluster.aws.region
    });
    if (awsRoleArn) {
        cprint.green('AWS role already exists!');
        return true;
    }

    let awsRoleDescription = 'Allows EC2 instances to call AWS services on your behalf.';
    let awsRolePolicyDocument = {
        Version: '2012-10-17',
        Statement: [
            {
                Action: 'sts:AssumeRole',
                Effect: 'Allow',
                Principal: {
                    Service: 'ec2.amazonaws.com'
                }
            }
        ]
    };

    cprint.cyan('Creating role...');
    if (!aws.createRole(awsRoleName, awsRoleDescription, awsRolePolicyDocument, {
        profile: cluster.aws.profile,
        region: cluster.aws.region
    })) {
        return;
    }

    let awsEC2ContainerServiceforEC2RolePolicyArn = 'arn:aws:iam::aws:policy/service-role/AmazonEC2ContainerServiceforEC2Role';

    print.keyVal('AWS Role Policy', aws.arnToTitle(awsEC2ContainerServiceforEC2RolePolicyArn));

    cprint.cyan('Attaching role policy...');
    if (!aws.attachRolePolicy(awsRoleName, awsEC2ContainerServiceforEC2RolePolicyArn, {
        profile: cluster.aws.profile,
        region: cluster.aws.region
    })) {
        return;
    }

    let awsInstanceProfileName = awsRoleName;

    print.keyVal('AWS Role Instance Profile', awsInstanceProfileName);

    cprint.cyan('Creating instance profile...');
    if (!aws.createInstanceProfile(awsInstanceProfileName, {
        profile: cluster.aws.profile,
        region: cluster.aws.region
    })) {
        return;
    }

    cprint.cyan('Adding role to instance profile...');
    if (!aws.addRoleToInstanceProfile(awsInstanceProfileName, awsRoleName, {
        profile: cluster.aws.profile,
        region: cluster.aws.region
    })) {
        return;
    }

    if (service.hasConfigFile(serviceConfig.cwd)) {
        cache.save(serviceConfig.cwd, 'aws', awsCache);
    }

    cprint.magenta('----');
    return true;
}

// ******************************

function awsCreateECSAccessELBRole (in_serviceConfig, in_environment) {
    let serviceConfig = service.accessConfig(aws.getMergedServiceConfig(in_serviceConfig, in_environment), {
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
        },
        cwd: 'STRING'
    });

    _assertAwsIsInstalled();

    const cluster = _loadCluster(serviceConfig, in_environment);

    let awsRoleName = 'ecsServiceRole';

    let awsCache = cache.load(serviceConfig.cwd, 'aws');

    cprint.magenta('-- AWS ECS Access ELB Role --');
    print.keyVal('AWS Role Name', awsRoleName);

    let awsRoleArn = aws.getRoleArnForRoleName(awsRoleName, {
        cache: awsCache,
        showWarning: false,
        profile: cluster.aws.profile,
        region: cluster.aws.region
    });
    if (awsRoleArn) {
        cprint.green('AWS role already exists!');
        return true;
    }

    let awsRoleDescription = 'Allows ECS to create and manage AWS resources on your behalf.';
    let awsRolePolicyDocument = {
        Version: '2012-10-17',
        Statement: [
            {
                Action: 'sts:AssumeRole',
                Effect: 'Allow',
                Principal: {
                    Service: 'ecs.amazonaws.com'
                }
            }
        ]
    };

    cprint.cyan('Creating role...');
    if (!aws.createRole(awsRoleName, awsRoleDescription, awsRolePolicyDocument, {
        profile: cluster.aws.profile,
        region: cluster.aws.region
    })) {
        return;
    }

    let awsECSRolePolicyArn = 'arn:aws:iam::aws:policy/service-role/AmazonEC2ContainerServiceRole';

    print.keyVal('AWS Role Policy', aws.arnToTitle(awsECSRolePolicyArn));

    cprint.cyan('Attaching role policy...');
    if (!aws.attachRolePolicy(awsRoleName, awsECSRolePolicyArn, {
        profile: cluster.aws.profile,
        region: cluster.aws.region
    })) {
        return;
    }

    if (service.hasConfigFile(serviceConfig.cwd)) {
        cache.save(serviceConfig.cwd, 'aws', awsCache);
    }

    cprint.magenta('----');
    return true;
}

// ******************************

function awsCleanAll (in_serviceConfig, in_environment) {
    awsCleanInfrastructure(in_serviceConfig, in_environment);
    awsCleanDeliveryStructure(in_serviceConfig, in_environment);
    return true;
}

// ******************************

function awsCleanInfrastructure (in_serviceConfig, in_environment) {
    awsCleanLaunchConfigurations(in_serviceConfig, in_environment);
    return true;
}

// ******************************

function awsCleanLaunchConfigurations (in_serviceConfig, in_environment) {
    let serviceConfig = service.accessConfig(aws.getMergedServiceConfig(in_serviceConfig, in_environment), {
        cwd: 'STRING',
        docker: {
            image: {
                name: 'STRING'
            }
        },
        service: {
            clusters: [
                {
                    auto_scaling_group: {
                        name: 'STRING',
                        subnets: [
                            'STRING'
                        ]
                    },
                    aws: {
                        profile: 'STRING',
                        region: 'STRING'
                    },
                    default: 'BOOLEAN',
                    environment: 'STRING',
                    instance: {
                        tags: [
                            {
                                key: 'STRING',
                                val: 'STRING'
                            }
                        ]
                    },
                    launch_configuration: {
                        name: 'STRING'
                    },
                    load_balancer: {
                        name: 'STRING'
                    },
                    name: 'STRING',
                    vpc_name: 'STRING'
                }
            ],
            name: 'STRING'
        }
    });

    cprint.cyan('Cleaning launch configurations...');

    _assertAwsIsInstalled();

    let serviceName = serviceConfig.service.name;
    if (!serviceName) {
        throw new Error('Service name not set');
    }

    const cluster = _loadCluster(serviceConfig, in_environment);

    let awsLaunchConfigurationTemplateName = cluster.launch_configuration.name;
    if (!awsLaunchConfigurationTemplateName) {
        throw new Error('Launch configuration name not set');
    }

    let awsCache = cache.load(serviceConfig.cwd, 'aws');

    let timestampTagTemplate = '[0-9]{4}-[0-9]{2}-[0-9]{2}-[0-9]{10}';

    let awsLaunchConfigurationNames = aws.getLaunchConfigurationsLike(awsLaunchConfigurationTemplateName + '-' + timestampTagTemplate, {
        cache: awsCache,
        showWarning: true,
        profile: cluster.aws.profile,
        region: cluster.aws.region
    });

    if (!awsLaunchConfigurationNames || !awsLaunchConfigurationNames.length) {
        cprint.green('Nothing to clean up!');
        return true;
    }

    awsLaunchConfigurationNames
        .filter(l => !aws.getAutoScalingGroupForLaunchConfiguration(l, {
            cache: awsCache,
            profile: cluster.aws.profile,
            region: cluster.aws.region,
            verbose: true
        }))
        .forEach(l => {
            aws.deleteLaunchConfiguration(l, {
                profile: cluster.aws.profile,
                region: cluster.aws.region
            });
        });

    aws.clearCachedLaunchConfigurationLike(awsLaunchConfigurationTemplateName + '-' + timestampTagTemplate, {
        cache: awsCache,
        profile: cluster.aws.profile,
        region: cluster.aws.region
    });
    aws.clearCachedLaunchConfigurationsLike(awsLaunchConfigurationTemplateName + '-' + timestampTagTemplate, {
        cache: awsCache,
        profile: cluster.aws.profile,
        region: cluster.aws.region
    });

    if (service.hasConfigFile(serviceConfig.cwd)) {
        cache.save(serviceConfig.cwd, 'aws', awsCache);
    }

    return true;
}

// ******************************

function awsCleanDeliveryStructure (in_serviceConfig, in_environment) {
    awsCleanRepository(in_serviceConfig, in_environment);
    awsCleanTaskDefinitions(in_serviceConfig, in_environment);
    return true;
}

// ******************************

function awsCleanRepository (in_serviceConfig, in_environment) {
    let serviceConfig = service.accessConfig(aws.getMergedServiceConfig(in_serviceConfig, in_environment),{
        cwd: 'STRING',
        docker: {
            image: {
                name: 'STRING'
            }
        },
        service: {
            clusters: [
                {
                    aws: {
                        profile: 'STRING',
                        region: 'STRING',
                        image: {
                            name: 'STRING'
                        }
                    },
                    default: 'BOOLEAN',
                    environment: 'STRING'
                }
            ]
        }
    });

    cprint.cyan('Cleaning repositories...');

    _assertAwsIsInstalled();

    const cluster = _loadCluster(serviceConfig, in_environment);

    let awsDockerImageName = aws.getDockerImageName(in_serviceConfig, cluster);
    if (!awsDockerImageName) {
        throw new Error('AWS docker image name not set');
    }

    let awsDockerRepositoryUrl = aws.getDockerRepositoryUrl(in_serviceConfig, in_environment);
    if (!awsDockerRepositoryUrl) {
        throw new Error('AWS docker repository not set');
    }

    let awsCache = cache.load(serviceConfig.cwd, 'aws');

    let awsDockerRepository = aws.getDockerRepositoryForDockerImageName(awsDockerImageName, {
        cache: awsCache,
        verbose: true,
        profile: cluster.aws.profile,
        region: cluster.aws.region
    });
    if (!awsDockerRepository) {
        throw new Error('Repository does not exist!');
    }

    let awsDockerRepositoryImages = aws.getDockerRepositoryImagesForRepositoryName(awsDockerRepository, {
        cache: awsCache,
        verbose: true,
        profile: cluster.aws.profile,
        region: cluster.aws.region
    });
    if (!awsDockerRepositoryImages) {
        throw new Error('Failed to get repository images!');
    }

    let awsDockerRepositoryImagesWithoutTags = awsDockerRepositoryImages
        .filter(i => !i.imageTags || !i.imageTags.length)
        .map(i => i.imageDigest);

    if (!awsDockerRepositoryImagesWithoutTags || !awsDockerRepositoryImagesWithoutTags.length) {
        cprint.green('Nothing to clean up!');
        return true;
    }

    aws.deleteDockerRepositoryImages(awsDockerRepository, awsDockerRepositoryImagesWithoutTags, {
        profile: cluster.aws.profile,
        region: cluster.aws.region
    });

    aws.clearCachedDockerRepositoryImagesForRepositoryName(awsDockerRepository, {
        cache: awsCache,
        profile: cluster.aws.profile,
        region: cluster.aws.region
    });

    if (service.hasConfigFile(serviceConfig.cwd)) {
        cache.save(serviceConfig.cwd, 'aws', awsCache);
    }

    cprint.magenta('----');
    return true;
}

// ******************************

function awsCleanTaskDefinitions (in_serviceConfig, in_environment) {
    let serviceConfig = service.accessConfig(aws.getMergedServiceConfig(in_serviceConfig, in_environment), {
        cwd: 'STRING',
        service: {
            name: 'STRING',
            clusters: [
                {
                    aws: {
                        profile: 'STRING',
                        region: 'STRING'
                    },
                    default: 'BOOLEAN',
                    environment: 'STRING',
                    task_definition: {
                        name: 'STRING'
                    }
                }
            ]
        }
    });

    cprint.cyan('Cleaning task definitions...');

    _assertAwsIsInstalled();

    let serviceName = serviceConfig.service.name;
    if (!serviceName) {
        throw new Error('Service name not set');
    }

    const cluster = _loadCluster(serviceConfig, in_environment);

    let awsTaskDefinitionName = aws.getAwsTaskDefinitionName(in_serviceConfig, {
        cluster: cluster
    });

    if (!awsTaskDefinitionName) {
        throw new Error('Service task definition name not set');
    }

    let awsCache = cache.load(serviceConfig.cwd, 'aws');

    let taskDefinitionArns = aws.getPreviousTaskDefinitionArnsForTaskDefinition(awsTaskDefinitionName, {
        cache: awsCache,
        verbose: true,
        profile: cluster.aws.profile,
        region: cluster.aws.region
    });

    if (!taskDefinitionArns || !taskDefinitionArns.length) {
        cprint.green('Nothing to clean up!');
        return true;
    }

    taskDefinitionArns
        .forEach(t => {
            aws.deregisterTaskDefinition(t, {
                profile: cluster.aws.profile,
                region: cluster.aws.region
            });
        });

    if (service.hasConfigFile(serviceConfig.cwd)) {
        cache.save(serviceConfig.cwd, 'aws', awsCache);
    }
    return true;
}

// ******************************

function awsUpdateAutoScalingGroup (in_serviceConfig, in_environment) {
    let serviceConfig = service.accessConfig(aws.getMergedServiceConfig(in_serviceConfig, in_environment), {
        cwd: 'STRING',
        docker: {
            image: {
                name: 'STRING'
            }
        },
        service: {
            clusters: [
                {
                    auto_scaling_group: {
                        count: 'NUMBER',
                        health_check_grace_period: 'NUMBER',
                        name: 'STRING',
                        subnets: [
                            'STRING'
                        ]
                    },
                    aws: {
                        profile: 'STRING',
                        region: 'STRING',
                        image: {
                            name: 'STRING'
                        }
                    },
                    default: 'BOOLEAN',
                    environment: 'STRING',
                    instance: {
                        tags: [
                            {
                                key: 'STRING',
                                val: 'STRING'
                            }
                        ]
                    },
                    launch_configuration: {
                        name: 'STRING'
                    },
                    load_balancer: {
                        name: 'STRING'
                    },
                    name: 'STRING',
                    vpc_name: 'STRING'
                }
            ],
            name: 'STRING'
        }
    });

    _assertAwsIsInstalled();

    let serviceName = serviceConfig.service.name;
    if (!serviceName) {
        throw new Error('Service name not set');
    }

    const cluster = _loadCluster(serviceConfig, in_environment);

    let awsDockerImageName = aws.getDockerImageName(in_serviceConfig, cluster);
    if (!awsDockerImageName) {
        throw new Error('AWS docker image name not set');
    }

    let environment = cluster.environment;
    let environmentTitle = str.toTitleCase(environment);

    let awsLaunchConfigurationTemplateName = cluster.launch_configuration.name;
    if (!awsLaunchConfigurationTemplateName) {
        throw new Error('Launch configuration name not set');
    }

    let awsAutoScalingGroupName = aws.getAwsAutoScalingGroupName(in_serviceConfig, {
        cache: awsCache,
        cluster: cluster
    });
    if (!awsAutoScalingGroupName) {
        throw new Error('Auto scaling group name not set');
    }

    let awsVpcName = cluster.vpc_name;
    if (!awsVpcName) {
        throw new Error('VPC name not set');
    }

    let awsVpcSubnetNames = (cluster.auto_scaling_group.subnets || []);
    if (!awsVpcSubnetNames.length) {
        throw new Error('No VPC subnet names set');
    }

    let healthCheckGracePeriod = cluster.auto_scaling_group.health_check_grace_period || 300;

    let awsLoadBalancerName = cluster.load_balancer.name;

    let awsCache = cache.load(serviceConfig.cwd, 'aws');

    let desiredInstanceCount = obj.positiveNumberOr(cluster.auto_scaling_group.count, 0);

    let awsAutoScalingGroupMinSize = 0;
    let awsAutoScalingGroupMaxSize = desiredInstanceCount + 2;

    cprint.magenta('-- Auto Scaling Group --');

    print.keyVal('AWS ' + environmentTitle + ' Auto Scaling Group', awsAutoScalingGroupName);

    let timestampTagTemplate = '[0-9]{4}-[0-9]{2}-[0-9]{2}-[0-9]{10}';

    print.keyVal('AWS ' + environmentTitle + ' Launch Configuration', '...', true);
    let awsLaunchConfigurationName = aws.getLaunchConfigurationLike(awsLaunchConfigurationTemplateName + '-' + timestampTagTemplate, {
        cache: awsCache,
        showWarning: true,
        profile: cluster.aws.profile,
        region: cluster.aws.region
    });
    if (!awsLaunchConfigurationName) {
        return;
    }
    print.clearLine();
    print.keyVal('AWS ' + environmentTitle + ' Launch Configuration', awsLaunchConfigurationName);

    print.keyVal('AWS ' + environmentTitle + ' VPC Name', awsVpcName);

    print.keyVal('AWS ' + environmentTitle + ' VPC Id', '...', true);
    let awsVpcId = aws.getVpcIdForVpc(awsVpcName, {
        cache: awsCache,
        showWarning: true,
        profile: cluster.aws.profile,
        region: cluster.aws.region
    });
    if (!awsVpcId) {
        return;
    }
    print.clearLine();
    print.keyVal('AWS ' + environmentTitle + ' VPC Id', awsVpcId);

    let awsVpcSubnetIdsFound = true;
    let awsVpcSubnetIds = awsVpcSubnetNames
        .map(awsVpcSubnetName => {
            print.keyVal('AWS ' + environmentTitle + ' VPC "' + awsVpcSubnetName + '" Subnet Id', '...', true);
            let awsVpcSubnetId = aws.getVpcSubnetIdForVpc(awsVpcId, awsVpcSubnetName, {
                cache: awsCache,
                profile: cluster.aws.profile,
                region: cluster.aws.region
            });
            if (!awsVpcSubnetId) {
                awsVpcSubnetIdsFound = false;
                return;
            }
            print.clearLine();
            print.keyVal('AWS ' + environmentTitle + ' VPC "' + awsVpcSubnetName + '" Subnet Id', awsVpcSubnetId);
            return awsVpcSubnetId;
        });

    if (!awsVpcSubnetIdsFound) {
        return;
    }

    cprint.cyan('Updating auto scaling group...');

    let tagsDict = {
        Environment: environment,
        ServiceName: serviceName,
        Name: serviceName + '-group-instance'
    };

    if (awsDockerImageName) {
        tagsDict.DockerImageName = awsDockerImageName;
    }

    let clusterTags = cluster.instance.tags || [];
    clusterTags.forEach(t => {
        tagsDict[t.key] = t.val;
    });

    let args = [
        'autoscaling',
        'update-auto-scaling-group',

        '--auto-scaling-group-name',
        awsAutoScalingGroupName,

        '--launch-configuration-name',
        awsLaunchConfigurationName,

        '--min-size',
        awsAutoScalingGroupMinSize,

        '--max-size',
        awsAutoScalingGroupMaxSize,

        '--vpc-zone-identifier',
        awsVpcSubnetIds.join(','),

        '--health-check-grace-period',
        healthCheckGracePeriod,

        '--termination-policies',
        'OldestInstance'
    ];

    let cmdResult = aws.cmd(args, {
        profile: cluster.aws.profile,
        region: cluster.aws.region
    });
    if (cmdResult.hasError) {
        cmdResult.throwError();
        return false;
    } else {
        cmdResult.printResult('  ');
        cprint.green('Updated auto scaling group');
    }

    if (awsLoadBalancerName) {
        let args = [
            'autoscaling',
            'attach-load-balancers',

            '--auto-scaling-group-name',
            awsAutoScalingGroupName,

            '--load-balancer-names',
            awsLoadBalancerName
        ];

        let cmdResult = aws.cmd(args, {
            profile: cluster.aws.profile,
            region: cluster.aws.region
        });
        if (cmdResult.hasError) {
            cmdResult.throwError();
            return false;
        } else {
            cmdResult.printResult('  ');
            cprint.green('Added load balancer to auto scaling group');
        }
    }

    aws.clearCachedAutoScalingGroups({
        cache: awsCache,
        profile: cluster.aws.profile,
        region: cluster.aws.region
    });

    if (service.hasConfigFile(serviceConfig.cwd)) {
        cache.save(serviceConfig.cwd, 'aws', awsCache);
    }

    cprint.magenta('----');
    return true;
}

// ******************************

function awsLogin (in_serviceConfig, in_environment) {
    service.accessConfig(aws.getMergedServiceConfig(in_serviceConfig, in_environment), {});
    cprint.green('Successfully logged in!');
    return true;
}

// ******************************

function awsDockerLogin (in_serviceConfig, in_environment) {
    _assertAwsIsInstalled();
    _assertDockerIsInstalled();
    _assertDockerIsRunning();

    let awsDockerCredentials = aws.getDockerCredentials(in_serviceConfig, {
        environment: in_environment
    });

    if (!awsDockerCredentials) {
        throw new Error('Failed to get AWS Docker credentials');
    }

    let awsDockerRepositoryUrl = aws.getDockerRepositoryUrl(in_serviceConfig, in_environment);
    if (!awsDockerRepositoryUrl) {
        throw new Error('AWS docker repository not set');
    }

    if (docker.isLoggedIn(awsDockerRepositoryUrl)) {
        return awsDockerCredentials;
    }

    let success = docker.login(awsDockerCredentials.username, awsDockerCredentials.password, awsDockerRepositoryUrl);
    if (!success) {
        throw new Error('Check your regions match in your .aws/config and service.json');
    }

    return awsDockerCredentials;
}

// ******************************

function awsStartCluster (in_serviceConfig, in_environment) {
    let serviceConfig = service.accessConfig(aws.getMergedServiceConfig(in_serviceConfig, in_environment), {
        cwd: 'STRING',
        service: {
            clusters: [
                {
                    auto_scaling_group: {
                        count: 'NUMBER',
                        name: 'STRING'
                    },
                    aws: {
                        profile: 'STRING',
                        region: 'STRING'
                    },
                    default: 'BOOLEAN',
                    environment: 'STRING'
                }
            ],
            name: 'STRING'
        }
    });

    _assertAwsIsInstalled();

    let awsCache = cache.load(serviceConfig.cwd, 'aws');

    let serviceName = serviceConfig.service.name;
    if (!serviceName) {
        throw new Error('Service name not set');
    }

    const cluster = _loadCluster(serviceConfig, in_environment);

    let awsAutoScalingGroupName = aws.getAwsAutoScalingGroupName(in_serviceConfig, {
        cache: awsCache,
        cluster: cluster
    });
    if (!awsAutoScalingGroupName) {
        throw new Error('Auto scaling group name not set');
    }

    let desiredInstanceCount = obj.positiveNumberOr(cluster.auto_scaling_group.count, 0);
    if (desiredInstanceCount === 0) {
        throw new Error('Your desired instance count is 0');
    }

    let autoScalingGroupInstanceCount = aws.getAutoScalingGroupInstanceCount(awsAutoScalingGroupName, {
        profile: cluster.aws.profile,
        region: cluster.aws.region,
        showWarning: true
    });
    if (autoScalingGroupInstanceCount < 0) {
        throw new Error('AWS cluster doesn\'t exist');
    }

    if (autoScalingGroupInstanceCount == 0) {
        cprint.cyan('Starting AWS cluster...');
        aws.setAutoScalingGroupInstanceCount(awsAutoScalingGroupName, desiredInstanceCount, {
            cache: awsCache,
            profile: cluster.aws.profile,
            region: cluster.aws.region
        });
    } else if (autoScalingGroupInstanceCount != desiredInstanceCount) {
        cprint.cyan('Updating AWS cluster...');
        aws.setAutoScalingGroupInstanceCount(awsAutoScalingGroupName, desiredInstanceCount, {
            cache: awsCache,
            profile: cluster.aws.profile,
            region: cluster.aws.region
        });
    } else {
        cprint.green('AWS cluster already started');
    }

    if (service.hasConfigFile(serviceConfig.cwd)) {
        cache.save(serviceConfig.cwd, 'aws', awsCache);
    }
}

// ******************************

function awsStopCluster (in_serviceConfig, in_environment) {
    let serviceConfig = service.accessConfig(aws.getMergedServiceConfig(in_serviceConfig, in_environment), {
        cwd: 'STRING',
        service: {
            clusters: [
                {
                    auto_scaling_group: {
                        name: 'STRING'
                    },
                    aws: {
                        profile: 'STRING',
                        region: 'STRING'
                    },
                    default: 'BOOLEAN',
                    environment: 'STRING'
                }
            ],
            name: 'STRING'
        }
    });

    _assertAwsIsInstalled();

    let awsCache = cache.load(serviceConfig.cwd, 'aws');

    let serviceName = serviceConfig.service.name;
    if (!serviceName) {
        throw new Error('Service name not set');
    }

    const cluster = _loadCluster(serviceConfig, in_environment);

    let awsAutoScalingGroupName = aws.getAwsAutoScalingGroupName(in_serviceConfig, {
        cache: awsCache,
        cluster: cluster
    });
    if (!awsAutoScalingGroupName) {
        throw new Error('Auto scaling group name not set');
    }

    let autoScalingGroupInstanceCount = aws.getAutoScalingGroupInstanceCount(awsAutoScalingGroupName, {
        profile: cluster.aws.profile,
        region: cluster.aws.region,
        showWarning: true
    });
    if (autoScalingGroupInstanceCount < 0) {
        throw new Error('AWS cluster doesn\'t exist');
    }

    if (autoScalingGroupInstanceCount > 0) {
        cprint.cyan('Stopping AWS cluster...');
        aws.setAutoScalingGroupInstanceCount(awsAutoScalingGroupName, 0, {
            cache: awsCache,
            profile: cluster.aws.profile,
            region: cluster.aws.region
        });
    } else {
        cprint.green('AWS cluster already stopped');
    }

    if (service.hasConfigFile(serviceConfig.cwd)) {
        cache.save(serviceConfig.cwd, 'aws', awsCache);
    }
}

// ******************************

function awsSetInstanceAmi (in_serviceConfig, in_environment, in_ami) {
    let serviceConfig = service.accessConfig(aws.getMergedServiceConfig(in_serviceConfig, in_environment), {
        service: {
            clusters: [
                {
                    environment: 'STRING',
                    instance: {
                        ami: 'STRING'
                    }
                }
            ]
        },
        cwd: 'STRING'
    });

    if (!in_ami) {
        throw new Error('Instance AMI not provided');
    }

    if (!in_ami.match(/ami-[a-f0-9]{8}/)) {
        throw new Error('Instance AMI not valid a AMI id: ' + in_ami);
    }

    let clusters = serviceConfig.service.clusters || [];

    if (in_environment) {
        let environmentCluster = clusters.find(c => {
            return c.environment === in_environment;
        });
        if (environmentCluster) {
            environmentCluster.instance.ami = in_ami;
        }
        service.updateConfig(in_serviceConfig, serviceConfig);
    } else {
        clusters.forEach(c => {
            c.instance.ami = in_ami;
        });
        service.updateConfig(in_serviceConfig, serviceConfig);
    }
}

// ******************************

function awsSetInstanceCount (in_serviceConfig, in_environment, in_count) {
    let serviceConfig = service.accessConfig(aws.getMergedServiceConfig(in_serviceConfig, in_environment), {
        service: {
            clusters: [
                {
                    environment: 'STRING',
                    auto_scaling_group: {
                        count: 'NUMBER'
                    }
                }
            ]
        },
        cwd: 'STRING'
    });

    if (!in_count) {
        throw new Error('Instance count not provided');
    }

    let count = parseInt(in_count);
    if (isNaN(count) || count < 0) {
        throw new Error('Instance count not a valid positive number: ' + in_count);
    }

    let clusters = serviceConfig.service.clusters || [];

    if (in_environment) {
        let environmentCluster = clusters.find(c => {
            return c.environment === in_environment;
        });
        if (environmentCluster) {
            environmentCluster.auto_scaling_group.count = count;
        }
        service.updateConfig(in_serviceConfig, serviceConfig);
    } else {
        clusters.forEach(c => {
            c.auto_scaling_group.count = count;
        });
        service.updateConfig(in_serviceConfig, serviceConfig);
    }
}

// ******************************

function awsSetInstanceType (in_serviceConfig, in_environment, in_type) {
    let serviceConfig = service.accessConfig(aws.getMergedServiceConfig(in_serviceConfig, in_environment), {
        service: {
            clusters: [
                {
                    environment: 'STRING',
                    instance: {
                        type: 'STRING'
                    }
                }
            ]
        },
        cwd: 'STRING'
    });

    if (!in_type) {
        throw new Error('Instance type not provided');
    }

    if (awsInstanceTypes.ALL.indexOf(in_type) < 0) {
        throw new Error('Instance type not valid: ' + in_type);
    }

    let clusters = serviceConfig.service.clusters || [];

    if (in_environment) {
        let environmentCluster = clusters.find(c => {
            return c.environment === in_environment;
        });
        if (environmentCluster) {
            environmentCluster.instance.type = in_type;
        }
        service.updateConfig(in_serviceConfig, serviceConfig);
    } else {
        clusters.forEach(c => {
            c.instance.type = in_type;
        });
        service.updateConfig(in_serviceConfig, serviceConfig);
    }
}

// ******************************

function awsViewConsoleLogin (in_serviceConfig, in_environment) {
    let serviceConfig = service.accessConfig(aws.getMergedServiceConfig(in_serviceConfig, in_environment), {
        service: {
            clusters: [
                {
                    aws: {
                        account_id: 'STRING'
                    },
                    default: 'BOOLEAN',
                    environment: 'STRING'
                }
            ]
        }
    });

    const cluster = _loadCluster(serviceConfig, in_environment);

    let awsAccountId = cluster.aws.account_id || false;

    let url = `${awsAccountId}.signin.aws.amazon.com/console`;
    url = 'https://' + url;
    print.out(cprint.toMagenta('Opening Url: ') + cprint.toGreen(url) + '\n');
    _openUrl(url);
    return true;
}

// ******************************

function awsViewAll (in_serviceConfig, in_environment) {
    let serviceConfig = service.accessConfig(aws.getMergedServiceConfig(in_serviceConfig, in_environment), {
        service: {
            name: 'STRING',
            clusters: [
                {
                    aws: {
                        bucket: {
                            name: 'STRING',
                            username: 'STRING'
                        }
                    },
                    default: 'BOOLEAN',
                    environment: 'STRING',
                    url: 'URL'
                }
            ]
        }
    });


    const cluster = _loadCluster(serviceConfig, in_environment);

    awsViewInfrastructure(in_serviceConfig, in_environment);
    awsViewDeliveryStructure(in_serviceConfig, in_environment);

    if (cluster.aws.bucket.name) {
        awsViewBucket(in_serviceConfig, in_environment);
    }

    if (cluster.aws.bucket.username) {
        awsViewBucketUser(in_serviceConfig, in_environment);
    }

    if (cluster.url) {
        awsViewEndpoint(in_serviceConfig, in_environment);
    }
}

// ******************************

function awsViewInfrastructure (in_serviceConfig, in_environment) {
    let serviceConfig = service.accessConfig(aws.getMergedServiceConfig(in_serviceConfig, in_environment), {
        service: {
            name: 'STRING',
            clusters: [
                {
                    auto_scaling_group: {
                        name: 'STRING'
                    },
                    default: 'BOOLEAN',
                    environment: 'STRING',
                    launch_configuration: {
                        name: 'STRING'
                    },
                    load_balancer: {
                        name: 'STRING'
                    }
                }
            ]
        }
    });


    const cluster = _loadCluster(serviceConfig, in_environment);

    if (service.name) {
        awsViewInstances(in_serviceConfig, in_environment);
    }

    if (cluster.load_balancer.name) {
        awsViewLoadBalancer(in_serviceConfig, in_environment);
    }

    if (cluster.launch_configuration.name) {
        awsViewLaunchConfiguration(in_serviceConfig, in_environment);
    }

    if (cluster.auto_scaling_group.name) {
        awsViewAutoScalingGroup(in_serviceConfig, in_environment);
    }
}

// ******************************

function awsViewInstances (in_serviceConfig, in_environment) {
    let serviceConfig = service.accessConfig(aws.getMergedServiceConfig(in_serviceConfig, in_environment), {
        service: {
            clusters: [
                {
                    aws: {
                        region: 'STRING'
                    },
                    default: 'BOOLEAN',
                    environment: 'STRING',
                    role: 'STRING'
                }
            ],
            name: 'STRING'
        }
    });

    const cluster = _loadCluster(serviceConfig, in_environment);

    let environment = cluster.environment;

    let serviceName = serviceConfig.service.name;
    if (!serviceName) {
        throw new Error('Service name not set');
    }

    let awsRegion = cluster.aws.region;
    let serviceKey = 'Service';

    let url = `${awsRegion}.console.aws.amazon.com/ec2/v2/home?region=${awsRegion}#Instances:tag:Environment=${environment};tag:${serviceKey}=${serviceName}`;
    url = 'https://' + url;
    print.out(cprint.toMagenta('Opening Url: ') + cprint.toGreen(url) + '\n');
    _openUrl(url);
    return true;
}

// ******************************

function awsViewLoadBalancer (in_serviceConfig, in_environment) {
    let serviceConfig = service.accessConfig(aws.getMergedServiceConfig(in_serviceConfig, in_environment), {
        service: {
            clusters: [
                {
                    aws: {
                        region: 'STRING'
                    },
                    default: 'BOOLEAN',
                    environment: 'STRING',
                    load_balancer: {
                        name: 'STRING'
                    }
                }
            ]
        }
    });

    const cluster = _loadCluster(serviceConfig, in_environment);

    let awsLoadBalancerName = cluster.load_balancer.name;
    if (!awsLoadBalancerName) {
        throw new Error('Load balancer name not set');
    }

    let awsRegion = cluster.aws.region;

    let url = `${awsRegion}.console.aws.amazon.com/ec2/v2/home?region=${awsRegion}#LoadBalancers:search=${awsLoadBalancerName}`;
    url = 'https://' + url;
    print.out(cprint.toMagenta('Opening Url: ') + cprint.toGreen(url) + '\n');
    _openUrl(url);
    return true;
}

// ******************************

function awsViewLaunchConfiguration (in_serviceConfig, in_environment) {
    let serviceConfig = service.accessConfig(aws.getMergedServiceConfig(in_serviceConfig, in_environment), {
        service: {
            clusters: [
                {
                    aws: {
                        profile: 'STRING',
                        region: 'STRING'
                    },
                    default: 'BOOLEAN',
                    environment: 'STRING',
                    launch_configuration: {
                        name: 'STRING'
                    }
                }
            ]
        }
    });

    const cluster = _loadCluster(serviceConfig, in_environment);

    let awsLaunchConfigurationName = cluster.launch_configuration.name;
    if (!awsLaunchConfigurationName) {
        throw new Error('Launch configuration name not set');
    }

    let awsRegion = cluster.aws.region;

    let url = `${awsRegion}.console.aws.amazon.com/ec2/autoscaling/home?region=${awsRegion}#LaunchConfigurations:id=${awsLaunchConfigurationName};filter=${awsLaunchConfigurationName}`;
    url = 'https://' + url;
    print.out(cprint.toMagenta('Opening Url: ') + cprint.toGreen(url) + '\n');
    _openUrl(url);
    return true;
}

// ******************************

function awsViewAutoScalingGroup (in_serviceConfig, in_environment) {
    let serviceConfig = service.accessConfig(aws.getMergedServiceConfig(in_serviceConfig, in_environment), {
        cwd: 'STRING',
        service: {
            clusters: [
                {
                    auto_scaling_group: {
                        name: 'STRING'
                    },
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

    let awsCache = cache.load(serviceConfig.cwd, 'aws');

    const cluster = _loadCluster(serviceConfig, in_environment);

    let awsAutoScalingGroupName = aws.getAwsAutoScalingGroupName(in_serviceConfig, {
        cache: awsCache,
        cluster: cluster
    });
    if (!awsAutoScalingGroupName) {
        throw new Error('Auto scaling group name not set');
    }

    let awsRegion = cluster.aws.region;

    let url = `${awsRegion}.console.aws.amazon.com/ec2/autoscaling/home?region=${awsRegion}#AutoScalingGroups:id=${awsAutoScalingGroupName};filter=${awsAutoScalingGroupName}`;
    url = 'https://' + url;
    print.out(cprint.toMagenta('Opening Url: ') + cprint.toGreen(url) + '\n');
    _openUrl(url);

    if (service.hasConfigFile(serviceConfig.cwd)) {
        cache.save(serviceConfig.cwd, 'aws', awsCache);
    }

    return true;
}

// ******************************

function awsViewDeliveryStructure (in_serviceConfig, in_environment) {
    let serviceConfig = service.accessConfig(aws.getMergedServiceConfig(in_serviceConfig, in_environment), {
        docker: {
            image: {
                name: 'STRING'
            }
        },
        service: {
            name: 'STRING',
            clusters: [
                {
                    default: 'BOOLEAN',
                    environment: 'STRING',
                    task_definition: {
                        name: 'STRING'
                    },
                    name: 'STRING',
                    service_name: 'STRING'
                }
            ]
        }
    });


    const cluster = _loadCluster(serviceConfig, in_environment);

    if (serviceConfig.docker.image.name) {
        awsViewRepository(in_serviceConfig, in_environment);
    }

    if (cluster.task_definition.name) {
        awsViewTaskDefinition(in_serviceConfig, in_environment);
    }

    if (cluster.name) {
        awsViewCluster(in_serviceConfig, in_environment);
    }

    if (cluster.service_name) {
        awsViewClusterService(in_serviceConfig, in_environment);
    }
}

// ******************************

function awsViewRepository (in_serviceConfig, in_environment) {
    let serviceConfig = service.accessConfig(aws.getMergedServiceConfig(in_serviceConfig, in_environment), {
        docker: {
            image: {
                name: 'STRING'
            }
        },
        service: {
            clusters: [
                {
                    aws: {
                        image: {
                            name: 'STRING'
                        },
                        profile: 'STRING',
                        region: 'STRING'
                    },
                    default: 'BOOLEAN',
                    environment: 'STRING'
                }
            ]
        }
    });

    _assertAwsIsInstalled();

    const cluster = _loadCluster(serviceConfig, in_environment);

    let awsDockerImageName = aws.getDockerImageName(in_serviceConfig, cluster);
    if (!awsDockerImageName) {
        throw new Error('AWS docker image name not set');
    }

    let awsRegion = cluster.aws.region;

    let url = `${awsRegion}.console.aws.amazon.com/ecs/home?region=${awsRegion}#/repositories/${awsDockerImageName}#images;tagStatus=ALL`;
    url = 'https://' + url;
    print.out(cprint.toMagenta('Opening Url: ') + cprint.toGreen(url) + '\n');
    _openUrl(url);
    return true;
}

// ******************************

function awsViewTaskDefinition (in_serviceConfig, in_environment) {
    let serviceConfig = service.accessConfig(aws.getMergedServiceConfig(in_serviceConfig, in_environment), {
        service: {
            clusters: [
                {
                    aws: {
                        profile: 'STRING',
                        region: 'STRING'
                    },
                    default: 'BOOLEAN',
                    environment: 'STRING',
                    task_definition: {
                        name: 'STRING'
                    }
                }
            ]
        }
    });

    _assertAwsIsInstalled();

    const cluster = _loadCluster(serviceConfig, in_environment);

    let awsTaskDefinitionName = aws.getAwsTaskDefinitionName(in_serviceConfig, {
        cluster: cluster
    });

    if (!awsTaskDefinitionName) {
        throw new Error('Service task definition name not set');
    }

    let awsRegion = cluster.aws.region;

    let url = `${awsRegion}.console.aws.amazon.com/ecs/home?region=${awsRegion}#/taskDefinitions/${awsTaskDefinitionName}/latest`;
    url = 'https://' + url;
    print.out(cprint.toMagenta('Opening Url: ') + cprint.toGreen(url) + '\n');
    _openUrl(url);
    return true;
}

// ******************************

function awsViewCluster (in_serviceConfig, in_environment) {
    let serviceConfig = service.accessConfig(aws.getMergedServiceConfig(in_serviceConfig, in_environment), {
        service: {
            clusters: [
                {
                    aws: {
                        profile: 'STRING',
                        region: 'STRING'
                    },
                    default: 'BOOLEAN',
                    environment: 'STRING',
                    name: 'STRING',
                }
            ]
        }
    });

    const cluster = _loadCluster(serviceConfig, in_environment);

    let awsRegion = cluster.aws.region;
    let awsClusterName = aws.getAwsClusterName(in_serviceConfig, {
        cluster: cluster
    });

    let url = `${awsRegion}.console.aws.amazon.com/ecs/home?region=${awsRegion}#/clusters/${awsClusterName}/tasks`;
    url = 'https://' + url;
    print.out(cprint.toMagenta('Opening Url: ') + cprint.toGreen(url) + '\n');
    _openUrl(url);
    return true;
}

// ******************************

function awsViewClusterService (in_serviceConfig, in_environment) {
    let serviceConfig = service.accessConfig(aws.getMergedServiceConfig(in_serviceConfig, in_environment), {
        service: {
            clusters: [
                {
                    aws: {
                        profile: 'STRING',
                        region: 'STRING'
                    },
                    default: 'BOOLEAN',
                    environment: 'STRING',
                    name: 'STRING',
                    service_name: 'STRING'
                }
            ]
        }
    });

    const cluster = _loadCluster(serviceConfig, in_environment);

    let awsRegion = cluster.aws.region;
    let awsClusterName = aws.getAwsClusterName(in_serviceConfig, {
        cluster: cluster
    });

    let awsClusterServiceName = aws.getAwsClusterServiceName(in_serviceConfig, {
        cluster: cluster
    });


    let url = `${awsRegion}.console.aws.amazon.com/ecs/home?region=${awsRegion}#/clusters/${awsClusterName}/services/${awsClusterServiceName}/tasks`;
    url = 'https://' + url;
    print.out(cprint.toMagenta('Opening Url: ') + cprint.toGreen(url) + '\n');
    _openUrl(url);
    return true;
}

// ******************************

function awsViewBucket (in_serviceConfig, in_environment) {
    let serviceConfig = service.accessConfig(aws.getMergedServiceConfig(in_serviceConfig, in_environment), {
        cwd: 'STRING',
        service: {
            clusters: [
                {
                    aws: {
                        profile: 'STRING',
                        region: 'STRING',
                        bucket: {
                            name: 'STRING'
                        }
                    },
                    default: 'BOOLEAN',
                    environment: 'STRING'
                }
            ]
        }
    });

    let awsCache = cache.load(serviceConfig.cwd, 'aws');

    const cluster = _loadCluster(serviceConfig, in_environment);

    let awsBucketName = aws.getAwsBucketName(in_serviceConfig, {
        cache: awsCache,
        cluster: cluster
    });
    if (!awsBucketName) {
        throw new Error('Service AWS bucket name is not set');
    }

    let url = `console.aws.amazon.com/s3/buckets/${awsBucketName}`;
    url = 'https://' + url;
    print.out(cprint.toMagenta('Opening Url: ') + cprint.toGreen(url) + '\n');
    _openUrl(url);

    if (service.hasConfigFile(serviceConfig.cwd)) {
        cache.save(serviceConfig.cwd, 'aws', awsCache);
    }

    return true;
}

// ******************************

function awsViewBucketUser (in_serviceConfig, in_environment) {
    let serviceConfig = service.accessConfig(aws.getMergedServiceConfig(in_serviceConfig, in_environment), {
        cwd: 'STRING',
        service: {
            clusters: [
                {
                    aws: {
                        profile: 'STRING',
                        region: 'STRING',
                        bucket: {
                            username: 'STRING'
                        },
                    },
                    default: 'BOOLEAN',
                    environment: 'STRING'
                }
            ]
        }
    });

    const cluster = _loadCluster(serviceConfig, in_environment);

    let awsBucketUsername = cluster.aws.bucket.username;
    if (!awsBucketUsername) {
        throw new Error('Service bucket username not set');
    }

    let awsRegion = cluster.aws.region;

    let url = `console.aws.amazon.com/iam/home?region=${awsRegion}#/users/${awsBucketUsername}`;
    url = 'https://' + url;
    print.out(cprint.toMagenta('Opening Url: ') + cprint.toGreen(url) + '\n');
    _openUrl(url);
    return true;
}

// ******************************

function awsViewEndpoint (in_serviceConfig, in_environment) {
    let serviceConfig = service.accessConfig(aws.getMergedServiceConfig(in_serviceConfig, in_environment), {
        service: {
            clusters: [
                {
                    default: 'BOOLEAN',
                    environment: 'STRING',
                    url: 'URL'
                }
            ]
        },
        cwd: 'STRING'
    });

    const cluster = _loadCluster(serviceConfig, in_environment);

    let clusterUrl = aws.getAwsClusterUrl(in_serviceConfig, {
        cluster: cluster
    });

    if (!clusterUrl) {
        throw new Error('No url defined for cluster');
    }

    let url = clusterUrl + '/v1/status'; // TODO: Configurable endpoint
    print.out(cprint.toMagenta('Opening Url: ') + cprint.toGreen(url) + '\n');
    _openUrl(url);
    return true;
}

// ******************************
// Helper Functions:
// ******************************

function _assertAwsIsInstalled () {
    if (!aws.installed()) {
        throw new Error('AWS-CLI isn\'t installed');
    }
}

// ******************************

function _assertDockerIsInstalled () {
    if (!docker.installed()) {
        throw new Error('Docker isn\'t installed');
    }
}

// ******************************

function _assertDockerIsRunning () {
    if (!docker.running()) {
        throw new Error('Docker isn\'t running');
    }
}

// ******************************

function _loadCluster (in_serviceConfig, in_environment) {
    let cluster = aws.getEnvironmentCluster(in_serviceConfig.service.clusters, in_environment);
    if (!cluster) {
        if (in_environment) {
            throw new Error('No cluster set for "' + in_environment + '" environment');
        } else {
            throw new Error('No default environment defined');
        }
    }
    return cluster;
}

// ******************************

function _openUrl (in_url) {
    let openUrl = require('open');
    openUrl(in_url);
}

// ******************************
// Plugin Functions:
// ******************************

function handleCommand (in_args, in_params, in_serviceConfig) {
    let command = in_params.length ? in_params.shift().toLowerCase() : '';
    let env = in_args['env'] || in_args['environment'] || false;
    let extra = in_args['extra'];
    let stopTasks = in_args['stop-tasks'];
    let forceModelUpdate = in_args['force-model-update'];

    let firstParam = in_params.shift();

    switch(command)
    {
    case '':
    case 'info':
    case 'state':
    case 'service':
        printAwsServiceInfo(in_serviceConfig, env, extra);
        break;

    case 'login':
        awsLogin(in_serviceConfig, env);
        break;

    case 'docker-login':
        awsDockerLogin(in_serviceConfig, env);
        break;

    case 'docker-push':
        awsPushDockerImage(in_serviceConfig, env);
        break;

    case 'docker-command':
    case 'get-docker-launch-command':
        awsGetDockerCommand(in_serviceConfig, env);
        break;

    case 'create':
    case 'create-all':
        awsCreateAll(in_serviceConfig, env);
        break;

    case 'create-infrastructure':
        awsCreateInfrastructure(in_serviceConfig, env);
        break;

    case 'create-launch-configuration':
        awsCreateLaunchConfiguration(in_serviceConfig, env);
        break;

    case 'create-load-balancer':
        awsCreateLoadBalancer(in_serviceConfig, env);
        break;

    case 'create-auto-scaling-group':
        awsCreateAutoScalingGroup(in_serviceConfig, env);
        break;

    case 'create-bucket':
        awsCreateBucket(in_serviceConfig, env);
        break;

    case 'create-bucket-user':
        awsCreateBucketUser(in_serviceConfig, env);
        break;

    case 'create-delivery-structure':
        awsCreateDeliveryStructure(in_serviceConfig, env);
        break;

    case 'create-repository':
        awsCreateRepository(in_serviceConfig, env);
        break;

    case 'create-task-definition':
        awsCreateTaskDefinition(in_serviceConfig, forceModelUpdate, env);
        break;

    case 'create-cluster':
        awsCreateCluster(in_serviceConfig, env);
        break;

    case 'create-cluster-service':
        awsCreateClusterService(in_serviceConfig, env);
        break;

    case 'create-ec2-access-ecs-role':
        awsCreateEC2AccessECSRole(in_serviceConfig, env);
        break;

    case 'create-ecs-access-elb-role':
        awsCreateECSAccessELBRole(in_serviceConfig, env);
        break;

    case 'clean':
    case 'clean-all':
        awsCleanAll(in_serviceConfig, env);
        break;

    case 'clean-infrastructure':
        awsCleanInfrastructure(in_serviceConfig, env);
        break;

    case 'clean-launch-configurations':
        awsCleanLaunchConfigurations(in_serviceConfig, env);
        break;

    case 'clean-delivery-structure':
        awsCleanDeliveryStructure(in_serviceConfig, env);
        break;

    case 'clean-repository':
        awsCleanRepository(in_serviceConfig, env);
        break;

    case 'clean-task-definitions':
        awsCleanTaskDefinitions(in_serviceConfig, env);
        break;

    case 'update-auto-scaling-group':
        awsUpdateAutoScalingGroup(in_serviceConfig, env);
        break;

    case 'open-console':
    case 'open-login':
    case 'open-console-login':
    case 'view-console':
    case 'view-login':
    case 'view-console-login':
        awsViewConsoleLogin(in_serviceConfig, env);
        break;

    case 'open':
    case 'view':
    case 'open-all':
    case 'view-all':
        awsViewAll(in_serviceConfig, env);
        break;

    case 'open-infrastructure':
    case 'view-infrastructure':
        awsViewInfrastructure(in_serviceConfig, env);
        break;

    case 'open-instances':
    case 'view-instances':
        awsViewInstances(in_serviceConfig, env);
        break;

    case 'open-load-balancer':
    case 'view-load-balancer':
        awsViewLoadBalancer(in_serviceConfig, env);
        break;

    case 'open-launch-configuration':
    case 'view-launch-configuration':
        awsViewLaunchConfiguration(in_serviceConfig, env);
        break;

    case 'open-auto-scaling-group':
    case 'view-auto-scaling-group':
        awsViewAutoScalingGroup(in_serviceConfig, env);
        break;

    case 'open-delivery-structure':
    case 'view-delivery-structure':
        awsViewDeliveryStructure(in_serviceConfig, env);
        break;

    case 'open-repository':
    case 'view-repository':
        awsViewRepository(in_serviceConfig, env);
        break;

    case 'open-task-definition':
    case 'view-task-definition':
        awsViewTaskDefinition(in_serviceConfig, env);
        break;

    case 'open-cluster':
    case 'view-cluster':
        awsViewCluster(in_serviceConfig, env);
        break;

    case 'open-cluster-service':
    case 'view-cluster-service':
        awsViewClusterService(in_serviceConfig, env);
        break;

    case 'view-bucket':
        awsViewBucket(in_serviceConfig, env);
        break;

    case 'view-bucket-user':
        awsViewBucketUser(in_serviceConfig, env);
        break;

    case 'view-endpoint':
        awsViewEndpoint(in_serviceConfig, env);
        break;

    case 'deploy':
        awsDeploy(in_serviceConfig, stopTasks, env);
        break;

    case 'deploy-new-launch-configuration':
        awsDeployNewLaunchConfiguration(in_serviceConfig, env);
        break;

    case 'deploy-new-task-definition':
        awsDeployNewTaskDefinition(in_serviceConfig, forceModelUpdate, stopTasks, env);
        break;

    case 'set-instance-ami':
        awsSetInstanceAmi(in_serviceConfig, env, firstParam);
        break;

    case 'set-instance-count':
        awsSetInstanceCount(in_serviceConfig, env, firstParam);
        break;

    case 'set-instance-type':
        awsSetInstanceType(in_serviceConfig, env, firstParam);
        break;

    case 'start-cluster':
    case 'start':
        awsStartCluster(in_serviceConfig, env);
        break;

    case 'stop-cluster':
    case 'stop':
        awsStopCluster(in_serviceConfig, env);
        break;

    default:
        return false;
    }
    return true;
}

// ******************************

function getBaseCommands () {
    return ['aws'];
}

// ******************************

function getCommands () {
    return [
        { params: ['', 'info', 'state', 'service'], description: 'Print AWS state information', options: [
            {param:'environment', description:'Environment'},
            {param:'extra', description:'Include extra information'}
        ] },
        { params: ['login'], description: 'Authenticate with AWS', options: [{param:'environment', description:'Environment'}] },
        { params: ['docker-login'], description: 'Log into AWS docker repository', options: [{param:'environment', description:'Environment'}] },
        { params: ['docker-push'], description: 'Push Docker image to the AWS docker repository', options: [{param:'environment', description:'Environment'}] },

        { params: ['get-docker-launch-command', 'docker-command'], description: 'Get the docker command executed to run the service', options: [{param:'environment', description:'Environment'}] },

        { params: ['create-all', 'create'], description: 'Create all infrastructure and delivery structures for the service', options: [{param:'environment', description:'Environment'}] },

        { params: ['create-infrastructure'], description: 'Create infrastructure for the service', options: [{param:'environment', description:'Environment'}] },
        { params: ['create-launch-configuration'], description: 'Create launch configuration for the service', options: [{param:'environment', description:'Environment'}] },
        { params: ['create-load-balancer'], description: 'Create load balancer for the service', options: [{param:'environment', description:'Environment'}] },
        { params: ['create-auto-scaling-group'], description: 'Create auto scaling group for the service', options: [{param:'environment', description:'Environment'}] },
        { params: ['create-bucket'], description: 'Create bucket for the service model', options: [{param:'environment', description:'Environment'}] },
        { params: ['create-bucket-user'], description: 'Create bucket user for the service', options: [{param:'environment', description:'Environment'}] },

        { params: ['create-delivery-structure'], description: 'Create delivery structures for the service', options: [{param:'environment', description:'Environment'}] },
        { params: ['create-repository'], description: 'Create repository for the service', options: [{param:'environment', description:'Environment'}] },
        { params: ['create-task-definition'], description: 'Create task definition for the service', options: [
            {param:'environment', description:'Environment'},
            {param:'force-model-update', description:'Force a model update to the configured value even if the model version is dynamic'}
        ] },
        { params: ['create-cluster'], description: 'Create cluster for the service', options: [{param:'environment', description:'Environment'}] },
        { params: ['create-cluster-service'], description: 'Create cluster-service for the service', options: [{param:'environment', description:'Environment'}] },

        { params: ['create-ec2-access-ecs-role'], description: 'Create role for allowing EC2 instances to access ECS', options: [{param:'environment', description:'Environment'}] },
        { params: ['create-ecs-access-elb-role'], description: 'Create role for allowing ECS cluster services to access ELB', options: [{param:'environment', description:'Environment'}] },

        { params: ['clean-all', 'clean'], description: 'Clean all infrastructure and delivery structures for the service', options: [{param:'environment', description:'Environment'}] },

        { params: ['clean-infrastructure'], description: 'Clean infrastructure for the service', options: [{param:'environment', description:'Environment'}] },
        { params: ['clean-launch-configurations'], description: 'Remove old launch configurations for the service', options: [{param:'environment', description:'Environment'}] },

        { params: ['clean-delivery-structure'], description: 'Clean delivery structures for the service', options: [{param:'environment', description:'Environment'}] },
        { params: ['clean-repository'], description: 'Clean unlabled images from repository for the service', options: [{param:'environment', description:'Environment'}] },
        { params: ['clean-task-definitions'], description: 'Deregister old task definitions for the service', options: [{param:'environment', description:'Environment'}] },

        { params: ['update-auto-scaling-group'], description: 'Update auto scaling group for the service', options: [{param:'environment', description:'Environment'}] },

        { params: ['deploy-new-launch-configuration'], description: 'Deploy new launch configuration and update the auto scaling groups', options: [{param:'environment', description:'Environment'}] },
        { params: ['deploy-new-task-definition'], description: 'Create new task definition and deploy it', options: [
            {param:'stop-tasks', description:'Stop existing tasks'},
            {param:'environment', description:'Environment'},
            {param:'force-model-update', description:'Force a model update to the configured value even if the model version is dynamic'}
        ] },
        { params: ['deploy'], description: 'Deploy latest task definition for service', options: [{param:'stop-tasks', description:'Stop existing tasks'}, {param:'environment', description:'Environment'}] },

        { params: ['start-cluster', 'start'], description: 'Start AWS cluster', options: [{param:'environment', description:'Environment'}] },
        { params: ['stop-cluster', 'stop'], description: 'Stop AWS cluster', options: [{param:'environment', description:'Environment'}] },

        { params: ['set-instance-ami'], description: 'Set instance AMI for cluster', options: [{param:'environment', description:'Environment'}] },
        { params: ['set-instance-count'], description: 'Set instance count for cluster', options: [{param:'environment', description:'Environment'}] },
        { params: ['set-instance-type'], description: 'Set instance type for cluster', options: [{param:'environment', description:'Environment'}] },

        { params: ['view-console-login', 'view-console', 'view-login', 'open-console-login', 'open-console', 'open-login'], description: 'View console login screen', options: [{param:'environment', description:'Environment'}] },
        { params: ['view-all', 'open-all', 'view', 'open'], description: 'View all infrastructure and delivery structures for the service', options: [{param:'environment', description:'Environment'}] },

        { params: ['view-infrastructure', 'open-infrastructure'], description: 'View all infrastructure for the service', options: [{param:'environment', description:'Environment'}] },
        { params: ['view-instances', 'open-instances'], description: 'View instances for the service', options: [{param:'environment', description:'Environment'}] },
        { params: ['view-load-balancer', 'open-load-balancer'], description: 'View load-balancer for the service', options: [{param:'environment', description:'Environment'}] },
        { params: ['view-launch-configuration', 'open-launch-configuration'], description: 'View launch-configuration for the service', options: [{param:'environment', description:'Environment'}] },
        { params: ['view-auto-scaling-group', 'open-auto-scaling-group'], description: 'View auto-scaling-group for the service', options: [{param:'environment', description:'Environment'}] },

        { params: ['view-delivery-structure', 'open-delivery-structure'], description: 'View all delivery structures for the service', options: [{param:'environment', description:'Environment'}] },
        { params: ['view-repository', 'open-repository'], description: 'View repository for the service', options: [{param:'environment', description:'Environment'}] },
        { params: ['view-task-definition', 'open-task-definition'], description: 'View task definition for the service', options: [{param:'environment', description:'Environment'}] },
        { params: ['view-cluster', 'open-cluster'], description: 'View cluster for the service', options: [{param:'environment', description:'Environment'}] },
        { params: ['view-cluster-service', 'open-cluster-service'], description: 'View cluster-service for the service', options: [{param:'environment', description:'Environment'}] },

        { params: ['view-bucket', 'open-bucket'], description: 'View bucket for the service model', options: [{param:'environment', description:'Environment'}] },
        { params: ['view-bucket-user', 'open-bucket-user'], description: 'View bucket user for the service', options: [{param:'environment', description:'Environment'}] },

        { params: ['view-endpoint', 'open-endpoint'], description: 'View the service endpoint', options: [{param:'environment', description:'Environment'}] }
    ];
}

// ******************************

function getTitle () {
    return 'AWS';
}

// ******************************
// Exports:
// ******************************

module.exports['handleCommand'] = handleCommand;
module.exports['getBaseCommands'] = getBaseCommands;
module.exports['getCommands'] = getCommands;
module.exports['getTitle'] = getTitle;

// ******************************
