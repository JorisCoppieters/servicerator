'use strict'; // JS: ES6

// ******************************
// Requires:
// ******************************

let cprint = require('color-print');

let aws = require('../utils/aws');
let cache = require('../utils/cache');
let date = require('../utils/date');
let docker = require('../utils/docker');
let fs = require('../utils/filesystem');
let print = require('../utils/print');
let service = require('../utils/service');
let str = require('../utils/string');

// ******************************
// Functions:
// ******************************

function printAwsServiceInfo (in_serviceConfig, in_environment, in_extra) {
    let serviceConfig = service.accessConfig(aws.getMergedServiceConfig(in_serviceConfig), {
        service: {
            name: 'STRING',
            clusters: [
                {
                    name: 'STRING',
                    service_name: 'STRING',
                    default: 'BOOLEAN',
                    environment: 'STRING',
                    auto_scaling_group: {
                        name: 'STRING'
                    },
                    vpc_name: 'STRING'
                }
            ]
        },
        aws: {
            profile: 'STRING',
            access_key: 'STRING',
            account_id: 'NUMBER'
        },
        cwd: 'STRING'
    });

    let serviceName = serviceConfig.service.name || false;

    let awsAccessKey = serviceConfig.aws.access_key || false;
    let awsSecretKey = false;
    if (awsAccessKey) {
        awsSecretKey = aws.getSecretKey(in_serviceConfig);
    }

    let awsAccountId = serviceConfig.aws.account_id || false;

    let awsCache = cache.load(serviceConfig.cwd, 'aws');

    cprint.magenta('-- AWS --');

    if (awsAccountId) {
        print.keyVal('AWS Account Id', awsAccountId);
    }

    print.keyVal('AWS Access Key', awsAccessKey || '(Not Set)');
    print.keyVal('AWS Secret Key', awsSecretKey ? '*******' : '(Not Set)');
    print.out('\n');

    let awsInstalled = aws.installed();
    if (!awsInstalled) {
        cprint.yellow('AWS-CLI isn\'t installed');
    }

    let cluster = _getEnvironmentCluster(serviceConfig.service.clusters, in_environment);
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

    if (awsInstalled && awsAccessKey && awsSecretKey) {
        if (serviceName) {
            cprint.magenta('-- AWS ' + environmentTitle + ' Clusters State --');

            // print.keyVal('AWS ' + environmentTitle + ' Auto Scaling Group', cluster.auto_scaling_group.name || '(Not Set)');
            print.keyVal('AWS ' + environmentTitle + ' Cluster Name', cluster.name || '(Not Set)');

            if (cluster.auto_scaling_group.name) {
                print.keyVal('AWS ' + environmentTitle + ' Cluster State', '...', true);
                let awsAutoScalingGroupInstanceCount = aws.getAutoScalingGroupInstanceCount(cluster.auto_scaling_group.name, {
                    cache: awsCache,
                    profile: serviceConfig.aws.profile,
                    showWarning: true
                });
                print.clearLine();

                if (awsAutoScalingGroupInstanceCount !== undefined) {
                    let serviceState = aws.getServiceStateFromAutoScalingGroupInstanceCount(awsAutoScalingGroupInstanceCount);
                    if (serviceState === 'Down') {
                        serviceState = cprint.toYellow('Down');
                    }
                    print.keyVal('AWS ' + environmentTitle + ' Cluster State', serviceState);
                    print.keyVal('AWS ' + environmentTitle + ' Cluster Instances', awsAutoScalingGroupInstanceCount);
                } else {
                    print.keyVal('AWS ' + environmentTitle + ' Cluster State', '???');
                }
            }

            if (in_extra && cluster.name && cluster.service_name) {
                print.keyVal('AWS ' + environmentTitle + ' Cluster Service Name', cluster.service_name);

                print.keyVal('AWS ' + environmentTitle + ' Cluster Service Running', '...', true);
                let awsClusterServiceArn = aws.getClusterServiceArnForClusterName(cluster.name, cluster.service_name, {
                    cache: awsCache,
                    profile: serviceConfig.aws.profile
                });
                print.clearLine();

                if (awsClusterServiceArn) {

                    // let awsClusterServiceName = aws.arnToTitle(awsClusterServiceArn);
                    print.keyVal('AWS ' + environmentTitle + ' Cluster Service Running', 'Yes');

                    print.keyVal('AWS ' + environmentTitle + ' Cluster Service Task Definition', '...', true);
                    let awsTaskDefinitionArn = aws.getTaskDefinitionArnForClusterService(cluster.name, awsClusterServiceArn, {
                        cache: awsCache,
                        profile: serviceConfig.aws.profile
                    });
                    print.clearLine();

                    if (awsTaskDefinitionArn) {
                        let awsTaskDefinitionName = aws.arnToTitle(awsTaskDefinitionArn);
                        print.keyVal('AWS ' + environmentTitle + ' Cluster Service Task Definition', awsTaskDefinitionName);
                    } else {
                        print.keyVal('AWS ' + environmentTitle + ' Cluster Service Task Definition', '???');
                    }

                    print.keyVal('AWS ' + environmentTitle + ' Cluster Service Version', '...', true);
                    let clusterServiceVersion = aws.getClusterServiceVersionForTaskDefinition(awsTaskDefinitionArn, {
                        cache: awsCache,
                        profile: serviceConfig.aws.profile
                    });
                    print.clearLine();

                    if (clusterServiceVersion) {
                        print.keyVal('AWS ' + environmentTitle + ' Cluster Service Version', clusterServiceVersion);
                    } else {
                        print.keyVal('AWS ' + environmentTitle + ' Cluster Service Version', '???');
                    }

                    print.keyVal('AWS ' + environmentTitle + ' Cluster Tasks', '...', true);
                    let awsClusterTaskArns = aws.getClusterTaskArnsForCluster(cluster.name, {
                        cache: awsCache,
                        profile: serviceConfig.aws.profile
                    });
                    let awsClusterTaskDetails = aws.getTaskDetails(cluster.name, awsClusterTaskArns, {
                        cache: awsCache,
                        profile: serviceConfig.aws.profile
                    });
                    print.clearLine();

                    if (awsClusterTaskDetails && awsClusterTaskDetails.length) {
                        print.keyVal('AWS ' + environmentTitle + ' Cluster Tasks', JSON.stringify(awsClusterTaskDetails, null, 4));
                    } else {
                        print.keyVal('AWS ' + environmentTitle + ' Cluster Tasks', '[]');
                    }
                } else {
                    print.keyVal('AWS ' + environmentTitle + ' Cluster Service Running', cprint.toYellow('No'));
                }
            }

            print.out('\n');

            if (in_extra) {
                let instanceIds = aws.getInstanceIdsWithTags([
                    {
                        key: 'ServiceName',
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
                    profile: serviceConfig.aws.profile
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

                    print.keyVal('AWS ' + environmentTitle + ' VPC Name', awsVpcName);

                    if (cluster.vpc_name) {
                        print.keyVal('AWS ' + environmentTitle + ' VPC Id', '...', true);
                        let awsVpcId = aws.getVpcIdForVpc(cluster.vpc_name, {
                            cache: awsCache,
                            profile: serviceConfig.aws.profile
                        });
                        print.clearLine();

                        if (awsVpcId) {
                            print.keyVal('AWS ' + environmentTitle + ' VPC Id', awsVpcId);
                        } else {
                            print.keyVal('AWS ' + environmentTitle + ' VPC Id', '???');
                        }

                        print.keyVal('AWS ' + environmentTitle + ' VPC Default Security Group Id', '...', true);
                        let awsDefaultVpcSecurityGroupId = aws.getDefaultVpcSecurityGroupIdForVpc(awsVpcId, {
                            cache: awsCache,
                            profile: serviceConfig.aws.profile
                        });
                        print.clearLine();

                        if (awsDefaultVpcSecurityGroupId) {
                            print.keyVal('AWS ' + environmentTitle + ' VPC Default Security Group Id', awsDefaultVpcSecurityGroupId);
                        } else {
                            print.keyVal('AWS ' + environmentTitle + ' VPC Default Security Group Id', '???');
                        }
                    }

                    print.out('\n');
                }
            }
        }
    }

    if (service.hasConfigFile(serviceConfig.cwd)) {
        cache.save(serviceConfig.cwd, 'aws', awsCache);
    }

    cprint.magenta('----');
    return true;
}

// ******************************

function awsDeploy (in_serviceConfig, in_stopTasks, in_environment) {
    let serviceConfig = service.accessConfig(aws.getMergedServiceConfig(in_serviceConfig), {
        docker: {
            image: {
                name: 'STRING',
                version: 'STRING'
            }
        },
        service: {
            name: 'STRING',
            task_definition: {
                name: 'STRING'
            },
            clusters: [
                {
                    name: 'STRING',
                    service_name: 'STRING',
                    default: 'BOOLEAN',
                    environment: 'STRING',
                    instance: {
                        count: 'NUMBER'
                    }
                }
            ]
        },
        aws: {
            profile: 'STRING',
            account_id: 'NUMBER'
        },
        cwd: 'STRING'
    });

    if (!aws.installed()) {
        cprint.yellow('AWS-CLI isn\'t installed');
        return false;
    }

    let serviceName = serviceConfig.service.name;
    if (!serviceName) {
        cprint.yellow('Service name not set');
        return false;
    }

    let awsTaskDefinitionName = serviceConfig.service.task_definition.name;
    if (!awsTaskDefinitionName) {
        cprint.yellow('Service task definition name not set');
        return false;
    }

    let cluster = _getEnvironmentCluster(serviceConfig.service.clusters, in_environment);
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

    let dockerImageName = serviceConfig.docker.image.name;
    if (!dockerImageName) {
        cprint.yellow('Docker image name not set');
        return false;
    }

    let dockerImageVersion = serviceConfig.docker.image.version || '1.0.0';

    let awsDockerRepositoryUrl = aws.getDockerRepositoryUrl(in_serviceConfig);
    if (!awsDockerRepositoryUrl) {
        cprint.yellow('Couldn\'t get aws docker repository');
        return false;
    }

    let awsTaskDefinitionImagePath = awsDockerRepositoryUrl + '/' + dockerImageName + ':' + dockerImageVersion;
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
        profile: serviceConfig.aws.profile
    });
    if (!taskDefinitionArn) {
        return;
    }

    let awsClusterServiceArn = aws.getClusterServiceArnForClusterName(awsClusterName, awsClusterServiceName, {
        cache: awsCache,
        showWarning: true,
        profile: serviceConfig.aws.profile
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
        profile: serviceConfig.aws.profile
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
                profile: serviceConfig.aws.profile
            });
        });
    }

    aws.deployTaskDefinitionToCluster(awsClusterName, awsClusterServiceArn, taskDefinitionArn, awsClusterServiceInstanceCount, {
        profile: serviceConfig.aws.profile
    });

    if (service.hasConfigFile(serviceConfig.cwd)) {
        cache.save(serviceConfig.cwd, 'aws', awsCache);
    }

    cprint.magenta('----');
    return true;
}

