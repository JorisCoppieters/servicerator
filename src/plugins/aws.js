'use strict'; // JS: ES6

// ******************************
// Requires:
// ******************************

let cprint = require('color-print');

let aws = require('../utils/aws');
let awsInstanceTypes = require('../utils/aws.instance.types');
let cache = require('../utils/cache');
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
                        account_id: 'NUMBER',
                        profile: 'STRING',
                        region: 'STRING',
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
    if (!serviceConfig) {
        return;
    }

    let awsInstalled = aws.installed();
    if (!awsInstalled) {
        cprint.yellow('AWS-CLI isn\'t installed');
    }

    let serviceName = serviceConfig.service.name || false;

    let awsCache = cache.load(serviceConfig.cwd, 'aws');

    cprint.magenta('-- AWS --');

    let cluster = aws.getEnvironmentCluster(serviceConfig.service.clusters, in_environment);
    if (!cluster) {
        if (in_environment) {
            cprint.yellow('No cluster set for "' + in_environment + '" environment');
        } else {
            cprint.yellow('No default environment defined');
        }
        return false;
    }

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
    let oldEnvironment = cluster.role === 'ecsServiceRole';
    let prefixedEnvironmentTitle = 'AWS ' + environmentTitle;

    cprint.magenta('-- AWS Docker --');

    let dockerRepositoryStore = aws.getDockerRepositoryUrl(in_serviceConfig, in_environment);
    let awsDockerImageName = cluster.aws.image.name || serviceConfig.docker.image.name;
    if (!awsDockerImageName) {
        cprint.yellow('AWS docker image name not set');
        return false;
    }

    let dockerImageVersion = serviceConfig.docker.image.version || 'latest';
    let dockerImagePath = dockerRepositoryStore + '/' + awsDockerImageName + ':' + dockerImageVersion;

    print.keyVal('AWS Docker Image Path', dockerImagePath);
    print.out('\n');

    if (awsInstalled) {
        if (serviceName) {
            cprint.magenta('-- ' + prefixedEnvironmentTitle + ' Clusters State --');

            // print.keyVal(prefixedEnvironmentTitle + ' Auto Scaling Group', cluster.auto_scaling_group.name || '(Not Set)');
            print.keyVal(prefixedEnvironmentTitle + ' Cluster Name', cluster.name || '(Not Set)');

            if (cluster.auto_scaling_group.name) {
                print.keyVal(prefixedEnvironmentTitle + ' Cluster State', '...', true);
                let awsAutoScalingGroupInstanceCount = aws.getAutoScalingGroupInstanceCount(cluster.auto_scaling_group.name, {
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

            if (in_extra && cluster.name && cluster.service_name) {
                print.keyVal(prefixedEnvironmentTitle + ' Cluster Service Name', cluster.service_name);

                print.keyVal(prefixedEnvironmentTitle + ' Cluster Service Running', '...', true);
                let awsClusterServiceArn = aws.getClusterServiceArnForClusterName(cluster.name, cluster.service_name, {
                    cache: awsCache,
                    profile: cluster.aws.profile,
                    region: cluster.aws.region
                });
                print.clearLine();

                if (awsClusterServiceArn) {

                    // let awsClusterServiceName = aws.arnToTitle(awsClusterServiceArn);
                    print.keyVal(prefixedEnvironmentTitle + ' Cluster Service Running', 'Yes');

                    print.keyVal(prefixedEnvironmentTitle + ' Cluster Service Task Definition', '...', true);
                    let awsTaskDefinitionArn = aws.getTaskDefinitionArnForClusterService(cluster.name, awsClusterServiceArn, {
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
                    let awsClusterTaskArns = aws.getClusterTaskArnsForCluster(cluster.name, {
                        cache: awsCache,
                        profile: cluster.aws.profile,
                        region: cluster.aws.region
                    });
                    let awsClusterTaskDetails = aws.getTaskDetails(cluster.name, awsClusterTaskArns, {
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

            let oldServiceName = (cluster.auto_scaling_group.name || '').replace('-prod-auto-scaling-group', '').replace('-prod', '');

            if (in_extra) {
                let instanceIds = aws.getInstanceIdsWithTags([
                    {
                        key: oldEnvironment ? 'ServiceName' : 'Service', // TODO - Remove environment specific code
                        vals: [
                            oldEnvironment ? oldServiceName : serviceName  // TODO - Remove environment specific code
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

                instanceIds.forEach(i => {
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

        if (cluster.aws.bucket.name) {
            cprint.magenta('-- ' + prefixedEnvironmentTitle + ' Bucket State' + ' --');

            let awsBucketName = cluster.aws.bucket.name;
            print.keyVal(prefixedEnvironmentTitle + ' Bucket Name', awsBucketName);

            let awsBucketPath = aws.getBucketPathForBucketName(awsBucketName, {
                cache: awsCache,
                profile: cluster.aws.profile,
                region: cluster.aws.region
            });
            print.keyVal(prefixedEnvironmentTitle + ' Bucket Path', awsBucketPath ? awsBucketPath : cprint.toYellow('Does not exist!'));

            print.out('\n');
        }
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
                        account_id: 'NUMBER',
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
    if (!serviceConfig) {
        return;
    }

    if (!aws.installed()) {
        cprint.yellow('AWS-CLI isn\'t installed');
        return false;
    }

    if (!docker.installed()) {
        cprint.yellow('Docker isn\'t installed');
        return false;
    }

    if (!docker.running()) {
        cprint.yellow('Docker isn\'t running');
        return false;
    }

    let cluster = aws.getEnvironmentCluster(serviceConfig.service.clusters, in_environment);
    if (!cluster) {
        if (in_environment) {
            cprint.yellow('No cluster set for "' + in_environment + '" environment');
        } else {
            cprint.yellow('No default environment defined');
        }
        return false;
    }

    let dockerRepositoryStore = aws.getDockerRepositoryUrl(in_serviceConfig, in_environment);
    let awsDockerImageName = cluster.aws.image.name || serviceConfig.docker.image.name;
    if (!awsDockerImageName) {
        cprint.yellow('AWS docker image name not set');
        return false;
    }

    let dockerImageName = serviceConfig.docker.image.name;
    if (!awsDockerImageName) {
        cprint.yellow('Docker image name not set');
        return false;
    }

    let dockerImagePath = dockerRepositoryStore + '/' + awsDockerImageName;

    let dockerUsername = docker.getUsername(in_serviceConfig);
    if (!dockerUsername) {
        cprint.yellow('Docker Image username not set');
        return;
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
                cmdResult.printError();
                noErrors = false;
            }
        });


    let args = ['images', '--format', '{{.Repository}}:{{.Tag}}\t{{.ID}}'];
    let cmdResult = docker.cmd(args, {
        hide: true
    });

    if (cmdResult.hasError) {
        cmdResult.printError('  ');
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
                        account_id: 'NUMBER',
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
    if (!serviceConfig) {
        return;
    }

    if (!aws.installed()) {
        cprint.yellow('AWS-CLI isn\'t installed');
        return false;
    }

    if (!docker.installed()) {
        cprint.yellow('Docker isn\'t installed');
        return false;
    }

    if (!docker.running()) {
        cprint.yellow('Docker isn\'t running');
        return false;
    }

    let awsDockerCredentials = awsDockerLogin(in_serviceConfig, in_environment);
    if (!awsDockerCredentials) {
        cprint.yellow('Failed to get AWS Docker credentials');
        return false;
    }

    let cluster = aws.getEnvironmentCluster(serviceConfig.service.clusters, in_environment);
    if (!cluster) {
        if (in_environment) {
            cprint.yellow('No cluster set for "' + in_environment + '" environment');
        } else {
            cprint.yellow('No default environment defined');
        }
        return false;
    }

    if (!awsTagDockerImage(in_serviceConfig, in_environment)) {
        return false;
    }

    let dockerRepositoryStore = aws.getDockerRepositoryUrl(in_serviceConfig, in_environment);
    let awsDockerImageName = cluster.aws.image.name || serviceConfig.docker.image.name;
    if (!awsDockerImageName) {
        cprint.yellow('AWS docker image name not set');
        return false;
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
                        account_id: 'NUMBER',
                        profile: 'STRING',
                        region: 'STRING',
                        image: {
                            name: 'STRING'
                        }
                    },
                    default: 'BOOLEAN',
                    environment: 'STRING',
                    instance: {
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
    if (!serviceConfig) {
        return;
    }

    if (!aws.installed()) {
        cprint.yellow('AWS-CLI isn\'t installed');
        return false;
    }

    let serviceName = serviceConfig.service.name;
    if (!serviceName) {
        cprint.yellow('Service name not set');
        return false;
    }

    let cluster = aws.getEnvironmentCluster(serviceConfig.service.clusters, in_environment);
    if (!cluster) {
        if (in_environment) {
            cprint.yellow('No cluster set for "' + in_environment + '" environment');
        } else {
            cprint.yellow('No default environment defined');
        }
        return false;
    }

    let environment = cluster.environment;
    let environmentTitle = str.toTitleCase(environment);

    let awsTaskDefinitionName = cluster.task_definition.name;
    if (!awsTaskDefinitionName) {
        cprint.yellow('Service task definition name not set');
        return false;
    }

    let awsDockerImageName = cluster.aws.image.name || serviceConfig.docker.image.name;
    if (!awsDockerImageName) {
        cprint.yellow('AWS docker image name not set');
        return false;
    }

    let dockerImageVersion = serviceConfig.docker.image.version || 'latest';

    let awsDockerRepositoryUrl = aws.getDockerRepositoryUrl(in_serviceConfig, in_environment);
    if (!awsDockerRepositoryUrl) {
        cprint.yellow('Couldn\'t get aws docker repository');
        return false;
    }

    let awsTaskDefinitionImagePath = awsDockerRepositoryUrl + '/' + awsDockerImageName + ':' + dockerImageVersion;

    let awsClusterName = cluster.name;
    let awsClusterServiceName = cluster.service_name;
    let awsClusterServiceInstanceCount = cluster.instance.count || 1;

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
    print.keyVal('AWS ' + environmentTitle + ' Cluster Service Instance Count', awsClusterServiceInstanceCount);

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

    aws.deployTaskDefinitionToCluster(awsClusterName, awsClusterServiceArn, taskDefinitionArn, awsClusterServiceInstanceCount, {
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
    if (!serviceConfig) {
        return;
    }

    if (!aws.installed()) {
        cprint.yellow('AWS-CLI isn\'t installed');
        return false;
    }

    let serviceName = serviceConfig.service.name;
    if (!serviceName) {
        cprint.yellow('Service name not set');
        return false;
    }

    let cluster = aws.getEnvironmentCluster(serviceConfig.service.clusters, in_environment);
    if (!cluster) {
        if (in_environment) {
            cprint.yellow('No cluster set for "' + in_environment + '" environment');
        } else {
            cprint.yellow('No default environment defined');
        }
        return false;
    }

    let environment = cluster.environment;
    let environmentTitle = str.toTitleCase(environment);

    let timestampTagTemplate = '[0-9]{4}-[0-9]{2}-[0-9]{2}-[0-9]{10}';

    let awsLaunchConfigurationTemplateName = cluster.launch_configuration.name;
    if (!awsLaunchConfigurationTemplateName) {
        cprint.yellow('Launch configuration name not set');
        return false;
    }
    let awsLaunchConfigurationName = awsLaunchConfigurationTemplateName + '-' + date.getTimestampTag();

    let awsLaunchConfigurationSecurityGroupNames = cluster.launch_configuration.security_groups || [];

    let awsClusterName = cluster.name;
    let awsInstanceType = cluster.instance.type || 't2.micro';
    let awsIamRole = cluster.instance.iam_role;
    let awsAmi = cluster.instance.ami;
    let pemKeyName = cluster.identity_file;
    let assignPublicIp = cluster.instance.assign_public_ip;

    if (!awsAmi) {
        cprint.yellow('AWS AMI not set');
        return false;
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
        cprint.yellow('AWS VPC Name not set');
        return false;
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
                    showWarning: true,
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
            showWarning: true,
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
        cmdResult.printError('  ');
        return false;
    } else {
        cmdResult.printResult('  ');
        cprint.green('Created launch configuration');
        aws.clearCachedLaunchConfigurationLike(awsLaunchConfigurationTemplateName + '-' + timestampTagTemplate, awsCache);
        aws.clearCachedLaunchConfigurationsLike(awsLaunchConfigurationTemplateName + '-' + timestampTagTemplate, awsCache);
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
    if (!serviceConfig) {
        return;
    }

    if (!aws.installed()) {
        cprint.yellow('AWS-CLI isn\'t installed');
        return false;
    }

    let serviceName = serviceConfig.service.name;
    if (!serviceName) {
        cprint.yellow('Service name not set');
        return false;
    }

    let cluster = aws.getEnvironmentCluster(serviceConfig.service.clusters, in_environment);
    if (!cluster) {
        if (in_environment) {
            cprint.yellow('No cluster set for "' + in_environment + '" environment');
        } else {
            cprint.yellow('No default environment defined');
        }
        return false;
    }

    let environment = cluster.environment;
    let environmentTitle = str.toTitleCase(environment);

    let awsLoadBalancerName = cluster.load_balancer.name;
    if (!awsLoadBalancerName) {
        cprint.yellow('Load balancer name not set');
        return false;
    }

    let awsLoadBalancerSecurityGroupNames = cluster.load_balancer.security_groups || [];

    let awsVpcSubnetNames = (cluster.load_balancer.subnets || []);
    if (!awsVpcSubnetNames.length) {
        cprint.yellow('No VPC subnet names set');
        return false;
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
                    showWarning: true,
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
            showWarning: true,
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
                showWarning: true,
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
        cmdResult.printError('  ');
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
            cmdResult.printError('  ');
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
                        count: 'NUMBER',
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
    if (!serviceConfig) {
        return;
    }

    if (!aws.installed()) {
        cprint.yellow('AWS-CLI isn\'t installed');
        return false;
    }

    let serviceName = serviceConfig.service.name;
    if (!serviceName) {
        cprint.yellow('Service name not set');
        return false;
    }

    let cluster = aws.getEnvironmentCluster(serviceConfig.service.clusters, in_environment);
    if (!cluster) {
        if (in_environment) {
            cprint.yellow('No cluster set for "' + in_environment + '" environment');
        } else {
            cprint.yellow('No default environment defined');
        }
        return false;
    }

    let awsDockerImageName = cluster.aws.image.name || serviceConfig.docker.image.name;
    if (!awsDockerImageName) {
        cprint.yellow('AWS docker image name not set');
        return false;
    }

    let environment = cluster.environment;
    let environmentTitle = str.toTitleCase(environment);

    let awsLaunchConfigurationTemplateName = cluster.launch_configuration.name;
    if (!awsLaunchConfigurationTemplateName) {
        cprint.yellow('Launch configuration name not set');
        return false;
    }

    let awsAutoScalingGroupName = cluster.auto_scaling_group.name;
    if (!awsAutoScalingGroupName) {
        cprint.yellow('Auto scaling group name not set');
        return false;
    }

    let awsVpcName = cluster.vpc_name;
    if (!awsVpcName) {
        cprint.yellow('VPC name not set');
        return false;
    }

    let awsVpcSubnetNames = (cluster.auto_scaling_group.subnets || []);
    if (!awsVpcSubnetNames.length) {
        cprint.yellow('No VPC subnet names set');
        return false;
    }

    let healthCheckGracePeriod = cluster.auto_scaling_group.health_check_grace_period || 300;

    let awsLoadBalancerName = cluster.load_balancer.name;

    let awsCache = cache.load(serviceConfig.cwd, 'aws');

    let desiredCount = cluster.instance.count || 0;

    let awsAutoScalingGroupMinSize = 0;
    let awsAutoScalingGroupMaxSize = desiredCount + 2;

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
                showWarning: true,
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
        cmdResult.printError('  ');
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
            cmdResult.printError('  ');
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
    if (!serviceConfig) {
        return;
    }

    if (!aws.installed()) {
        cprint.yellow('AWS-CLI isn\'t installed');
        return false;
    }

    let cluster = aws.getEnvironmentCluster(serviceConfig.service.clusters, in_environment);
    if (!cluster) {
        if (in_environment) {
            cprint.yellow('No cluster set for "' + in_environment + '" environment');
        } else {
            cprint.yellow('No default environment defined');
        }
        return false;
    }

    let awsBucketName = cluster.aws.bucket.name;
    if (!awsBucketName) {
        cprint.yellow('Model bucket name not set');
        return false;
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
    if (!serviceConfig) {
        return;
    }

    if (!aws.installed()) {
        cprint.yellow('AWS-CLI isn\'t installed');
        return false;
    }

    let sourceFolder = serviceConfig.cwd || false;

    let cluster = aws.getEnvironmentCluster(serviceConfig.service.clusters, in_environment);
    if (!cluster) {
        if (in_environment) {
            cprint.yellow('No cluster set for "' + in_environment + '" environment');
        } else {
            cprint.yellow('No default environment defined');
        }
        return false;
    }

    let awsBucketName = cluster.aws.bucket.name;
    if (!awsBucketName) {
        cprint.yellow('Service bucket name not set');
        return false;
    }

    let awsBucketUsername = cluster.aws.bucket.username;
    if (!awsBucketUsername) {
        cprint.yellow('Service bucket username not set');
        return false;
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
    if (!serviceConfig) {
        return;
    }

    if (!aws.installed()) {
        cprint.yellow('AWS-CLI isn\'t installed');
        return false;
    }

    let awsDockerRepositoryUrl = aws.getDockerRepositoryUrl(in_serviceConfig, in_environment);
    if (!awsDockerRepositoryUrl) {
        cprint.yellow('Couldn\'t get aws docker repository');
        return false;
    }

    let cluster = aws.getEnvironmentCluster(serviceConfig.service.clusters, in_environment);
    if (!cluster) {
        if (in_environment) {
            cprint.yellow('No cluster set for "' + in_environment + '" environment');
        } else {
            cprint.yellow('No default environment defined');
        }
        return false;
    }

    let awsDockerImageName = cluster.aws.image.name || serviceConfig.docker.image.name;
    if (!awsDockerImageName) {
        cprint.yellow('AWS docker image name not set');
        return false;
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
                        account_id: 'NUMBER',
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
    if (!serviceConfig) {
        return;
    }

    if (!aws.installed()) {
        cprint.yellow('AWS-CLI isn\'t installed');
        return false;
    }

    let loggingSupport = !!serviceConfig.docker.container.logging_support;

    let serviceName = serviceConfig.service.name;
    if (!serviceName) {
        cprint.yellow('Service name not set');
        return false;
    }

    let cluster = aws.getEnvironmentCluster(serviceConfig.service.clusters, in_environment);
    if (!cluster) {
        if (in_environment) {
            cprint.yellow('No cluster set for "' + in_environment + '" environment');
        } else {
            cprint.yellow('No default environment defined');
        }
        return false;
    }

    let awsDockerImageName = cluster.aws.image.name || serviceConfig.docker.image.name;
    if (!awsDockerImageName) {
        cprint.yellow('AWS docker image name not set');
        return false;
    }

    let dockerImageVersion = serviceConfig.docker.image.version || 'latest';

    let awsTaskDefinitionName = cluster.task_definition.name;
    if (!awsTaskDefinitionName) {
        cprint.yellow('Service task definition name not set');
        return false;
    }

    let awsDockerRepositoryUrl = aws.getDockerRepositoryUrl(in_serviceConfig, in_environment);
    if (!awsDockerRepositoryUrl) {
        cprint.yellow('Couldn\'t get aws docker repository');
        return false;
    }

    let awsTaskDefinitionImagePath = awsDockerRepositoryUrl + '/' + awsDockerImageName + ':' + dockerImageVersion;
    let awsTaskDefinitionMemoryLimit = serviceConfig.docker.container.memory_limit || 500;

    let awsCache = cache.load(serviceConfig.cwd, 'aws');

    let environment = cluster.environment;
    let oldEnvironment = cluster.role === 'ecsServiceRole';

    cprint.magenta('-- Task Definition --');
    print.keyVal('AWS Task Definition Name', awsTaskDefinitionName);
    print.keyVal('AWS Task Definition Image Path', awsTaskDefinitionImagePath);

    print.keyVal('AWS Task Definition Role', '...', true);
    let awsRoleName = cluster.aws.service_role;
    let taskDefinitionRoleArn = false;

    if (awsRoleName) {
        taskDefinitionRoleArn = aws.getRoleArnForRoleName(awsRoleName, {
            cache: awsCache,
            showWarning: true,
            profile: cluster.aws.profile,
            region: cluster.aws.region
        });
        if (!taskDefinitionRoleArn) {
            return;
        }

        print.clearLine();
        print.keyVal('AWS Task Definition Role', taskDefinitionRoleArn);
    }

    let oldContainerDefinition = awsTaskDefinitionName.replace('-task-definition', ''); // TODO - Remove old code

    let serviceContainerDefinition = {
        'cpu': 0,
        'essential': true,
        'image': awsTaskDefinitionImagePath,
        'memoryReservation': awsTaskDefinitionMemoryLimit,
        'name': oldEnvironment ? oldContainerDefinition : 'service', // TODO - Remove environment specific setting
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

    let bucketName = cluster.aws.bucket.name;

    let modelVersion = serviceConfig.model.version;
    if (serviceConfig.model.dynamic && !in_forceModelUpdate) {
        let awsTaskDefinitionName = cluster.task_definition.name;
        if (!awsTaskDefinitionName) {
            cprint.yellow('Service task definition name not set');
            return false;
        }

        let taskDefinitionArns = aws.getPreviousTaskDefinitionArnsForTaskDefinition(awsTaskDefinitionName, {
            cache: awsCache,
            verbose: true,
            profile: cluster.aws.profile,
            region: cluster.aws.region
        });

        let lastTaskDefinitionArn = taskDefinitionArns[0];
        if (lastTaskDefinitionArn) {
            let lastTaskDefinition = aws.getTaskDefinition(lastTaskDefinitionArn, {
                cache: awsCache,
                verbose: true,
                profile: cluster.aws.profile,
                region: cluster.aws.region
            });

            let oldContainerDefinition = awsTaskDefinitionName.replace('-task-definition', ''); // TODO - Remove old code
            if (lastTaskDefinition) {
                let modelVersionVariable = lastTaskDefinition.containerDefinitions
                    .filter(container => [oldContainerDefinition, 'service'].indexOf(container.name) >= 0)
                    .map(container => container.environment[0])
                    .find(environmentVariable => environmentVariable.name === 'MODEL_VERSION');

                modelVersion = modelVersionVariable ? modelVersionVariable.value : modelVersion;
            }
        }
    }

    serviceContainerDefinition.environment = Object.entries(
        serviceConfig.docker.container.environment_variables
            .filter(environmentVariable => !environmentVariable.local && environmentVariable.key && environmentVariable.value)
            .filter(environmentVariable => environment === 'production' || !environmentVariable.prod)
            .map(environmentVariable => {
                return {
                    key: service.replaceConfigReferences(in_serviceConfig, environmentVariable.key),
                    value: service.replaceConfigReferences(in_serviceConfig, environmentVariable.value, {
                        'MODEL_BUCKET': bucketName,
                        'MODEL_VERSION': modelVersion
                    })
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
        let filebeatServiceName = 'filebeat-tm-services';
        if (!oldEnvironment) {
            filebeatServiceName += '-' + environment;
        }
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
            'name': oldEnvironment ? 'filebeat-tm-services' : 'filebeat',
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
        cmdResult.printError('  ');
        return false;
    } else {
        cmdResult.printResult('  ');
        let taskDefinitionArn = (cmdResult.resultObj.taskDefinition || {}).taskDefinitionArn;
        cprint.green('Created task definition "' + taskDefinitionArn + '"');
        aws.clearCachedTaskDefinitionArnForTaskDefinition(awsTaskDefinitionName, awsCache);
        aws.clearCachedLatestTaskDefinitionArnForTaskDefinition(awsTaskDefinitionName, awsCache);
        aws.clearCachedPreviousTaskDefinitionArnsForTaskDefinition(awsTaskDefinitionName, awsCache);
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
    if (!serviceConfig) {
        return;
    }

    if (!aws.installed()) {
        cprint.yellow('AWS-CLI isn\'t installed');
        return false;
    }

    let serviceName = serviceConfig.service.name;
    if (!serviceName) {
        cprint.yellow('Service name not set');
        return false;
    }

    let cluster = aws.getEnvironmentCluster(serviceConfig.service.clusters, in_environment);
    if (!cluster) {
        if (in_environment) {
            cprint.yellow('No cluster set for "' + in_environment + '" environment');
        } else {
            cprint.yellow('No default environment defined');
        }
        return false;
    }

    let environment = cluster.environment;
    let environmentTitle = str.toTitleCase(environment);

    let awsClusterName = cluster.name;
    if (!awsClusterName) {
        cprint.yellow('Cluster name not set');
        return false;
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
                        health_check_grace_period: 'NUMBER'
                    },
                    aws: {
                        profile: 'STRING',
                        region: 'STRING'
                    },
                    default: 'BOOLEAN',
                    environment: 'STRING',
                    instance: {
                        count: 'NUMBER'
                    },
                    load_balancer: {
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
    if (!serviceConfig) {
        return;
    }

    if (!aws.installed()) {
        cprint.yellow('AWS-CLI isn\'t installed');
        return false;
    }

    let serviceName = serviceConfig.service.name;
    if (!serviceName) {
        cprint.yellow('Service name not set');
        return false;
    }

    let cluster = aws.getEnvironmentCluster(serviceConfig.service.clusters, in_environment);
    if (!cluster) {
        if (in_environment) {
            cprint.yellow('No cluster set for "' + in_environment + '" environment');
        } else {
            cprint.yellow('No default environment defined');
        }
        return false;
    }

    let awsTaskDefinitionName = cluster.task_definition.name;
    if (!awsTaskDefinitionName) {
        cprint.yellow('Service task definition name not set');
        return false;
    }

    let awsDockerRepositoryUrl = aws.getDockerRepositoryUrl(in_serviceConfig, in_environment);
    if (!awsDockerRepositoryUrl) {
        cprint.yellow('Couldn\'t get aws docker repository');
        return false;
    }

    let dockerContainerName = serviceName;

    let environment = cluster.environment;
    let environmentTitle = str.toTitleCase(environment);

    let awsClusterName = cluster.name;
    if (!awsClusterName) {
        cprint.yellow('Cluster name not set');
        return false;
    }

    let awsClusterServiceName = cluster.service_name;
    if (!awsClusterServiceName) {
        cprint.yellow('Cluster service name not set');
        return false;
    }

    let loadBalancers = [];

    let awsLoadBalancerName = cluster.load_balancer.name;
    if (awsLoadBalancerName) {
        serviceConfig.docker.container.ports.forEach(port => {
            if (!port.host || !port.container) {
                return;
            }

            if (port.local) {
                return;
            }

            loadBalancers.push({
                loadBalancerName: awsLoadBalancerName,
                containerName: dockerContainerName,
                containerPort: port.container
            });
        });
    }

    if (loadBalancers.length > 1) {
        loadBalancers = [loadBalancers[0]];
    }

    let desiredCount = cluster.instance.count || 0;

    let healthCheckGracePeriod = cluster.auto_scaling_group.health_check_grace_period || 300;
    let role = cluster.role || 'ecs-access-elb';

    let awsCache = cache.load(serviceConfig.cwd, 'aws');

    cprint.magenta('-- AWS ' + environmentTitle + ' Cluster Service --');
    print.keyVal('AWS ' + environmentTitle + ' Cluster Name', awsClusterName);
    print.keyVal('AWS ' + environmentTitle + ' Cluster Service Desired Count', desiredCount);
    print.keyVal('AWS ' + environmentTitle + ' Role', role);
    print.keyVal('AWS ' + environmentTitle + ' Load Balancers', JSON.stringify(loadBalancers, null, 4));

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
        desiredCount: desiredCount,
        role: role,
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
    if (!serviceConfig) {
        return;
    }

    if (!aws.installed()) {
        cprint.yellow('AWS-CLI isn\'t installed');
        return false;
    }

    let cluster = aws.getEnvironmentCluster(serviceConfig.service.clusters, in_environment);
    if (!cluster) {
        if (in_environment) {
            cprint.yellow('No cluster set for "' + in_environment + '" environment');
        } else {
            cprint.yellow('No default environment defined');
        }
        return false;
    }

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
    if (!serviceConfig) {
        return;
    }

    if (!aws.installed()) {
        cprint.yellow('AWS-CLI isn\'t installed');
        return false;
    }

    let cluster = aws.getEnvironmentCluster(serviceConfig.service.clusters, in_environment);
    if (!cluster) {
        if (in_environment) {
            cprint.yellow('No cluster set for "' + in_environment + '" environment');
        } else {
            cprint.yellow('No default environment defined');
        }
        return false;
    }

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
                        count: 'NUMBER',
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
    if (!serviceConfig) {
        return;
    }

    cprint.cyan('Cleaning launch configurations...');

    if (!aws.installed()) {
        cprint.yellow('AWS-CLI isn\'t installed');
        return false;
    }

    let serviceName = serviceConfig.service.name;
    if (!serviceName) {
        cprint.yellow('Service name not set');
        return false;
    }

    let cluster = aws.getEnvironmentCluster(serviceConfig.service.clusters, in_environment);
    if (!cluster) {
        if (in_environment) {
            cprint.yellow('No cluster set for "' + in_environment + '" environment');
        } else {
            cprint.yellow('No default environment defined');
        }
        return false;
    }

    let awsLaunchConfigurationTemplateName = cluster.launch_configuration.name;
    if (!awsLaunchConfigurationTemplateName) {
        cprint.yellow('Launch configuration name not set');
        return false;
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
            showWarning: true,
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

    aws.clearCachedLaunchConfigurationLike(awsLaunchConfigurationTemplateName + '-' + timestampTagTemplate, awsCache);
    aws.clearCachedLaunchConfigurationsLike(awsLaunchConfigurationTemplateName + '-' + timestampTagTemplate, awsCache);

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
    if (!serviceConfig) {
        return;
    }

    cprint.cyan('Cleaning repositories...');

    if (!aws.installed()) {
        cprint.yellow('AWS-CLI isn\'t installed');
        return false;
    }

    let cluster = aws.getEnvironmentCluster(serviceConfig.service.clusters, in_environment);
    if (!cluster) {
        if (in_environment) {
            cprint.yellow('No cluster set for "' + in_environment + '" environment');
        } else {
            cprint.yellow('No default environment defined');
        }
        return false;
    }

    let awsDockerImageName = cluster.aws.image.name || serviceConfig.docker.image.name;
    if (!awsDockerImageName) {
        cprint.yellow('AWS docker image name not set');
        return false;
    }

    let awsDockerRepositoryUrl = aws.getDockerRepositoryUrl(in_serviceConfig, in_environment);
    if (!awsDockerRepositoryUrl) {
        cprint.yellow('Couldn\'t get aws docker repository');
        return false;
    }

    let awsCache = cache.load(serviceConfig.cwd, 'aws');

    let awsDockerRepository = aws.getDockerRepositoryForDockerImageName(awsDockerImageName, {
        cache: awsCache,
        verbose: true,
        profile: cluster.aws.profile,
        region: cluster.aws.region
    });
    if (!awsDockerRepository) {
        cprint.yellow('Repository does not exist!');
        return;
    }

    let awsDockerRepositoryImages = aws.getDockerRepositoryImagesForRepositoryName(awsDockerRepository, {
        cache: awsCache,
        verbose: true,
        profile: cluster.aws.profile,
        region: cluster.aws.region
    });
    if (!awsDockerRepositoryImages) {
        cprint.yellow('Failed to get repository images!');
        return;
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

    aws.clearCachedDockerRepositoryImagesForRepositoryName(awsDockerRepository, awsCache);

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
    if (!serviceConfig) {
        return;
    }

    cprint.cyan('Cleaning task definitions...');

    if (!aws.installed()) {
        cprint.yellow('AWS-CLI isn\'t installed');
        return false;
    }

    let serviceName = serviceConfig.service.name;
    if (!serviceName) {
        cprint.yellow('Service name not set');
        return false;
    }

    let cluster = aws.getEnvironmentCluster(serviceConfig.service.clusters, in_environment);
    if (!cluster) {
        if (in_environment) {
            cprint.yellow('No cluster set for "' + in_environment + '" environment');
        } else {
            cprint.yellow('No default environment defined');
        }
        return false;
    }

    let awsTaskDefinitionName = cluster.task_definition.name;
    if (!awsTaskDefinitionName) {
        cprint.yellow('Service task definition name not set');
        return false;
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
                        count: 'NUMBER',
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
    if (!serviceConfig) {
        return;
    }

    if (!aws.installed()) {
        cprint.yellow('AWS-CLI isn\'t installed');
        return false;
    }

    let serviceName = serviceConfig.service.name;
    if (!serviceName) {
        cprint.yellow('Service name not set');
        return false;
    }

    let cluster = aws.getEnvironmentCluster(serviceConfig.service.clusters, in_environment);
    if (!cluster) {
        if (in_environment) {
            cprint.yellow('No cluster set for "' + in_environment + '" environment');
        } else {
            cprint.yellow('No default environment defined');
        }
        return false;
    }

    let awsDockerImageName = cluster.aws.image.name || serviceConfig.docker.image.name;
    if (!awsDockerImageName) {
        cprint.yellow('AWS docker image name not set');
        return false;
    }

    let environment = cluster.environment;
    let environmentTitle = str.toTitleCase(environment);

    let awsLaunchConfigurationTemplateName = cluster.launch_configuration.name;
    if (!awsLaunchConfigurationTemplateName) {
        cprint.yellow('Launch configuration name not set');
        return false;
    }

    let awsAutoScalingGroupName = cluster.auto_scaling_group.name;
    if (!awsAutoScalingGroupName) {
        cprint.yellow('Auto scaling group name not set');
        return false;
    }

    let awsVpcName = cluster.vpc_name;
    if (!awsVpcName) {
        cprint.yellow('VPC name not set');
        return false;
    }

    let awsVpcSubnetNames = (cluster.auto_scaling_group.subnets || []);
    if (!awsVpcSubnetNames.length) {
        cprint.yellow('No VPC subnet names set');
        return false;
    }

    let healthCheckGracePeriod = cluster.auto_scaling_group.health_check_grace_period || 300;

    let awsLoadBalancerName = cluster.load_balancer.name;

    let awsCache = cache.load(serviceConfig.cwd, 'aws');

    let desiredCount = cluster.instance.count || 0;

    let awsAutoScalingGroupMinSize = 0;
    let awsAutoScalingGroupMaxSize = desiredCount + 2;

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
                showWarning: true,
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
        cmdResult.printError('  ');
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
            cmdResult.printError('  ');
            return false;
        } else {
            cmdResult.printResult('  ');
            cprint.green('Added load balancer to auto scaling group');
        }
    }

    aws.clearCachedAutoScalingGroups(awsCache);

    if (service.hasConfigFile(serviceConfig.cwd)) {
        cache.save(serviceConfig.cwd, 'aws', awsCache);
    }

    cprint.magenta('----');
    return true;
}

// ******************************

function awsDockerLogin (in_serviceConfig, in_environment) {
    let serviceConfig = service.accessConfig(aws.getMergedServiceConfig(in_serviceConfig, in_environment), {
        cwd: 'STRING',
        service: {
            clusters: [
                {
                    aws: {
                        account_id: 'NUMBER',
                        region: 'STRING'
                    },
                    default: 'BOOLEAN',
                    environment: 'STRING'
                }
            ]
        }
    });
    if (!serviceConfig) {
        return;
    }

    if (!aws.installed()) {
        cprint.yellow('AWS-CLI isn\'t installed');
        return false;
    }

    let cluster = aws.getEnvironmentCluster(serviceConfig.service.clusters, in_environment);
    if (!cluster) {
        if (in_environment) {
            cprint.yellow('No cluster set for "' + in_environment + '" environment');
        } else {
            cprint.yellow('No default environment defined');
        }
        return false;
    }

    if (!docker.running()) {
        cprint.yellow('Docker isn\'t running');
        return false;
    }

    let awsDockerCredentials = aws.getDockerCredentials(in_serviceConfig, {
        environment: in_environment
    });

    if (!awsDockerCredentials) {
        cprint.yellow('Failed to get AWS Docker credentials');
        return false;
    }

    let awsDockerRepositoryUrl = aws.getDockerRepositoryUrl(in_serviceConfig, in_environment);
    if (!awsDockerRepositoryUrl) {
        cprint.yellow('Couldn\'t get aws docker repository');
        return false;
    }

    if (docker.isLoggedIn(awsDockerRepositoryUrl)) {
        return awsDockerCredentials;
    }

    let success = docker.login(awsDockerCredentials.username, awsDockerCredentials.password, awsDockerRepositoryUrl);
    if (!success) {
        cprint.yellow('Check your regions match in your .aws/config and service.json');
        return false;
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
                        name: 'STRING'
                    },
                    aws: {
                        profile: 'STRING',
                        region: 'STRING'
                    },
                    default: 'BOOLEAN',
                    environment: 'STRING',
                    instance: {
                        count: 'NUMBER'
                    }
                }
            ],
            name: 'STRING'
        }
    });
    if (!serviceConfig) {
        return;
    }

    if (!aws.installed()) {
        cprint.yellow('AWS-CLI isn\'t installed');
        return false;
    }

    let awsCache = cache.load(serviceConfig.cwd, 'aws');

    let serviceName = serviceConfig.service.name;
    if (!serviceName) {
        cprint.yellow('Service name not set');
        return false;
    }

    let cluster = aws.getEnvironmentCluster(serviceConfig.service.clusters, in_environment);
    if (!cluster) {
        if (in_environment) {
            cprint.yellow('No cluster set for "' + in_environment + '" environment');
        } else {
            cprint.yellow('No default environment defined');
        }
        return false;
    }

    let autoScalingGroupName = cluster.auto_scaling_group.name;
    if (!autoScalingGroupName) {
        cprint.yellow('Auto scaling group name not set');
        return false;
    }

    let instanceCount = cluster.instance.count || 2;

    let autoScalingGroupInstanceCount = aws.getAutoScalingGroupInstanceCount(autoScalingGroupName, {
        profile: cluster.aws.profile,
        region: cluster.aws.region,
        showWarning: true
    });
    if (autoScalingGroupInstanceCount < 0) {
        cprint.yellow('AWS cluster doesn\'t exist');
        return;
    }

    if (autoScalingGroupInstanceCount == 0) {
        cprint.cyan('Starting AWS cluster...');
        aws.setAutoScalingGroupInstanceCount(autoScalingGroupName, instanceCount, {
            cache: awsCache,
            profile: cluster.aws.profile,
            region: cluster.aws.region
        });
    } else if (autoScalingGroupInstanceCount != instanceCount) {
        cprint.cyan('Updating AWS cluster...');
        aws.setAutoScalingGroupInstanceCount(autoScalingGroupName, instanceCount, {
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
    if (!serviceConfig) {
        return;
    }

    if (!aws.installed()) {
        cprint.yellow('AWS-CLI isn\'t installed');
        return false;
    }

    let awsCache = cache.load(serviceConfig.cwd, 'aws');

    let serviceName = serviceConfig.service.name;
    if (!serviceName) {
        cprint.yellow('Service name not set');
        return false;
    }

    let cluster = aws.getEnvironmentCluster(serviceConfig.service.clusters, in_environment);
    if (!cluster) {
        if (in_environment) {
            cprint.yellow('No cluster set for "' + in_environment + '" environment');
        } else {
            cprint.yellow('No default environment defined');
        }
        return false;
    }

    let autoScalingGroupName = cluster.auto_scaling_group.name;
    if (!autoScalingGroupName) {
        cprint.yellow('Auto scaling group name not set');
        return false;
    }

    let autoScalingGroupInstanceCount = aws.getAutoScalingGroupInstanceCount(autoScalingGroupName, {
        profile: cluster.aws.profile,
        region: cluster.aws.region,
        showWarning: true
    });
    if (autoScalingGroupInstanceCount < 0) {
        cprint.yellow('AWS cluster doesn\'t exist');
        return;
    }

    if (autoScalingGroupInstanceCount > 0) {
        cprint.cyan('Stopping AWS cluster...');
        aws.setAutoScalingGroupInstanceCount(autoScalingGroupName, 0, {
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
                        count: 'NUMBER'
                    }
                }
            ]
        },
        cwd: 'STRING'
    });
    if (!serviceConfig) {
        return;
    }

    if (!in_ami) {
        cprint.yellow('Instance AMI not provided');
        return false;
    }

    if (!in_ami.match(/ami-[a-f0-9]{8}/)) {
        cprint.yellow('Instance AMI not valid a AMI id: ' + in_ami);
        return false;
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
                    instance: {
                        count: 'NUMBER'
                    }
                }
            ]
        },
        cwd: 'STRING'
    });
    if (!serviceConfig) {
        return;
    }

    if (!in_count) {
        cprint.yellow('Instance count not provided');
        return false;
    }

    let count = parseInt(in_count);
    if (isNaN(count) || count < 0) {
        cprint.yellow('Instance count not a valid positive number: ' + in_count);
        return false;
    }

    let clusters = serviceConfig.service.clusters || [];

    if (in_environment) {
        let environmentCluster = clusters.find(c => {
            return c.environment === in_environment;
        });
        if (environmentCluster) {
            environmentCluster.instance.count = count;
        }
        service.updateConfig(in_serviceConfig, serviceConfig);
    } else {
        clusters.forEach(c => {
            c.instance.count = count;
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
                        count: 'NUMBER'
                    }
                }
            ]
        },
        cwd: 'STRING'
    });
    if (!serviceConfig) {
        return;
    }

    if (!in_type) {
        cprint.yellow('Instance type not provided');
        return false;
    }

    if (awsInstanceTypes.ALL.indexOf(in_type) < 0) {
        cprint.yellow('Instance type not valid: ' + in_type);
        return false;
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
                        account_id: 'NUMBER'
                    },
                    default: 'BOOLEAN',
                    environment: 'STRING'
                }
            ]
        }
    });
    if (!serviceConfig) {
        return;
    }

    let cluster = aws.getEnvironmentCluster(serviceConfig.service.clusters, in_environment);
    if (!cluster) {
        if (in_environment) {
            cprint.yellow('No cluster set for "' + in_environment + '" environment');
        } else {
            cprint.yellow('No default environment defined');
        }
        return false;
    }

    let awsAccountId = cluster.aws.account_id || false;

    let url = `${awsAccountId}.signin.aws.amazon.com/console`;
    url = 'https://' + url;
    print.out(cprint.toMagenta('Opening Url: ') + cprint.toGreen(url) + '\n');
    _openUrl(url);
    return true;
}

// ******************************

function awsViewAll (in_serviceConfig, in_environment) {
    awsViewInfrastructure(in_serviceConfig, in_environment);
    awsViewDeliveryStructure(in_serviceConfig, in_environment);
    awsViewBucket(in_serviceConfig, in_environment);
    awsViewBucketUser(in_serviceConfig, in_environment);
    awsViewEndpoint(in_serviceConfig, in_environment);
}

// ******************************

function awsViewInfrastructure (in_serviceConfig, in_environment) {
    awsViewInstances(in_serviceConfig, in_environment);
    awsViewLoadBalancer(in_serviceConfig, in_environment);
    awsViewLaunchConfiguration(in_serviceConfig, in_environment);
    awsViewAutoScalingGroup(in_serviceConfig, in_environment);
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
    if (!serviceConfig) {
        return;
    }

    let cluster = aws.getEnvironmentCluster(serviceConfig.service.clusters, in_environment);
    if (!cluster) {
        if (in_environment) {
            cprint.yellow('No cluster set for "' + in_environment + '" environment');
        } else {
            cprint.yellow('No default environment defined');
        }
        return false;
    }

    let environment = cluster.environment;
    let oldEnvironment = cluster.role === 'ecsServiceRole';

    let serviceName = serviceConfig.service.name;
    if (!serviceName) {
        cprint.yellow('Service name not set');
        return false;
    }

    let awsRegion = cluster.aws.region;
    let serviceKey = oldEnvironment ? 'ServiceName' : 'Service'; // TODO - Remove environment specific code

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
    if (!serviceConfig) {
        return;
    }

    let cluster = aws.getEnvironmentCluster(serviceConfig.service.clusters, in_environment);
    if (!cluster) {
        if (in_environment) {
            cprint.yellow('No cluster set for "' + in_environment + '" environment');
        } else {
            cprint.yellow('No default environment defined');
        }
        return false;
    }

    let awsLoadBalancerName = cluster.load_balancer.name;
    if (!awsLoadBalancerName) {
        cprint.yellow('Load balancer name not set');
        return false;
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
    if (!serviceConfig) {
        return;
    }

    let cluster = aws.getEnvironmentCluster(serviceConfig.service.clusters, in_environment);
    if (!cluster) {
        if (in_environment) {
            cprint.yellow('No cluster set for "' + in_environment + '" environment');
        } else {
            cprint.yellow('No default environment defined');
        }
        return false;
    }

    let awsLaunchConfigurationName = cluster.launch_configuration.name;
    if (!awsLaunchConfigurationName) {
        cprint.yellow('Launch configuration name not set');
        return false;
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
        service: {
            clusters: [
                {
                    auto_scaling_group: {
                        name: 'STRING'
                    },
                    aws: {
                        region: 'STRING'
                    },
                    default: 'BOOLEAN',
                    environment: 'STRING'
                }
            ]
        }
    });
    if (!serviceConfig) {
        return;
    }

    let cluster = aws.getEnvironmentCluster(serviceConfig.service.clusters, in_environment);
    if (!cluster) {
        if (in_environment) {
            cprint.yellow('No cluster set for "' + in_environment + '" environment');
        } else {
            cprint.yellow('No default environment defined');
        }
        return false;
    }

    let awsAutoScalingGroupName = cluster.auto_scaling_group.name;
    if (!awsAutoScalingGroupName) {
        cprint.yellow('Auto scaling group name not set');
        return false;
    }

    let awsRegion = cluster.aws.region;

    let url = `${awsRegion}.console.aws.amazon.com/ec2/autoscaling/home?region=${awsRegion}#AutoScalingGroups:id=${awsAutoScalingGroupName};filter=${awsAutoScalingGroupName}`;
    url = 'https://' + url;
    print.out(cprint.toMagenta('Opening Url: ') + cprint.toGreen(url) + '\n');
    _openUrl(url);
    return true;
}

// ******************************

function awsViewDeliveryStructure (in_serviceConfig, in_environment) {
    awsViewRepository(in_serviceConfig, in_environment);
    awsViewTaskDefinition(in_serviceConfig, in_environment);
    awsViewCluster(in_serviceConfig, in_environment);
    awsViewClusterService(in_serviceConfig, in_environment);
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
                        region: 'STRING'
                    },
                    default: 'BOOLEAN',
                    environment: 'STRING'
                }
            ]
        }
    });
    if (!serviceConfig) {
        return;
    }

    if (!aws.installed()) {
        cprint.yellow('AWS-CLI isn\'t installed');
        return false;
    }

    let cluster = aws.getEnvironmentCluster(serviceConfig.service.clusters, in_environment);
    if (!cluster) {
        if (in_environment) {
            cprint.yellow('No cluster set for "' + in_environment + '" environment');
        } else {
            cprint.yellow('No default environment defined');
        }
        return false;
    }

    let awsDockerImageName = cluster.aws.image.name || serviceConfig.docker.image.name;
    if (!awsDockerImageName) {
        cprint.yellow('AWS docker image name not set');
        return false;
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
    if (!serviceConfig) {
        return;
    }

    if (!aws.installed()) {
        cprint.yellow('AWS-CLI isn\'t installed');
        return false;
    }

    let cluster = aws.getEnvironmentCluster(serviceConfig.service.clusters, in_environment);
    if (!cluster) {
        if (in_environment) {
            cprint.yellow('No cluster set for "' + in_environment + '" environment');
        } else {
            cprint.yellow('No default environment defined');
        }
        return false;
    }

    let awsTaskDefinitionName = cluster.task_definition.name;
    if (!awsTaskDefinitionName) {
        cprint.yellow('Service task definition name not set');
        return false;
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
                        region: 'STRING'
                    },
                    default: 'BOOLEAN',
                    environment: 'STRING',
                    name: 'STRING',
                }
            ]
        }
    });
    if (!serviceConfig) {
        return;
    }

    let cluster = aws.getEnvironmentCluster(serviceConfig.service.clusters, in_environment);
    if (!cluster) {
        if (in_environment) {
            cprint.yellow('No cluster set for "' + in_environment + '" environment');
        } else {
            cprint.yellow('No default environment defined');
        }
        return false;
    }

    let awsRegion = cluster.aws.region;
    let awsClusterName = cluster.name;

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
    if (!serviceConfig) {
        return;
    }

    let cluster = aws.getEnvironmentCluster(serviceConfig.service.clusters, in_environment);
    if (!cluster) {
        if (in_environment) {
            cprint.yellow('No cluster set for "' + in_environment + '" environment');
        } else {
            cprint.yellow('No default environment defined');
        }
        return false;
    }

    let awsRegion = cluster.aws.region;
    let awsClusterName = cluster.name;
    let awsClusterServiceName = cluster.service_name;

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
    if (!serviceConfig) {
        return;
    }

    let cluster = aws.getEnvironmentCluster(serviceConfig.service.clusters, in_environment);
    if (!cluster) {
        if (in_environment) {
            cprint.yellow('No cluster set for "' + in_environment + '" environment');
        } else {
            cprint.yellow('No default environment defined');
        }
        return false;
    }

    let awsBucketName = cluster.aws.bucket.name;
    if (!awsBucketName) {
        cprint.yellow('Service bucket name not set');
        return false;
    }

    let url = `console.aws.amazon.com/s3/buckets/${awsBucketName}`;
    url = 'https://' + url;
    print.out(cprint.toMagenta('Opening Url: ') + cprint.toGreen(url) + '\n');
    _openUrl(url);
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
                        bucket: {
                            username: 'STRING'
                        },
                        region: 'STRING'
                    },
                    default: 'BOOLEAN',
                    environment: 'STRING'
                }
            ]
        }
    });
    if (!serviceConfig) {
        return;
    }

    let cluster = aws.getEnvironmentCluster(serviceConfig.service.clusters, in_environment);
    if (!cluster) {
        if (in_environment) {
            cprint.yellow('No cluster set for "' + in_environment + '" environment');
        } else {
            cprint.yellow('No default environment defined');
        }
        return false;
    }

    let awsBucketUsername = cluster.aws.bucket.username;
    if (!awsBucketUsername) {
        cprint.yellow('Service bucket username not set');
        return false;
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
    if (!serviceConfig) {
        return;
    }

    let cluster = aws.getEnvironmentCluster(serviceConfig.service.clusters, in_environment);
    if (!cluster) {
        if (in_environment) {
            cprint.yellow('No cluster set for "' + in_environment + '" environment');
        } else {
            cprint.yellow('No default environment defined');
        }
        return false;
    }

    if (!cluster.url) {
        cprint.yellow('No url defined for cluster');
        return false;
    }

    let url = cluster.url + '/v1/status'; // TODO: Configurable endpoint
    print.out(cprint.toMagenta('Opening Url: ') + cprint.toGreen(url) + '\n');
    _openUrl(url);
    return true;
}

// ******************************
// Helper Functions:
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

    case 'docker-login':
        awsDockerLogin(in_serviceConfig, env);
        break;

    case 'docker-push':
        awsPushDockerImage(in_serviceConfig, env);
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
        { params: ['docker-login'], description: 'Log into AWS docker repository', options: [{param:'environment', description:'Environment'}] },
        { params: ['docker-push'], description: 'Push Docker image to the AWS docker repository', options: [{param:'environment', description:'Environment'}] },

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