// ******************************

function awsDeployNewTaskDefinition (in_serviceConfig, in_stopTasks, in_environment) {
    if (!awsCreateTaskDefinition(in_serviceConfig)) {
        return;
    }

    if (!awsDeploy(in_serviceConfig, in_stopTasks, in_environment)) {
        return;
    }

    if (!awsCleanTaskDefinitions(in_serviceConfig)) {
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

    if (!awsCreateBucket(in_serviceConfig)) {
        return;
    }

    if (!awsCreateBucketUser(in_serviceConfig)) {
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
    let serviceConfig = service.accessConfig(aws.getMergedServiceConfig(in_serviceConfig), {
        service: {
            name: 'STRING',
            clusters: [
                {
                    name: 'STRING',
                    identity_file: 'STRING',
                    vpc_name: 'STRING',
                    launch_configuration: {
                        name: 'STRING',
                        security_groups: [
                            'STRING'
                        ]
                    },
                    default: 'BOOLEAN',
                    environment: 'STRING',
                    instance: {
                        type: 'STRING',
                        iam_role: 'STRING',
                        ami: 'STRING',
                        assign_public_ip: 'BOOLEAN',
                        user_data: [
                            'STRING'
                        ],
                        volumes: [
                            {
                                DeviceName: 'STRING',
                                Ebs: {
                                    Encrypted: 'BOOLEAN',
                                    DeleteOnTermination: 'BOOLEAN',
                                    SnapshotId: 'STRING',
                                    VolumeSize: 'NUMBER',
                                    VolumeType: 'STRING'
                                }
                            }
                        ]
                    }
                }
            ]
        },
        aws: {
            profile: 'STRING',
        },
        cwd: 'STRING'
    });

    let serviceName = serviceConfig.service.name;
    if (!serviceName) {
        cprint.yellow('Service name not set');
        return false;
    }

    if (!aws.installed()) {
        cprint.yellow('AWS-CLI isn\'t installed');
        return false;
    }

    let cluster = _getEnvironmentCluster(serviceConfig.service.clusters, in_environment);
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
        profile: serviceConfig.aws.profile
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
                    profile: serviceConfig.aws.profile
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
            profile: serviceConfig.aws.profile
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
        args.push(userData);
    }

    if (pemKeyName) {
        args.push('--key-name');
        args.push(pemKeyName);
    }

    let cmdResult = aws.cmd(args, {
        profile: serviceConfig.aws.profile
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
    let serviceConfig = service.accessConfig(aws.getMergedServiceConfig(in_serviceConfig), {
        service: {
            name: 'STRING',
            clusters: [
                {
                    name: 'STRING',
                    vpc_name: 'STRING',
                    load_balancer: {
                        name: 'STRING',
                        subnets: [
                            'STRING'
                        ],
                        security_groups: [
                            'STRING'
                        ],
                        tags: [
                            {
                                key: 'STRING',
                                val: 'STRING'
                            }
                        ],
                        ports: [
                            {
                                protocol: 'STRING',
                                load_balancer_port: 'NUMBER',
                                instance_protocol: 'STRING',
                                instance_port: 'NUMBER',
                                ssl_certificate_id: 'STRING'
                            }
                        ],
                        healthcheck: {
                            target: 'STRING',
                            interval: 'NUMBER',
                            timeout: 'NUMBER',
                            unhealthy_threshold: 'NUMBER',
                            healthy_threshold: 'NUMBER'
                        }
                    },
                    default: 'BOOLEAN',
                    environment: 'STRING'
                }
            ]
        },
        aws: {
            profile: 'STRING',
        },
        cwd: 'STRING'
    });

    let serviceName = serviceConfig.service.name;
    if (!serviceName) {
        cprint.yellow('Service name not set');
        return false;
    }

    if (!aws.installed()) {
        cprint.yellow('AWS-CLI isn\'t installed');
        return false;
    }

    let cluster = _getEnvironmentCluster(serviceConfig.service.clusters, in_environment);
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
        profile: serviceConfig.aws.profile
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
                    profile: serviceConfig.aws.profile
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
            profile: serviceConfig.aws.profile
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
                profile: serviceConfig.aws.profile
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
        profile: serviceConfig.aws.profile
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
            profile: serviceConfig.aws.profile
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
    let serviceConfig = service.accessConfig(aws.getMergedServiceConfig(in_serviceConfig), {
        docker: {
            image: {
                name: 'STRING'
            }
        },
        service: {
            name: 'STRING',
            clusters: [
                {
                    name: 'STRING',
                    vpc_name: 'STRING',
                    load_balancer: {
                        name: 'STRING'
                    },
                    launch_configuration: {
                        name: 'STRING'
                    },
                    auto_scaling_group: {
                        name: 'STRING',
                        health_check_grace_period: 'NUMBER',
                        subnets: [
                            'STRING'
                        ]
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
                    }
                }
            ]
        },
        aws: {
            profile: 'STRING',
        },
        cwd: 'STRING'
    });

    let serviceName = serviceConfig.service.name;
    if (!serviceName) {
        cprint.yellow('Service name not set');
        return false;
    }

    let dockerImageName = serviceConfig.docker.image.name;

    if (!aws.installed()) {
        cprint.yellow('AWS-CLI isn\'t installed');
        return false;
    }

    let cluster = _getEnvironmentCluster(serviceConfig.service.clusters, in_environment);
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
        profile: serviceConfig.aws.profile
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
        profile: serviceConfig.aws.profile
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
                profile: serviceConfig.aws.profile
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

    if (dockerImageName) {
        tagsDict.DockerImageName = dockerImageName;
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
        profile: serviceConfig.aws.profile
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
            profile: serviceConfig.aws.profile
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

function awsCreateBucket (in_serviceConfig) {
    let serviceConfig = service.accessConfig(aws.getMergedServiceConfig(in_serviceConfig), {
        model: {
            bucket: {
                name: 'STRING'
            }
        },
        aws: {
            profile: 'STRING',
        },
        cwd: 'STRING'
    });

    let awsBucketName = serviceConfig.model.bucket.name;
    if (!awsBucketName) {
        cprint.yellow('Service bucket name not set');
        return false;
    }

    if (!aws.installed()) {
        cprint.yellow('AWS-CLI isn\'t installed');
        return false;
    }

    let awsCache = cache.load(serviceConfig.cwd, 'aws');

    cprint.magenta('-- Bucket --');
    print.keyVal('AWS Bucket Name', awsBucketName);

    let awsBucketPath = aws.getBucketPathForBucketName(awsBucketName, {
        cache: awsCache,
        profile: serviceConfig.aws.profile
    });
    if (awsBucketPath) {
        cprint.green('AWS bucket already exists!');
        return true;
    }

    cprint.cyan('Creating bucket...');

    if (!aws.createBucket(awsBucketName, {
        profile: serviceConfig.aws.profile
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

function awsCreateBucketUser (in_serviceConfig) {
    let serviceConfig = service.accessConfig(aws.getMergedServiceConfig(in_serviceConfig), {
        model: {
            bucket: {
                username: 'STRING',
                name: 'STRING',
                region: 'STRING',
                permissions: [
                    'STRING'
                ]
            }
        },
        aws: {
            profile: 'STRING'
        },
        cwd: 'STRING'
    });

    let sourceFolder = serviceConfig.cwd || false;

    let awsBucketName = serviceConfig.model.bucket.name;
    if (!awsBucketName) {
        cprint.yellow('Service bucket name not set');
        return false;
    }

    let awsBucketUsername = serviceConfig.model.bucket.username;
    if (!awsBucketUsername) {
        cprint.yellow('Service bucket username not set');
        return false;
    }

    let awsBucketUsernamePermissions = serviceConfig.model.bucket.permissions || false;
    if (!awsBucketUsernamePermissions || !awsBucketUsernamePermissions.length) {
        awsBucketUsernamePermissions = ['read'];
    }

    if (!aws.installed()) {
        cprint.yellow('AWS-CLI isn\'t installed');
        return false;
    }

    let awsDockerCredentials = aws.getDockerCredentials(in_serviceConfig, {
        profile: serviceConfig.aws.profile
    });

    if (!awsDockerCredentials) {
        cprint.yellow('Failed to get AWS Docker credentials');
        return false;
    }

    let awsRegion = awsDockerCredentials.region;

    let awsCache = cache.load(serviceConfig.cwd, 'aws');

    cprint.magenta('-- Bucket User --');
    print.keyVal('AWS Bucket', awsBucketName);
    print.keyVal('AWS Bucket User Name', awsBucketUsername);

    let awsUserArn = aws.getUserArnForUsername(awsBucketUsername, {
        cache: awsCache,
        profile: serviceConfig.aws.profile
    });
    if (awsUserArn) {
        cprint.green('AWS bucket user already exists!');
        return true;
    }

    cprint.cyan('Creating bucket user...');

    if (!aws.createUser(awsBucketUsername, {
        profile: serviceConfig.aws.profile
    })) {
        return;
    }

    cprint.cyan('Creating access key...');

    let userObject = aws.createUserAccessKey(awsBucketUsername, {
        profile: serviceConfig.aws.profile
    });

    if (!userObject) {
        return;
    }

    let bucketUserAccessKey = userObject.AccessKey;
    let bucketUserSecretKey = userObject.SecretKey;
    let bucketRegion = in_serviceConfig.model.bucket.region || awsRegion;

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
        profile: serviceConfig.aws.profile
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
    awsCreateRepository(in_serviceConfig);

    if (!awsCreateTaskDefinition(in_serviceConfig)) {
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

function awsCreateRepository (in_serviceConfig) {
    let serviceConfig = service.accessConfig(aws.getMergedServiceConfig(in_serviceConfig), {
        docker: {
            image: {
                name: 'STRING',
            }
        },
        aws: {
            profile: 'STRING',
        },
        cwd: 'STRING'
    });

    if (!aws.installed()) {
        cprint.yellow('AWS-CLI isn\'t installed');
        return false;
    }

    let dockerImageName = serviceConfig.docker.image.name;
    if (!dockerImageName) {
        cprint.yellow('Docker image name not set');
        return false;
    }

    let awsDockerRepositoryUrl = aws.getDockerRepositoryUrl(in_serviceConfig);
    if (!awsDockerRepositoryUrl) {
        cprint.yellow('Couldn\'t get aws docker repository');
        return false;
    }

    let awsCache = cache.load(serviceConfig.cwd, 'aws');

    cprint.magenta('-- AWS Docker Repository --');
    print.keyVal('AWS Docker Image Name', dockerImageName);
    print.keyVal('AWS Docker Repository Url', awsDockerRepositoryUrl);

    let awsDockerRepository = aws.getDockerRepositoryForDockerImageName(dockerImageName, {
        cache: awsCache,
        verbose: true,
        profile: serviceConfig.aws.profile
    });
    if (awsDockerRepository) {
        cprint.green('Repository already exists!');
        return true;
    }

    cprint.cyan('Creating repository...');
    if (!aws.createDockerRepository(dockerImageName, {
        profile: serviceConfig.aws.profile
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

function awsCreateTaskDefinition (in_serviceConfig) {
    let serviceConfig = service.accessConfig(aws.getMergedServiceConfig(in_serviceConfig), {
        docker: {
            image: {
                name: 'STRING',
                version: 'STRING'
            },
            container: {
                memory_limit: 'NUMBER',
                logging_support: 'BOOLEAN',
                ports: [
                    {
                        test: 'BOOLEAN',
                        host: 'NUMBER',
                        container: 'NUMBER'
                    }
                ],
                volumes: [
                    {
                        container: 'STRING',
                        host: 'STRING',
                        name: 'STRING',
                        test: 'BOOLEAN'
                    }
                ],
                commands: [
                    {
                        test: 'BOOLEAN',
                        val: 'STRING'
                    }
                ],
                environment_variables: [
                    {
                        key: 'STRING',
                        value: 'STRING'
                    }
                ]
            }
        },
        service: {
            name: 'STRING',
            task_definition: {
                name: 'STRING'
            }
        },
        aws: {
            profile: 'STRING',
            account_id: 'NUMBER'
        },
        cwd: 'STRING'
    });

    let loggingSupport = !!serviceConfig.docker.container.logging_support;

    if (!aws.installed()) {
        cprint.yellow('AWS-CLI isn\'t installed');
        return false;
    }

    let serviceName = serviceConfig.service.name;
    if (!serviceName) {
        cprint.yellow('Service name not set');
        return false;
    }

    let awsTaskDefinitionName = serviceConfig.service.task_definition.name;
    if (!awsTaskDefinitionName) {
        cprint.yellow('Service task definition name not set');
        return false;
    }

    let awsTaskDefinitionEnvironmentVariables = serviceConfig.docker.container.environment_variables || [];

    let dockerImageName = serviceConfig.docker.image.name;
    if (!dockerImageName) {
        cprint.yellow('Docker image name not set');
        return false;
    }

    let dockerImageVersion = serviceConfig.docker.image.version || '1.0.0';

    let awsDockerRepositoryUrl = aws.getDockerRepositoryUrl(in_serviceConfig);
    if (!awsDockerRepositoryUrl) {
        cprint.yellow('Couldn\'t get aws docker repository');
        return false;
    }

    let awsTaskDefinitionImagePath = awsDockerRepositoryUrl + '/' + dockerImageName + ':' + dockerImageVersion;
    let awsTaskDefinitionMemoryLimit = serviceConfig.docker.container.memory_limit || 500;

    let awsCache = cache.load(serviceConfig.cwd, 'aws');

    cprint.magenta('-- Task Definition --');
    print.keyVal('AWS Task Definition Name', awsTaskDefinitionName);
    print.keyVal('AWS Task Definition Image Path', awsTaskDefinitionImagePath);

    // TODO - remove TM specific filebeat
    let awsTaskDefinitionFilebeatImagePath = awsDockerRepositoryUrl + '/' + 'filebeat-tm-services' + ':' + 'latest';
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

    let serviceContainerEnvironmentVariables = [];
    awsTaskDefinitionEnvironmentVariables.forEach(awsTaskDefinitionEnvironmentVariable => {
        let key = awsTaskDefinitionEnvironmentVariable.key;
        let value = awsTaskDefinitionEnvironmentVariable.value;

        key = service.replaceConfigReferences(in_serviceConfig, key);
        value = service.replaceConfigReferences(in_serviceConfig, value);

        serviceContainerEnvironmentVariables.push({
            name: key,
            value: value
        });
    });

    let serviceContainerDefinition = {
        'cpu': 0,
        'environment': serviceContainerEnvironmentVariables,
        'essential': true,
        'image': awsTaskDefinitionImagePath,
        'memoryReservation': awsTaskDefinitionMemoryLimit,
        'name': serviceName,
        'volumesFrom': []
    };

    serviceConfig.docker.container.commands.forEach(command => {
        if (command.test) {
            return;
        }

        serviceContainerDefinition.command = command.val
            .split(' ');
        return;
    });

    serviceConfig.docker.container.ports.forEach(port => {
        if (!port.host || !port.container) {
            return;
        }

        if (port.test) {
            return;
        }

        serviceContainerDefinition.portMappings = serviceContainerDefinition.portMappings || [];
        serviceContainerDefinition.portMappings.push({
            'containerPort': port.container,
            'hostPort': port.host,
            'protocol': 'tcp'
        });
    });

    serviceConfig.docker.container.volumes.forEach(volume => {
        if (!volume.container) {
            return;
        }

        if (volume.test) {
            return;
        }

        let volumeContainer = service.replaceConfigReferences(in_serviceConfig, volume.container);
        let volumeName = service.replaceConfigReferences(in_serviceConfig, volume.name || volume.host);

        serviceContainerDefinition.mountPoints = serviceContainerDefinition.mountPoints || [];
        serviceContainerDefinition.mountPoints.push({
            'containerPath': volumeContainer,
            'sourceVolume': volumeName,
            'readOnly': !!volume.readOnly
        });
    });

    // TODO - remove TM specific filebeat
    let filebeatContainerDefinition = {
        'cpu': 0,
        'environment': [],
        'essential': true,
        'image': awsTaskDefinitionFilebeatImagePath,
        'memoryReservation': awsTaskDefinitionFilebeatMemoryLimit,
        'name': 'filebeat-tm-services',
        'portMappings': [],
        'volumesFrom': []
    };

    awsTaskDefinitionFilebeatVolumes.forEach(volume => {
        if (!volume.container) {
            return;
        }

        let volumeContainer = service.replaceConfigReferences(in_serviceConfig, volume.container);
        let volumeName = service.replaceConfigReferences(in_serviceConfig, volume.name || volume.host);

        filebeatContainerDefinition.mountPoints = filebeatContainerDefinition.mountPoints || [];
        filebeatContainerDefinition.mountPoints.push({
            'containerPath': volumeContainer,
            'sourceVolume': volumeName,
            'readOnly': !!volume.readOnly
        });
    });

    let containerDefinitions = [serviceContainerDefinition];
    if (loggingSupport) {
        containerDefinitions.push(filebeatContainerDefinition);
    }

    let awsTaskDefinitionStructure = {
        'containerDefinitions': containerDefinitions,
        'family': awsTaskDefinitionName,
        'networkMode': 'bridge',
        'placementConstraints': []
    };

    let containerVolumes = serviceConfig.docker.container.volumes;
    if (loggingSupport) {
        containerVolumes = containerVolumes.concat(awsTaskDefinitionFilebeatVolumes);
    }

    let uniqueHosts = {};
    containerVolumes
        .forEach(volume => {
            if (volume.test) {
                return;
            }
            let volumeName = service.replaceConfigReferences(in_serviceConfig, volume.name || volume.host);
            uniqueHosts[volumeName] = volume;
        });

    Object.keys(uniqueHosts)
        .forEach(host => {
            let volume = uniqueHosts[host];
            // let volumeContainer = service.replaceConfigReferences(in_serviceConfig, volume.container);
            let sourcePath = service.replaceConfigReferences(in_serviceConfig, volume.host);
            let volumeName = service.replaceConfigReferences(in_serviceConfig, volume.name || volume.host);

            awsTaskDefinitionStructure.volumes = awsTaskDefinitionStructure.volumes || [];
            awsTaskDefinitionStructure.volumes.push({
                'host': {
                    'sourcePath': sourcePath
                },
                'name': volumeName
            });
        });

    cprint.cyan('Creating task definition...');

    let cmdResult = aws.cmd([
        'ecs',
        'register-task-definition',
        '--cli-input-json',
        JSON.stringify(awsTaskDefinitionStructure)
    ], {
        profile: serviceConfig.aws.profile
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
    }

    if (service.hasConfigFile(serviceConfig.cwd)) {
        cache.save(serviceConfig.cwd, 'aws', awsCache);
    }

    cprint.magenta('----');
    return true;
}

// ******************************

function awsCreateCluster (in_serviceConfig, in_environment) {
    let serviceConfig = service.accessConfig(aws.getMergedServiceConfig(in_serviceConfig), {
        service: {
            name: 'STRING',
            clusters: [
                {
                    name: 'STRING',
                    default: 'BOOLEAN',
                    environment: 'STRING'
                }
            ]
        },
        aws: {
            profile: 'STRING',
        },
        cwd: 'STRING'
    });

    let serviceName = serviceConfig.service.name;
    if (!serviceName) {
        cprint.yellow('Service name not set');
        return false;
    }

    if (!aws.installed()) {
        cprint.yellow('AWS-CLI isn\'t installed');
        return false;
    }

    let cluster = _getEnvironmentCluster(serviceConfig.service.clusters, in_environment);
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
        profile: serviceConfig.aws.profile
    });
    if (awsClusterArn) {
        cprint.green('Cluster already exists!');
        return true;
    }

    cprint.cyan('Creating cluster...');
    if (!aws.createCluster(awsClusterName, {
        profile: serviceConfig.aws.profile
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
    let serviceConfig = service.accessConfig(aws.getMergedServiceConfig(in_serviceConfig), {
        docker: {
            image: {
                name: 'STRING',
                version: 'STRING'
            },
            container: {
                ports: [
                    {
                        container: 'NUMBER',
                        host: 'NUMBER',
                        test: 'BOOLEAN'
                    }
                ]
            }
        },
        service: {
            name: 'STRING',
            task_definition: {
                name: 'STRING'
            },
            clusters: [
                {
                    name: 'STRING',
                    service_name: 'STRING',
                    role: 'STRING',
                    default: 'BOOLEAN',
                    environment: 'STRING',
                    load_balancer: {
                        name: 'STRING'
                    },
                    instance: {
                        count: 'NUMBER'
                    },
                    auto_scaling_group: {
                        health_check_grace_period: 'NUMBER'
                    }
                }
            ]
        },
        aws: {
            profile: 'STRING',
        },
        cwd: 'STRING'
    });

    let serviceName = serviceConfig.service.name;
    if (!serviceName) {
        cprint.yellow('Service name not set');
        return false;
    }

    if (!aws.installed()) {
        cprint.yellow('AWS-CLI isn\'t installed');
        return false;
    }

    let awsTaskDefinitionName = serviceConfig.service.task_definition.name;
    if (!awsTaskDefinitionName) {
        cprint.yellow('Service task definition name not set');
        return false;
    }

    let awsDockerRepositoryUrl = aws.getDockerRepositoryUrl(in_serviceConfig);
    if (!awsDockerRepositoryUrl) {
        cprint.yellow('Couldn\'t get aws docker repository');
        return false;
    }

    let dockerContainerName = serviceName;

    let cluster = _getEnvironmentCluster(serviceConfig.service.clusters, in_environment);
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

            if (port.test) {
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
        profile: serviceConfig.aws.profile
    });
    if (!taskDefinitionArn) {
        return;
    }

    print.clearLine();
    print.keyVal('AWS Task Definition', awsTaskDefinitionName);

    let awsClusterServiceArn = aws.getClusterServiceArnForClusterName(awsClusterName, awsClusterServiceName, {
        cache: awsCache,
        profile: serviceConfig.aws.profile
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
        profile: serviceConfig.aws.profile
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

function awsCreateEC2AccessECSRole (in_serviceConfig) {
    let serviceConfig = service.accessConfig(aws.getMergedServiceConfig(in_serviceConfig), {
        aws: {
            profile: 'STRING',
        },
        cwd: 'STRING'
    });

    if (!aws.installed()) {
        cprint.yellow('AWS-CLI isn\'t installed');
        return false;
    }

    let awsRoleName = 'ecsInstanceRole';

    let awsCache = cache.load(serviceConfig.cwd, 'aws');

    cprint.magenta('-- AWS EC2 Access ECS Role --');
    print.keyVal('AWS Role Name', awsRoleName);

    let awsRoleArn = aws.getRoleArnForRoleName(awsRoleName, {
        cache: awsCache,
        showWarning: false,
        profile: serviceConfig.aws.profile
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
        profile: serviceConfig.aws.profile
    })) {
        return;
    }

    let awsEC2ContainerServiceforEC2RolePolicyArn = 'arn:aws:iam::aws:policy/service-role/AmazonEC2ContainerServiceforEC2Role';

    print.keyVal('AWS Role Policy', aws.arnToTitle(awsEC2ContainerServiceforEC2RolePolicyArn));

    cprint.cyan('Attaching role policy...');
    if (!aws.attachRolePolicy(awsRoleName, awsEC2ContainerServiceforEC2RolePolicyArn, {
        profile: serviceConfig.aws.profile
    })) {
        return;
    }

    let awsInstanceProfileName = awsRoleName;

    print.keyVal('AWS Role Instance Profile', awsInstanceProfileName);

    cprint.cyan('Creating instance profile...');
    if (!aws.createInstanceProfile(awsInstanceProfileName, {
        profile: serviceConfig.aws.profile
    })) {
        return;
    }

    cprint.cyan('Adding role to instance profile...');
    if (!aws.addRoleToInstanceProfile(awsInstanceProfileName, awsRoleName, {
        profile: serviceConfig.aws.profile
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

function awsCreateECSAccessELBRole (in_serviceConfig) {
    let serviceConfig = service.accessConfig(aws.getMergedServiceConfig(in_serviceConfig), {
        aws: {
            profile: 'STRING',
        },
        cwd: 'STRING'
    });

    if (!aws.installed()) {
        cprint.yellow('AWS-CLI isn\'t installed');
        return false;
    }

    let awsRoleName = 'ecsServiceRole';

    let awsCache = cache.load(serviceConfig.cwd, 'aws');

    cprint.magenta('-- AWS ECS Access ELB Role --');
    print.keyVal('AWS Role Name', awsRoleName);

    let awsRoleArn = aws.getRoleArnForRoleName(awsRoleName, {
        cache: awsCache,
        showWarning: false,
        profile: serviceConfig.aws.profile
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
        profile: serviceConfig.aws.profile
    })) {
        return;
    }

    let awsECSRolePolicyArn = 'arn:aws:iam::aws:policy/service-role/AmazonEC2ContainerServiceRole';

    print.keyVal('AWS Role Policy', aws.arnToTitle(awsECSRolePolicyArn));

    cprint.cyan('Attaching role policy...');
    if (!aws.attachRolePolicy(awsRoleName, awsECSRolePolicyArn, {
        profile: serviceConfig.aws.profile
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
    awsCleanDeliveryStructure(in_serviceConfig);
    return true;
}

// ******************************

function awsCleanInfrastructure (in_serviceConfig, in_environment) {
    awsCleanLaunchConfigurations(in_serviceConfig, in_environment);
    return true;
}

// ******************************

function awsCleanLaunchConfigurations (in_serviceConfig, in_environment) {
    let serviceConfig = service.accessConfig(aws.getMergedServiceConfig(in_serviceConfig), {
        docker: {
            image: {
                name: 'STRING'
            }
        },
        service: {
            name: 'STRING',
            clusters: [
                {
                    name: 'STRING',
                    vpc_name: 'STRING',
                    load_balancer: {
                        name: 'STRING'
                    },
                    launch_configuration: {
                        name: 'STRING'
                    },
                    auto_scaling_group: {
                        name: 'STRING',
                        subnets: [
                            'STRING'
                        ]
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
                    }
                }
            ]
        },
        aws: {
            profile: 'STRING',
        },
        cwd: 'STRING'
    });

    cprint.cyan('Cleaning launch configurations...');

    let serviceName = serviceConfig.service.name;
    if (!serviceName) {
        cprint.yellow('Service name not set');
        return false;
    }

    if (!aws.installed()) {
        cprint.yellow('AWS-CLI isn\'t installed');
        return false;
    }

    let cluster = _getEnvironmentCluster(serviceConfig.service.clusters, in_environment);
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
        profile: serviceConfig.aws.profile
    });

    if (!awsLaunchConfigurationNames || !awsLaunchConfigurationNames.length) {
        cprint.green('Nothing to clean up!');
        return true;
    }

    awsLaunchConfigurationNames
        .filter(l => !aws.getAutoScalingGroupForLaunchConfiguration(l, {
            cache: awsCache,
            showWarning: true,
            profile: serviceConfig.aws.profile,
            verbose: true
        }))
        .forEach(l => {
            aws.deleteLaunchConfiguration(l, {
                profile: serviceConfig.aws.profile
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

function awsCleanDeliveryStructure (in_serviceConfig) {
    awsCleanRepository(in_serviceConfig);
    awsCleanTaskDefinitions(in_serviceConfig);
    return true;
}

// ******************************

function awsCleanRepository (in_serviceConfig) {
    let serviceConfig = service.accessConfig(aws.getMergedServiceConfig(in_serviceConfig), {
        docker: {
            image: {
                name: 'STRING',
            }
        },
        aws: {
            profile: 'STRING',
        },
        cwd: 'STRING'
    });

    cprint.cyan('Cleaning repositories...');

    if (!aws.installed()) {
        cprint.yellow('AWS-CLI isn\'t installed');
        return false;
    }

    let dockerImageName = serviceConfig.docker.image.name;
    if (!dockerImageName) {
        cprint.yellow('Docker image name not set');
        return false;
    }

    let awsDockerRepositoryUrl = aws.getDockerRepositoryUrl(in_serviceConfig);
    if (!awsDockerRepositoryUrl) {
        cprint.yellow('Couldn\'t get aws docker repository');
        return false;
    }

    let awsCache = cache.load(serviceConfig.cwd, 'aws');

    let awsDockerRepository = aws.getDockerRepositoryForDockerImageName(dockerImageName, {
        cache: awsCache,
        verbose: true,
        profile: serviceConfig.aws.profile
    });
    if (!awsDockerRepository) {
        cprint.yellow('Repository does not exist!');
        return;
    }

    let awsDockerRepositoryImages = aws.getDockerRepositoryImagesForRepositoryName(awsDockerRepository, {
        cache: awsCache,
        verbose: true,
        profile: serviceConfig.aws.profile
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
        profile: serviceConfig.aws.profile
    });

    aws.clearCachedDockerRepositoryImagesForRepositoryName(awsDockerRepository, awsCache);

    if (service.hasConfigFile(serviceConfig.cwd)) {
        cache.save(serviceConfig.cwd, 'aws', awsCache);
    }

    cprint.magenta('----');
    return true;
}

// ******************************

function awsCleanTaskDefinitions (in_serviceConfig) {
    let serviceConfig = service.accessConfig(aws.getMergedServiceConfig(in_serviceConfig), {
        service: {
            task_definition: {
                name: 'STRING'
            },
            name: 'STRING'
        },
        aws: {
            profile: 'STRING',
        },
        cwd: 'STRING'
    });

    cprint.cyan('Cleaning task definitions...');

    let serviceName = serviceConfig.service.name;
    if (!serviceName) {
        cprint.yellow('Service name not set');
        return false;
    }

    let awsTaskDefinitionName = serviceConfig.service.task_definition.name;
    if (!awsTaskDefinitionName) {
        cprint.yellow('Service task definition name not set');
        return false;
    }

    if (!aws.installed()) {
        cprint.yellow('AWS-CLI isn\'t installed');
        return false;
    }

    let awsCache = cache.load(serviceConfig.cwd, 'aws');

    let taskDefinitionArns = aws.getPreviousTaskDefinitionArnsForTaskDefinition(awsTaskDefinitionName, {
        cache: awsCache,
        verbose: true,
        profile: serviceConfig.aws.profile
    });

    if (!taskDefinitionArns || !taskDefinitionArns.length) {
        cprint.green('Nothing to clean up!');
        return true;
    }

    taskDefinitionArns
        .forEach(t => {
            aws.deregisterTaskDefinition(t, {
                profile: serviceConfig.aws.profile
            });
        });

    if (service.hasConfigFile(serviceConfig.cwd)) {
        cache.save(serviceConfig.cwd, 'aws', awsCache);
    }
    return true;
}

// ******************************

function awsUpdateAutoScalingGroup (in_serviceConfig, in_environment) {
    let serviceConfig = service.accessConfig(aws.getMergedServiceConfig(in_serviceConfig), {
        docker: {
            image: {
                name: 'STRING'
            }
        },
        service: {
            name: 'STRING',
            clusters: [
                {
                    name: 'STRING',
                    vpc_name: 'STRING',
                    load_balancer: {
                        name: 'STRING'
                    },
                    launch_configuration: {
                        name: 'STRING'
                    },
                    auto_scaling_group: {
                        name: 'STRING',
                        health_check_grace_period: 'NUMBER',
                        subnets: [
                            'STRING'
                        ]
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
                    }
                }
            ]
        },
        aws: {
            profile: 'STRING',
        },
        cwd: 'STRING'
    });

    let serviceName = serviceConfig.service.name;
    if (!serviceName) {
        cprint.yellow('Service name not set');
        return false;
    }

    let dockerImageName = serviceConfig.docker.image.name;

    if (!aws.installed()) {
        cprint.yellow('AWS-CLI isn\'t installed');
        return false;
    }

    let cluster = _getEnvironmentCluster(serviceConfig.service.clusters, in_environment);
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
        profile: serviceConfig.aws.profile
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
        profile: serviceConfig.aws.profile
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
                profile: serviceConfig.aws.profile
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

    if (dockerImageName) {
        tagsDict.DockerImageName = dockerImageName;
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
        profile: serviceConfig.aws.profile
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
            profile: serviceConfig.aws.profile
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

function awsDockerLogin (in_serviceConfig) {
    let serviceConfig = service.accessConfig(aws.getMergedServiceConfig(in_serviceConfig), {
        aws: {
            profile: 'STRING',
        },
        cwd: 'STRING'
    });

    if (!aws.installed()) {
        cprint.yellow('AWS-CLI isn\'t installed');
        return false;
    }

    if (!docker.running()) {
        cprint.yellow('Docker isn\'t running');
        return false;
    }

    let awsDockerCredentials = aws.getDockerCredentials(in_serviceConfig, {
        profile: serviceConfig.aws.profile
    });

    if (!awsDockerCredentials) {
        cprint.yellow('Failed to get AWS Docker credentials');
        return false;
    }

    let awsDockerRepositoryUrl = aws.getDockerRepositoryUrl(in_serviceConfig);
    if (!awsDockerRepositoryUrl) {
        cprint.yellow('Couldn\'t get aws docker repository');
        return false;
    }

    let success = docker.login(awsDockerCredentials.username, awsDockerCredentials.password, awsDockerRepositoryUrl);
    if (!success) {
        cprint.yellow('Check your regions match in your .aws/config and service.json');
        return false;
    }

    serviceConfig = service.updateConfig(in_serviceConfig, {
        aws: {
            account_id: awsDockerCredentials.account_id,
            region: awsDockerCredentials.region
        }
    });
}

// ******************************

function awsStartCluster (in_serviceConfig, in_environment) {
    let serviceConfig = service.accessConfig(aws.getMergedServiceConfig(in_serviceConfig), {
        service: {
            name: 'STRING',
            clusters: [
                {
                    default: 'BOOLEAN',
                    environment: 'STRING',
                    auto_scaling_group: {
                        name: 'STRING'
                    },
                    instance: {
                        count: 'NUMBER'
                    }
                }
            ]
        },
        aws: {
            profile: 'STRING',
        },
        cwd: 'STRING'
    });

    let awsCache = cache.load(serviceConfig.cwd, 'aws');

    let serviceName = serviceConfig.service.name;
    if (!serviceName) {
        cprint.yellow('Service name not set');
        return false;
    }

    if (!aws.installed()) {
        cprint.yellow('AWS-CLI isn\'t installed');
        return false;
    }

    let cluster = _getEnvironmentCluster(serviceConfig.service.clusters, in_environment);
    if (!cluster) {
        if (in_environment) {
            cprint.yellow('No cluster set for "' + in_environment + '" environment');
        } else {
            cprint.yellow('No default environment defined');
        }
        return false;
    }

    let instanceCount = cluster.instance.count || 2;

    let autoScalingGroupName = cluster.auto_scaling_group.name;
    let autoScalingGroupInstanceCount = aws.getAutoScalingGroupInstanceCount(autoScalingGroupName, {
        profile: serviceConfig.aws.profile,
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
            profile: serviceConfig.aws.profile
        });
    } else if (autoScalingGroupInstanceCount != instanceCount) {
        cprint.cyan('Updating AWS cluster...');
        aws.setAutoScalingGroupInstanceCount(autoScalingGroupName, instanceCount, {
            cache: awsCache,
            profile: serviceConfig.aws.profile
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
    let serviceConfig = service.accessConfig(aws.getMergedServiceConfig(in_serviceConfig), {
        service: {
            name: 'STRING',
            clusters: [
                {
                    default: 'BOOLEAN',
                    environment: 'STRING',
                    auto_scaling_group: {
                        name: 'STRING'
                    }
                }
            ]
        },
        aws: {
            profile: 'STRING',
        },
        cwd: 'STRING'
    });

    let awsCache = cache.load(serviceConfig.cwd, 'aws');

    let serviceName = serviceConfig.service.name;
    if (!serviceName) {
        cprint.yellow('Service name not set');
        return false;
    }

    if (!aws.installed()) {
        cprint.yellow('AWS-CLI isn\'t installed');
        return false;
    }

    let cluster = _getEnvironmentCluster(serviceConfig.service.clusters, in_environment);
    if (!cluster) {
        if (in_environment) {
            cprint.yellow('No cluster set for "' + in_environment + '" environment');
        } else {
            cprint.yellow('No default environment defined');
        }
        return false;
    }

    let autoScalingGroupName = cluster.auto_scaling_group.name;
    let autoScalingGroupInstanceCount = aws.getAutoScalingGroupInstanceCount(autoScalingGroupName, {
        profile: serviceConfig.aws.profile,
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
            profile: serviceConfig.aws.profile
        });
    } else {
        cprint.green('AWS cluster already stopped');
    }

    if (service.hasConfigFile(serviceConfig.cwd)) {
        cache.save(serviceConfig.cwd, 'aws', awsCache);
    }
}

// ******************************

function awsViewConsoleLogin (in_serviceConfig) {
    let serviceConfig = service.accessConfig(aws.getMergedServiceConfig(in_serviceConfig), {
        aws: {
            account_id: 'NUMBER'
        }
    });

    let awsAccountId = serviceConfig.aws.account_id || false;

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
    awsViewBucket(in_serviceConfig);
    awsViewBucketUser(in_serviceConfig);
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
    let serviceConfig = service.accessConfig(aws.getMergedServiceConfig(in_serviceConfig), {
        service: {
            name: 'STRING',
            clusters: [
                {
                    default: 'BOOLEAN',
                    environment: 'STRING'
                }
            ]
        },
        aws: {
            profile: 'STRING',
        }
    });

    let cluster = _getEnvironmentCluster(serviceConfig.service.clusters, in_environment);
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

    let serviceName = serviceConfig.service.name;
    if (!serviceName) {
        cprint.yellow('Service name not set');
        return false;
    }

    let awsDockerCredentials = aws.getDockerCredentials(in_serviceConfig, {
        profile: serviceConfig.aws.profile
    });

    if (!awsDockerCredentials) {
        cprint.yellow('Failed to get AWS Docker credentials');
        return false;
    }

    let awsRegion = awsDockerCredentials.region;

    let url = `${awsRegion}.console.aws.amazon.com/ec2/v2/home?region=${awsRegion}#Instances:tag:Environment=${environmentTitle};tag:ServiceName=${serviceName}`;
    url = 'https://' + url;
    print.out(cprint.toMagenta('Opening Url: ') + cprint.toGreen(url) + '\n');
    _openUrl(url);
    return true;
}

// ******************************

function awsViewLoadBalancer (in_serviceConfig, in_environment) {
    let serviceConfig = service.accessConfig(aws.getMergedServiceConfig(in_serviceConfig), {
        service: {
            clusters: [
                {
                    load_balancer: {
                        name: 'STRING'
                    },
                    default: 'BOOLEAN',
                    environment: 'STRING'
                }
            ]
        },
        aws: {
            profile: 'STRING',
        }
    });

    let cluster = _getEnvironmentCluster(serviceConfig.service.clusters, in_environment);
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

    let awsDockerCredentials = aws.getDockerCredentials(in_serviceConfig, {
        profile: serviceConfig.aws.profile
    });

    if (!awsDockerCredentials) {
        cprint.yellow('Failed to get AWS Docker credentials');
        return false;
    }

    let awsRegion = awsDockerCredentials.region;

    let url = `${awsRegion}.console.aws.amazon.com/ec2/v2/home?region=${awsRegion}#LoadBalancers:search=${awsLoadBalancerName}`;
    url = 'https://' + url;
    print.out(cprint.toMagenta('Opening Url: ') + cprint.toGreen(url) + '\n');
    _openUrl(url);
    return true;
}

// ******************************

function awsViewLaunchConfiguration (in_serviceConfig, in_environment) {
    let serviceConfig = service.accessConfig(aws.getMergedServiceConfig(in_serviceConfig), {
        service: {
            clusters: [
                {
                    launch_configuration: {
                        name: 'STRING'
                    },
                    default: 'BOOLEAN',
                    environment: 'STRING'
                }
            ]
        },
        aws: {
            profile: 'STRING',
        }
    });

    let cluster = _getEnvironmentCluster(serviceConfig.service.clusters, in_environment);
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

    let awsDockerCredentials = aws.getDockerCredentials(in_serviceConfig, {
        profile: serviceConfig.aws.profile
    });

    if (!awsDockerCredentials) {
        cprint.yellow('Failed to get AWS Docker credentials');
        return false;
    }

    let awsRegion = awsDockerCredentials.region;

    let url = `${awsRegion}.console.aws.amazon.com/ec2/autoscaling/home?region=${awsRegion}#LaunchConfigurations:id=${awsLaunchConfigurationName};filter=${awsLaunchConfigurationName}`;
    url = 'https://' + url;
    print.out(cprint.toMagenta('Opening Url: ') + cprint.toGreen(url) + '\n');
    _openUrl(url);
    return true;
}

// ******************************

function awsViewAutoScalingGroup (in_serviceConfig, in_environment) {
    let serviceConfig = service.accessConfig(aws.getMergedServiceConfig(in_serviceConfig), {
        service: {
            clusters: [
                {
                    auto_scaling_group: {
                        name: 'STRING'
                    },
                    default: 'BOOLEAN',
                    environment: 'STRING'
                }
            ]
        },
        aws: {
            profile: 'STRING',
        }
    });

    let cluster = _getEnvironmentCluster(serviceConfig.service.clusters, in_environment);
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

    let awsDockerCredentials = aws.getDockerCredentials(in_serviceConfig, {
        profile: serviceConfig.aws.profile
    });

    if (!awsDockerCredentials) {
        cprint.yellow('Failed to get AWS Docker credentials');
        return false;
    }

    let awsRegion = awsDockerCredentials.region;

    let url = `${awsRegion}.console.aws.amazon.com/ec2/autoscaling/home?region=${awsRegion}#AutoScalingGroups:id=${awsAutoScalingGroupName};filter=${awsAutoScalingGroupName}`;
    url = 'https://' + url;
    print.out(cprint.toMagenta('Opening Url: ') + cprint.toGreen(url) + '\n');
    _openUrl(url);
    return true;
}

// ******************************

function awsViewDeliveryStructure (in_serviceConfig, in_environment) {
    awsViewRepository(in_serviceConfig);
    awsViewTaskDefinition(in_serviceConfig);
    awsViewCluster(in_serviceConfig, in_environment);
    awsViewClusterService(in_serviceConfig, in_environment);
}

// ******************************

function awsViewRepository (in_serviceConfig) {
    let serviceConfig = service.accessConfig(aws.getMergedServiceConfig(in_serviceConfig), {
        docker: {
            image: {
                name: 'STRING'
            }
        },
        aws: {
            profile: 'STRING',
        }
    });

    let dockerImageName = serviceConfig.docker.image.name;
    if (!dockerImageName) {
        cprint.yellow('Docker image name not set');
        return false;
    }

    if (!aws.installed()) {
        cprint.yellow('AWS-CLI isn\'t installed');
        return false;
    }

    let awsDockerCredentials = aws.getDockerCredentials(in_serviceConfig, {
        profile: serviceConfig.aws.profile
    });

    if (!awsDockerCredentials) {
        cprint.yellow('Failed to get AWS Docker credentials');
        return false;
    }

    let awsRegion = awsDockerCredentials.region;

    let url = `${awsRegion}.console.aws.amazon.com/ecs/home?region=${awsRegion}#/repositories/${dockerImageName}#images;tagStatus=ALL`;
    url = 'https://' + url;
    print.out(cprint.toMagenta('Opening Url: ') + cprint.toGreen(url) + '\n');
    _openUrl(url);
    return true;
}

// ******************************

function awsViewTaskDefinition (in_serviceConfig) {
    let serviceConfig = service.accessConfig(aws.getMergedServiceConfig(in_serviceConfig), {
        service: {
            task_definition: {
                name: 'STRING'
            }
        },
        aws: {
            profile: 'STRING',
        }
    });

    let awsTaskDefinitionName = serviceConfig.service.task_definition.name;
    if (!awsTaskDefinitionName) {
        cprint.yellow('Service task definition name not set');
        return false;
    }

    if (!aws.installed()) {
        cprint.yellow('AWS-CLI isn\'t installed');
        return false;
    }

    let awsDockerCredentials = aws.getDockerCredentials(in_serviceConfig, {
        profile: serviceConfig.aws.profile
    });

    if (!awsDockerCredentials) {
        cprint.yellow('Failed to get AWS Docker credentials');
        return false;
    }

    let awsRegion = awsDockerCredentials.region;

    let url = `${awsRegion}.console.aws.amazon.com/ecs/home?region=${awsRegion}#/taskDefinitions/${awsTaskDefinitionName}/latest`;
    url = 'https://' + url;
    print.out(cprint.toMagenta('Opening Url: ') + cprint.toGreen(url) + '\n');
    _openUrl(url);
    return true;
}

// ******************************

function awsViewCluster (in_serviceConfig, in_environment) {
    let serviceConfig = service.accessConfig(aws.getMergedServiceConfig(in_serviceConfig), {
        service: {
            clusters: [
                {
                    name: 'STRING',
                    default: 'BOOLEAN',
                    environment: 'STRING'
                }
            ]
        },
        aws: {
            profile: 'STRING',
        }
    });

    let cluster = _getEnvironmentCluster(serviceConfig.service.clusters, in_environment);
    if (!cluster) {
        if (in_environment) {
            cprint.yellow('No cluster set for "' + in_environment + '" environment');
        } else {
            cprint.yellow('No default environment defined');
        }
        return false;
    }

    let awsDockerCredentials = aws.getDockerCredentials(in_serviceConfig, {
        profile: serviceConfig.aws.profile
    });

    if (!awsDockerCredentials) {
        cprint.yellow('Failed to get AWS Docker credentials');
        return false;
    }

    let awsRegion = awsDockerCredentials.region;
    let awsClusterName = cluster.name;

    let url = `${awsRegion}.console.aws.amazon.com/ecs/home?region=${awsRegion}#/clusters/${awsClusterName}/tasks`;
    url = 'https://' + url;
    print.out(cprint.toMagenta('Opening Url: ') + cprint.toGreen(url) + '\n');
    _openUrl(url);
    return true;
}

// ******************************

function awsViewClusterService (in_serviceConfig, in_environment) {
    let serviceConfig = service.accessConfig(aws.getMergedServiceConfig(in_serviceConfig), {
        service: {
            clusters: [
                {
                    name: 'STRING',
                    service_name: 'STRING',
                    default: 'BOOLEAN',
                    environment: 'STRING'
                }
            ]
        },
        aws: {
            profile: 'STRING',
        }
    });

    let cluster = _getEnvironmentCluster(serviceConfig.service.clusters, in_environment);
    if (!cluster) {
        if (in_environment) {
            cprint.yellow('No cluster set for "' + in_environment + '" environment');
        } else {
            cprint.yellow('No default environment defined');
        }
        return false;
    }

    let awsDockerCredentials = aws.getDockerCredentials(in_serviceConfig, {
        profile: serviceConfig.aws.profile
    });

    if (!awsDockerCredentials) {
        cprint.yellow('Failed to get AWS Docker credentials');
        return false;
    }

    let awsRegion = awsDockerCredentials.region;
    let awsClusterName = cluster.name;
    let awsClusterServiceName = cluster.service_name;

    let url = `${awsRegion}.console.aws.amazon.com/ecs/home?region=${awsRegion}#/clusters/${awsClusterName}/services/${awsClusterServiceName}/tasks`;
    url = 'https://' + url;
    print.out(cprint.toMagenta('Opening Url: ') + cprint.toGreen(url) + '\n');
    _openUrl(url);
    return true;
}

// ******************************

function awsViewBucket (in_serviceConfig) {
    let serviceConfig = service.accessConfig(aws.getMergedServiceConfig(in_serviceConfig), {
        model: {
            bucket: {
                name: 'STRING'
            }
        },
        aws: {
            profile: 'STRING',
        },
        cwd: 'STRING'
    });

    let awsBucketName = serviceConfig.model.bucket.name;
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

function awsViewBucketUser (in_serviceConfig) {
    let serviceConfig = service.accessConfig(aws.getMergedServiceConfig(in_serviceConfig), {
        model: {
            bucket: {
                username: 'STRING'
            }
        },
        aws: {
            profile: 'STRING'
        },
        cwd: 'STRING'
    });

    let awsBucketUsername = serviceConfig.model.bucket.username;
    if (!awsBucketUsername) {
        cprint.yellow('Service bucket username not set');
        return false;
    }

    let awsDockerCredentials = aws.getDockerCredentials(in_serviceConfig, {
        profile: serviceConfig.aws.profile
    });

    if (!awsDockerCredentials) {
        cprint.yellow('Failed to get AWS Docker credentials');
        return false;
    }

    let awsRegion = awsDockerCredentials.region;

    let url = `console.aws.amazon.com/iam/home?region=${awsRegion}#/users/${awsBucketUsername}`;
    url = 'https://' + url;
    print.out(cprint.toMagenta('Opening Url: ') + cprint.toGreen(url) + '\n');
    _openUrl(url);
    return true;
}

// ******************************

function awsViewEndpoint (in_serviceConfig, in_environment) {
    let serviceConfig = service.accessConfig(aws.getMergedServiceConfig(in_serviceConfig), {
        service: {
            clusters: [
                {
                    environment: 'STRING',
                    default: 'BOOLEAN',
                    url: 'URL'
                }
            ]
        },
        cwd: 'STRING'
    });

    let cluster = _getEnvironmentCluster(serviceConfig.service.clusters, in_environment);
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

function _getEnvironmentCluster (in_clusters, in_environment) {
    let clusters = in_clusters || [];

    if (in_environment) {
        let environmentCluster = clusters.find(c => {
            return c.environment === in_environment;
        });

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
// Plugin Functions:
// ******************************

function handleCommand (in_args, in_params, in_serviceConfig) {
    let command = in_params.length ? in_params.shift().toLowerCase() : '';
    let env = in_args['env'] || in_args['environment'] || false;
    let extra = in_args['extra'];
    let stopTasks = in_args['stop-tasks'];

    let serviceConfig = in_serviceConfig || {};
    let serviceConfigAws = serviceConfig.aws || {};

    let allowProdAccess = serviceConfigAws.__allow_prod_access__;
    let isProd = (env === 'prod' || env === 'production');

    if (isProd && !allowProdAccess) {
        cprint.red('Production access has been denied');
        return true;
    }

    switch(command)
    {
    case '':
    case 'info':
    case 'state':
    case 'service':
        printAwsServiceInfo(in_serviceConfig, env, extra);
        break;

    case 'docker-login':
        awsDockerLogin(in_serviceConfig);
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
        awsCreateBucket(in_serviceConfig);
        break;

    case 'create-bucket-user':
        awsCreateBucketUser(in_serviceConfig);
        break;

    case 'create-delivery-structure':
        awsCreateDeliveryStructure(in_serviceConfig, env);
        break;

    case 'create-repository':
        awsCreateRepository(in_serviceConfig);
        break;

    case 'create-task-definition':
        awsCreateTaskDefinition(in_serviceConfig);
        break;

    case 'create-cluster':
        awsCreateCluster(in_serviceConfig, env);
        break;

    case 'create-cluster-service':
        awsCreateClusterService(in_serviceConfig, env);
        break;

    case 'create-ec2-access-ecs-role':
        awsCreateEC2AccessECSRole(in_serviceConfig);
        break;

    case 'create-ecs-access-elb-role':
        awsCreateECSAccessELBRole(in_serviceConfig);
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
        awsCleanRepository(in_serviceConfig);
        break;

    case 'clean-task-definitions':
        awsCleanTaskDefinitions(in_serviceConfig);
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
        awsViewConsoleLogin(in_serviceConfig);
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
        awsViewBucket(in_serviceConfig);
        break;

    case 'view-bucket-user':
        awsViewBucketUser(in_serviceConfig);
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
        awsDeployNewTaskDefinition(in_serviceConfig, stopTasks, env);
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
        { params: ['docker-login'], description: 'Log into AWS docker repository' },

        { params: ['create-all', 'create'], description: 'Create all infrastructure and delivery structures for the service', options: [{param:'environment', description:'Environment'}] },

        { params: ['create-infrastructure'], description: 'Create infrastructure for the service', options: [{param:'environment', description:'Environment'}] },
        { params: ['create-launch-configuration'], description: 'Create launch configuration for the service', options: [{param:'environment', description:'Environment'}] },
        { params: ['create-load-balancer'], description: 'Create load balancer for the service', options: [{param:'environment', description:'Environment'}] },
        { params: ['create-auto-scaling-group'], description: 'Create auto scaling group for the service', options: [{param:'environment', description:'Environment'}] },
        { params: ['create-bucket'], description: 'Create bucket for the service model' },
        { params: ['create-bucket-user'], description: 'Create bucket user for the service' },

        { params: ['create-delivery-structure'], description: 'Create delivery structures for the service', options: [{param:'environment', description:'Environment'}] },
        { params: ['create-repository'], description: 'Create repository for the service' },
        { params: ['create-task-definition'], description: 'Create task definition for the service' },
        { params: ['create-cluster'], description: 'Create cluster for the service', options: [{param:'environment', description:'Environment'}] },
        { params: ['create-cluster-service'], description: 'Create cluster-service for the service', options: [{param:'environment', description:'Environment'}] },

        { params: ['create-ec2-access-ecs-role'], description: 'Create role for allowing EC2 instances to access ECS' },
        { params: ['create-ecs-access-elb-role'], description: 'Create role for allowing ECS cluster services to access ELB' },

        { params: ['clean-all', 'clean'], description: 'Clean all infrastructure and delivery structures for the service', options: [{param:'environment', description:'Environment'}] },

        { params: ['clean-infrastructure'], description: 'Clean infrastructure for the service', options: [{param:'environment', description:'Environment'}] },
        { params: ['clean-launch-configurations'], description: 'Remove old launch configurations for the service', options: [{param:'environment', description:'Environment'}] },

        { params: ['clean-delivery-structure'], description: 'Clean delivery structures for the service', options: [{param:'environment', description:'Environment'}] },
        { params: ['clean-repository'], description: 'Clean unlabled images from repository for the service' },
        { params: ['clean-task-definitions'], description: 'Deregister old task definitions for the service' },

        { params: ['update-auto-scaling-group'], description: 'Update auto scaling group for the service', options: [{param:'environment', description:'Environment'}] },

        { params: ['deploy-new-launch-configuration'], description: 'Deploy new launch configuration and update the auto scaling groups', options: [{param:'environment', description:'Environment'}] },
        { params: ['deploy-new-task-definition'], description: 'Create new task definition and deploy it', options: [{param:'stop-tasks', description:'Stop existing tasks'}, {param:'environment', description:'Environment'}] },
        { params: ['deploy'], description: 'Deploy latest task definition for service', options: [{param:'stop-tasks', description:'Stop existing tasks'}, {param:'environment', description:'Environment'}] },

        { params: ['start-cluster', 'start'], description: 'Start AWS cluster', options: [{param:'environment', description:'Environment'}] },
        { params: ['stop-cluster', 'stop'], description: 'Stop AWS cluster', options: [{param:'environment', description:'Environment'}] },

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

        { params: ['view-bucket, open-bucket'], description: 'View bucket for the service model' },
        { params: ['view-bucket-user', 'open-bucket-user'], description: 'View bucket user for the service' },

        { params: ['view-endpoint', 'open-endpoint'], description: 'View the service endpoint' }
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
