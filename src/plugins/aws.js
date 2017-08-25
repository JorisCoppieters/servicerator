'use strict'; // JS: ES6

// ******************************
// Requires:
// ******************************

let cprint = require('color-print');

let aws = require('../utils/aws');
let cache = require('../utils/cache');
let date = require('../utils/date');
let docker = require('../utils/docker');
let object = require('../utils/object');
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
                    environment: 'STRING',
                    auto_scaling_group: {
                        name: 'STRING'
                    },
                    vpc_name: 'STRING'
                }
            ]
        },
        aws: {
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
    print.keyVal('AWS Account Id', awsAccountId || '(Not Set)');
    print.keyVal('AWS Access Key', awsAccessKey || '(Not Set)');
    print.keyVal('AWS Secret Key', awsSecretKey ? '*******' : '(Not Set)');
    print.out('\n');

    let awsInstalled = aws.installed();
    if (!awsInstalled) {
        cprint.yellow('AWS-CLI isn\'t installed');
    }

    if (awsInstalled && awsAccessKey && awsSecretKey) {

        let clusters = serviceConfig.service.clusters
            .filter(c => {
                return c.environment === in_environment;
            });

        if (serviceName) {
            clusters.forEach(cluster => {
                let environment = cluster.environment;
                if (!environment) {
                    return;
                }

                let environmentTitle = str.toTitleCase(environment);

                cprint.magenta('-- AWS ' + environmentTitle + ' Clusters State --');

                let autoScalingGroupName = cluster.auto_scaling_group.name;

                let awsAutoScalingGroupName = autoScalingGroupName || '(Not Set)';
                let awsClusterName = cluster.name || '(Not Set)';
                let awsClusterServiceName = cluster.service_name || '(Not Set)';

                print.keyVal('AWS ' + environmentTitle + ' Cluster Name', awsClusterName);
                print.keyVal('AWS ' + environmentTitle + ' Cluster Service Name', awsClusterServiceName);

                if (autoScalingGroupName) {
                    print.keyVal('AWS ' + environmentTitle + ' Cluster Service State', '...', true);
                    let awsAutoScalingGroupInstanceCount = aws.getAutoScalingGroupInstanceCount(autoScalingGroupName, {
                        cache: awsCache
                    });
                    print.clearLine();

                    if (awsAutoScalingGroupInstanceCount !== undefined) {
                        let serviceState = aws.getServiceStateFromAutoScalingGroupInstanceCount(awsAutoScalingGroupInstanceCount);
                        print.keyVal('AWS ' + environmentTitle + ' Cluster Service State', serviceState);
                    } else {
                        print.keyVal('AWS ' + environmentTitle + ' Cluster Service State', '???');
                    }
                }

                if (in_extra && cluster.name) {
                    print.keyVal('AWS ' + environmentTitle + ' Cluster Service', '...', true);
                    let awsClusterServiceArn = aws.getClusterServiceArnForClusterName(cluster.name, awsClusterServiceName, {
                        cache: awsCache
                    });
                    print.clearLine();

                    if (awsClusterServiceArn) {
                        let awsClusterServiceName = aws.arnToTitle(awsClusterServiceArn);
                        print.keyVal('AWS ' + environmentTitle + ' Cluster Service', awsClusterServiceName);
                    } else {
                        print.keyVal('AWS ' + environmentTitle + ' Cluster Service', '???');
                    }

                    print.keyVal('AWS ' + environmentTitle + ' Cluster Service Task Definition', '...', true);
                    let awsTaskDefinitionArn = aws.getTaskDefinitionArnForClusterService(cluster.name, awsClusterServiceArn, {
                        cache: awsCache
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
                        cache: awsCache
                    });
                    print.clearLine();

                    if (clusterServiceVersion) {
                        print.keyVal('AWS ' + environmentTitle + ' Cluster Service Version', clusterServiceVersion);
                    } else {
                        print.keyVal('AWS ' + environmentTitle + ' Cluster Service Version', '???');
                    }

                    print.keyVal('AWS ' + environmentTitle + ' Cluster Tasks', '...', true);
                    let awsClusterTaskArns = aws.getClusterTaskArnsForCluster(cluster.name, {
                        cache: awsCache
                    });
                    let awsClusterTaskDetails = aws.getTaskDetails(cluster.name, awsClusterTaskArns, {
                        cache: awsCache
                    });
                    print.clearLine();

                    if (awsClusterTaskDetails && awsClusterTaskDetails.length) {
                        print.keyVal('AWS ' + environmentTitle + ' Cluster Tasks', JSON.stringify(awsClusterTaskDetails, null, 4));
                    } else {
                        print.keyVal('AWS ' + environmentTitle + ' Cluster Tasks', '[]');
                    }
                }

                print.out('\n');
            });
        }

        if (in_extra) {

            clusters.forEach(cluster => {
                let environment = cluster.environment;
                if (!environment) {
                    return;
                }

                let environmentTitle = str.toTitleCase(environment);

                let instanceIds = aws.getInstanceIdsWithTags([
                    {
                        key: "ServiceName",
                        vals: [
                            serviceName
                        ]
                    },
                    {
                        key: "Environment",
                        vals: [
                            environment
                        ]
                    }
                ], null);

                instanceIds.forEach(i => {
                    cprint.magenta('-- AWS ' + environmentTitle + ' Instance --');
                    print.keyVal('Instance Id', i.InstanceId);
                    print.keyVal('Instance Ip Address', i.IpAddress);
                    print.keyVal('Instance Type', i.InstanceType);
                    print.keyVal('Instance Lifecycle', i.InstanceLifecycle === 'spot' ? 'spot' : 'normal');
                    print.out('\n');
                })

            });

            clusters.forEach(cluster => {
                let environment = cluster.environment;
                if (!environment) {
                    return;
                }

                let environmentTitle = str.toTitleCase(environment);

                cprint.magenta('-- AWS ' + environmentTitle + ' Network --');

                let awsVpcName = cluster.vpc_name;
                print.keyVal('AWS ' + environmentTitle + ' VPC Name', awsVpcName);

                if (cluster.vpc_name) {
                    print.keyVal('AWS ' + environmentTitle + ' VPC Id', '...', true);
                    let awsVpcId = aws.getVpcIdForVpc(cluster.vpc_name, {
                        cache: awsCache
                    });
                    print.clearLine();

                    if (awsVpcId) {
                        print.keyVal('AWS ' + environmentTitle + ' VPC Id', awsVpcId);
                    } else {
                        print.keyVal('AWS ' + environmentTitle + ' VPC Id', '???');
                    }

                    print.keyVal('AWS ' + environmentTitle + ' VPC Default Security Group Id', '...', true);
                    let awsDefaultVpcSecurityGroupId = aws.getDefaultVpcSecurityGroupIdForVpc(awsVpcId, {
                        cache: awsCache
                    });
                    print.clearLine();

                    if (awsDefaultVpcSecurityGroupId) {
                        print.keyVal('AWS ' + environmentTitle + ' VPC Default Security Group Id', awsDefaultVpcSecurityGroupId);
                    } else {
                        print.keyVal('AWS ' + environmentTitle + ' VPC Default Security Group Id', '???');
                    }
                }

                print.out('\n');
            });
        }
    }

    if (service.hasConfigFile(serviceConfig.cwd)) {
        cache.save(serviceConfig.cwd, 'aws', awsCache);
    }

    cprint.magenta('----');
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
            task_definition_name: 'STRING',
            clusters: [
                {
                    name: 'STRING',
                    service_name: 'STRING',
                    environment: 'STRING',
                    instance: {
                        count: 'NUMBER'
                    }
                }
            ]
        },
        aws: {
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

    let awsTaskDefinitionName = serviceConfig.service.task_definition_name;
    if (!awsTaskDefinitionName) {
        cprint.yellow('Service task definition name not set');
        return false;
    }

    let environment = in_environment;
    let environmentTitle = str.toTitleCase(environment);
    let cluster = (serviceConfig.service.clusters || []).find(c => {
            return c.environment === environment;
        });

    if (!cluster) {
        cprint.yellow('No cluster set for "' + environment + '" environment');
        return false;
    }

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
        showWarning: true
    });
    if (!taskDefinitionArn) {
        return;
    }

    let awsClusterServiceArn = aws.getClusterServiceArnForClusterName(awsClusterName, awsClusterServiceName, {
        cache: awsCache,
        showWarning: true
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
        showWarning: true
    });
    if (!awsClusterTaskArns) {
        return;
    }
    print.clearLine();
    let awsClusterTaskNames = awsClusterTaskArns.map(a => aws.arnToTitle(a));
    print.keyVal('AWS ' + environmentTitle + ' Cluster Tasks', JSON.stringify(awsClusterTaskNames, null, 4));

    if (in_stopTasks) {
        awsClusterTaskArns.forEach(t => {
            aws.stopClusterTask(awsClusterName, t)
        });
    }

    aws.deployTaskDefinitionToCluster(awsClusterName, awsClusterServiceArn, taskDefinitionArn, awsClusterServiceInstanceCount);

    if (service.hasConfigFile(serviceConfig.cwd)) {
        cache.save(serviceConfig.cwd, 'aws', awsCache);
    }

    cprint.magenta('----');
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
                ports: [
                    {
                        test: "BOOLEAN",
                        host: 'NUMBER',
                        container: 'NUMBER',
                        env: 'STRING'
                    }
                ],
                volumes: [
                    {
                        container: 'STRING',
                        host: 'STRING',
                        name: 'STRING'
                    }
                ],
                commands: [
                    {
                        test: "BOOLEAN",
                        val: 'STRING',
                        env: 'STRING'
                    }
                ]
            }
        },
        service: {
            name: 'STRING',
            task_definition_name: 'STRING'
        },
        aws: {
            account_id: 'NUMBER'
        },
        cwd: 'STRING'
    });

    let sourceFolder = serviceConfig.cwd || false;
    let dockerFolder = docker.getFolder(sourceFolder);

    let serviceName = serviceConfig.service.name;
    if (!serviceName) {
        cprint.yellow('Service name not set');
        return false;
    }

    let awsTaskDefinitionName = serviceConfig.service.task_definition_name;
    if (!awsTaskDefinitionName) {
        cprint.yellow('Service task definition name not set');
        return false;
    }

    if (!aws.installed()) {
        cprint.yellow('AWS-CLI isn\'t installed');
        return false;
    }

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
            'name': 'filebeat-tm-services-state'
        },
        {
            'container': '/var/log/tm-services/$SERVICE_NAME',
            'name': serviceName + '-logs'
        },
        {
            'container': '/etc/tm-services',
            'readOnly': true,
            'name': 'tm-services-scripts'
        }
    ];

    let serviceContainerDefinition = {
        'cpu': 0,
        'environment': [],
        'essential': true,
        'image': awsTaskDefinitionImagePath,
        'memory': awsTaskDefinitionMemoryLimit,
        'name': serviceName,
        'volumesFrom': []
    };

    serviceConfig.docker.container.commands.forEach(command => {
        if (command.test || command.env === 'test') { // TODO: Deprecated
            return;
        }

        serviceContainerDefinition.command = command.val
            .split(' ')
        return;
    });

    serviceConfig.docker.container.ports.forEach(port => {
        if (!port.host || !port.container) {
            return;
        }

        if (port.test || port.env === 'test') { // TODO: Deprecated
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
        'memory': awsTaskDefinitionFilebeatMemoryLimit,
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

    let awsTaskDefinitionStructure = {
        'containerDefinitions': [
            serviceContainerDefinition,
            filebeatContainerDefinition
        ],
        'family': awsTaskDefinitionName,
        'networkMode': 'bridge',
        'placementConstraints': []
    };

    let uniqueHosts = {};
    serviceConfig.docker.container.volumes
        .concat(awsTaskDefinitionFilebeatVolumes)
        .forEach(volume => {
            let volumeName = service.replaceConfigReferences(in_serviceConfig, volume.name || volume.host);
            uniqueHosts[volumeName] = volume;
        });

    Object.keys(uniqueHosts)
        .forEach(host => {
            let volume = uniqueHosts[host];
            let volumeContainer = service.replaceConfigReferences(in_serviceConfig, volume.container);
            let volumeName = service.replaceConfigReferences(in_serviceConfig, volume.name || volume.host);

            awsTaskDefinitionStructure.volumes = awsTaskDefinitionStructure.volumes || [];
            awsTaskDefinitionStructure.volumes.push({
                'host': {
                    'sourcePath': volumeContainer
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
    ]);

    if (cmdResult.hasError) {
        cmdResult.printError('  ');
    } else {
        cmdResult.printResult('  ');
        let taskDefinitionArn = (cmdResult.resultObj.taskDefinition || {}).taskDefinitionArn;
        cprint.green('Created task definition "' + taskDefinitionArn + '"');
        aws.clearCachedTaskDefinitionArnForTaskDefinition(awsTaskDefinitionName, cache);
    }

    if (service.hasConfigFile(serviceConfig.cwd)) {
        cache.save(serviceConfig.cwd, 'aws', awsCache);
    }

    cprint.magenta('----');
}

// ******************************

function awsCleanTaskDefinitions (in_serviceConfig) {
    let serviceConfig = service.accessConfig(aws.getMergedServiceConfig(in_serviceConfig), {
        service: {
            task_definition_name: 'STRING',
            name: 'STRING'
        },
        cwd: 'STRING'
    });

    let sourceFolder = serviceConfig.cwd || false;
    let dockerFolder = docker.getFolder(sourceFolder);

    let serviceName = serviceConfig.service.name;
    if (!serviceName) {
        cprint.yellow('Service name not set');
        return false;
    }

    let awsTaskDefinitionName = serviceConfig.service.task_definition_name;
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
        cache: awsCache
    });

    if (!taskDefinitionArns || !taskDefinitionArns.length) {
        cprint.green('Nothing to clean up!');
        return;
    }

    taskDefinitionArns
        .forEach(t => {
            aws.deregisterTaskDefinition(t);
        });

    if (service.hasConfigFile(serviceConfig.cwd)) {
        cache.save(serviceConfig.cwd, 'aws', awsCache);
    }
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
                    environment: 'STRING',
                    instance: {
                        type: 'STRING',
                        iam_role: 'STRING',
                        ami: 'STRING',
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
        cwd: 'STRING'
    });

    let sourceFolder = serviceConfig.cwd || false;
    let dockerFolder = docker.getFolder(sourceFolder);

    let serviceName = serviceConfig.service.name;
    if (!serviceName) {
        cprint.yellow('Service name not set');
        return false;
    }

    if (!aws.installed()) {
        cprint.yellow('AWS-CLI isn\'t installed');
        return false;
    }

    let environment = in_environment;
    let environmentTitle = str.toTitleCase(environment);
    let cluster = (serviceConfig.service.clusters || []).find(c => {
            return c.environment === environment
        });

    if (!cluster) {
        cprint.yellow('No cluster set for "' + environment + '" environment');
        return false;
    }

    let awsLaunchConfigurationName = cluster.launch_configuration.name;
    if (!awsLaunchConfigurationName) {
        cprint.yellow('Launch configuration name not set');
        return false;
    }
    awsLaunchConfigurationName = awsLaunchConfigurationName + '-' + date.getTimestampTag();

    let awsLaunchConfigurationSecurityGroupNames = cluster.launch_configuration.security_groups || [];

    let awsClusterName = cluster.name;
    let awsInstanceType = cluster.instance.type || 't2.micro';
    let awsIamRole = cluster.instance.iam_role || 'role';
    let awsAmi = cluster.instance.ami || 'ami';

    let awsCache = cache.load(serviceConfig.cwd, 'aws');

    cprint.magenta('-- Launch Configuration --');
    print.keyVal('AWS Instance Type', awsInstanceType);
    print.keyVal('AWS IAM Role', awsIamRole);
    print.keyVal('AWS AMI', awsAmi);

    print.keyVal('AWS ' + environmentTitle + ' Launch Configuration', awsLaunchConfigurationName);

    let pemKeyName = cluster.identity_file;
    print.keyVal('AWS ' + environmentTitle + ' PEM Key', pemKeyName);

    let awsVpcName = cluster.vpc_name;
    print.keyVal('AWS ' + environmentTitle + ' VPC Name', awsVpcName);

    print.keyVal('AWS ' + environmentTitle + ' VPC Id', '...', true);
    let awsVpcId = aws.getVpcIdForVpc(awsVpcName, {
        cache: awsCache,
        showWarning: true
    });
    if (!awsVpcId) {
        return;
    }
    print.clearLine();
    print.keyVal('AWS ' + environmentTitle + ' VPC Id', awsVpcId);

    let awsLaunchConfigurationSecurityGroups = [];

    if (awsLaunchConfigurationSecurityGroupNames.length) {
        awsLaunchConfigurationSecurityGroups = awsLaunchConfigurationSecurityGroupNames
            .map(name => {
                print.keyVal('AWS ' + environmentTitle + ' VPC Security Group Id', '...', true);
                let awsVpcSecurityGroupId = aws.getVpcSecurityGroupIdFromGroupName(awsVpcId, name, {
                    cache: awsCache,
                    showWarning: true
                });
                if (!awsVpcSecurityGroupId) {
                    return;
                }
                print.clearLine();
                print.keyVal('AWS ' + environmentTitle + ' VPC Security Group Id', awsVpcSecurityGroupId);
                return awsVpcSecurityGroupId;
            });

    } else {
        print.keyVal('AWS ' + environmentTitle + ' VPC Default Security Group Id', '...', true);
        let awsDefaultVpcSecurityGroupId = aws.getDefaultVpcSecurityGroupIdForVpc(awsVpcId, {
            cache: awsCache,
            showWarning: true
        });
        if (!awsDefaultVpcSecurityGroupId) {
            return;
        }
        print.clearLine();
        print.keyVal('AWS ' + environmentTitle + ' VPC Default Security Group Id', awsDefaultVpcSecurityGroupId);
        awsLaunchConfigurationSecurityGroups.push(awsDefaultVpcSecurityGroupId);
    }

    let userData = (cluster.instance.user_data || []).join('\n');
    userData = service.replaceConfigReferences(in_serviceConfig, userData, {
        'ENVIRONMENT': environment,
        'AWS_CLUSTER_NAME': awsClusterName
    });

    let blockDeviceMappings = JSON.stringify(cluster.instance.volumes || []);

    cprint.cyan('Creating launch configuration...');

    let cmdResult = aws.cmd([
        'autoscaling',
        'create-launch-configuration',

        '--instance-monitoring',
        '{"Enabled": false}',

        '--launch-configuration-name',
        awsLaunchConfigurationName,

        '--security-groups',
        JSON.stringify(awsLaunchConfigurationSecurityGroups),

        '--key-name',
        pemKeyName,

        '--instance-type',
        awsInstanceType,

        '--iam-instance-profile',
        awsIamRole,

        '--image-id',
        awsAmi,

        '--block-device-mappings',
        blockDeviceMappings,

        '--user-data',
        userData
    ]);

    if (cmdResult.hasError) {
        cmdResult.printError('  ');
    } else {
        cmdResult.printResult('  ');
        cprint.green('Created launch configuration');
    }

    if (service.hasConfigFile(serviceConfig.cwd)) {
        cache.save(serviceConfig.cwd, 'aws', awsCache);
    }

    cprint.magenta('----');
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
                    load_balancer_name: 'STRING',
                    launch_configuration: {
                        name: 'STRING'
                    },
                    auto_scaling_group: {
                        name: 'STRING',
                        subnets: [
                            'STRING'
                        ]
                    },
                    environment: 'STRING'
                }
            ]
        },
        cwd: 'STRING'
    });

    let sourceFolder = serviceConfig.cwd || false;
    let dockerFolder = docker.getFolder(sourceFolder);

    let serviceName = serviceConfig.service.name;
    if (!serviceName) {
        cprint.yellow('Service name not set');
        return false;
    }

    let dockerImageName = serviceConfig.docker.image.name;
    if (!dockerImageName) {
        cprint.yellow('Docker image name not set');
        return false;
    }

    if (!aws.installed()) {
        cprint.yellow('AWS-CLI isn\'t installed');
        return false;
    }

    let environment = in_environment;
    let environmentTitle = str.toTitleCase(environment);
    let cluster = (serviceConfig.service.clusters || []).find(c => {
            return c.environment === environment
        });

    if (!cluster) {
        cprint.yellow('No cluster set for "' + environment + '" environment');
        return false;
    }

    let launchConfigurationTemplateName = cluster.launch_configuration.name;
    if (!launchConfigurationTemplateName) {
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

    let awsLoadBalancerName = cluster.load_balancer_name || false;

    let awsCache = cache.load(serviceConfig.cwd, 'aws');

    let awsAutoScalingGroupMinSize = 0;
    let awsAutoScalingGroupMaxSize = 4;

    cprint.magenta('-- Auto Scaling Group --');

    print.keyVal('AWS ' + environmentTitle + ' Auto Scaling Group', awsAutoScalingGroupName);

    print.keyVal('AWS ' + environmentTitle + ' Launch Configuration', '...', true);
    let awsLaunchConfigurationName = aws.getLaunchConfigurationLike(launchConfigurationTemplateName, {
        cache: awsCache,
        showWarning: true
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
        showWarning: true
    });
    if (!awsVpcId) {
        return;
    }
    print.clearLine();
    print.keyVal('AWS ' + environmentTitle + ' VPC Id', awsVpcId);

    let awsVpcSubnetIds = awsVpcSubnetNames
        .map(awsVpcSubnetName => {

            print.keyVal('AWS ' + environmentTitle + ' VPC Subnet Name', awsVpcSubnetName);

            print.keyVal('AWS ' + environmentTitle + ' VPC Subnet Id', '...', true);
            let awsVpcSubnetId = aws.getVpcSubnetIdForVpc(awsVpcId, awsVpcSubnetName, {
                cache: awsCache,
                showWarning: true
            });
            if (!awsVpcSubnetId) {
                return;
            }
            print.clearLine();
            print.keyVal('AWS ' + environmentTitle + ' VPC Subnet Id', awsVpcSubnetId);
            return awsVpcSubnetId;
        })

    cprint.cyan('Creating auto scaling group...');

    let tagsDict = {
        "DockerImageName": dockerImageName,
        "Environment": environment,
        "ServiceName": serviceName,
        "Name": serviceName + '-group-instance',
        "autospotting_on_demand_number": "1",
        "spot-enabled": "false"
    }

    let tags = Object.keys(tagsDict).map(key => {
        let val = tagsDict[key];
        return {
            "ResourceId": awsAutoScalingGroupName,
            "ResourceType": "auto-scaling-group",
            "Key": key,
            "Value": val,
            "PropagateAtLaunch": true
        }
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
        300,

        '--tags',
        JSON.stringify(tags)
    ];

    // TODO
    // - Correct health check grace period
    // - Correct private subnets not public

    // if (awsLoadBalancerName) {
    //     args = args.concat([
    //         '--load-balancer-names',
    //         awsLoadBalancerName
    //     ]);
    // }

    let cmdResult = aws.cmd(args);
    if (cmdResult.hasError) {
        cmdResult.printError('  ');
    } else {
        cmdResult.printResult('  ');
        cprint.green('Created auto scaling group');
    }

    if (service.hasConfigFile(serviceConfig.cwd)) {
        cache.save(serviceConfig.cwd, 'aws', awsCache);
    }

    cprint.magenta('----');
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
                    load_balancer_name: 'STRING',
                    environment: 'STRING'
                }
            ]
        },
        cwd: 'STRING'
    });

    let sourceFolder = serviceConfig.cwd || false;
    let dockerFolder = docker.getFolder(sourceFolder);

    let serviceName = serviceConfig.service.name;
    if (!serviceName) {
        cprint.yellow('Service name not set');
        return false;
    }

    if (!aws.installed()) {
        cprint.yellow('AWS-CLI isn\'t installed');
        return false;
    }

    let environment = in_environment;
    let environmentTitle = str.toTitleCase(environment);
    let cluster = (serviceConfig.service.clusters || []).find(c => {
            return c.environment === environment
        });

    if (!cluster) {
        cprint.yellow('No cluster set for "' + environment + '" environment');
        return false;
    }

    let awsLoadBalancerName = cluster.load_balancer_name;
    if (!awsLoadBalancerName) {
        cprint.yellow('Load balancer name not set');
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
        showWarning: true
    });
    if (!awsVpcId) {
        return;
    }
    print.clearLine();
    print.keyVal('AWS ' + environmentTitle + ' VPC Id', awsVpcId);

    print.keyVal('AWS ' + environmentTitle + ' VPC Default Security Group Id', '...', true);
    let awsDefaultVpcSecurityGroupId = aws.getDefaultVpcSecurityGroupIdForVpc(awsVpcId, {
        cache: awsCache,
        showWarning: true
    });
    if (!awsDefaultVpcSecurityGroupId) {
        return;
    }
    print.clearLine();
    print.keyVal('AWS ' + environmentTitle + ' VPC Default Security Group Id', awsDefaultVpcSecurityGroupId);

    cprint.cyan('Creating load balancer...');

    // TODO
    let args = [
        'elb',
        'create-load-balancer',

        '--load-balancer-name',
        awsLoadBalancerName,

        // '--listeners',
        // '--availability-zones',
        // '--subnets',
        // '--security-groups',
        // '--tags'
    ];

    let cmdResult = aws.cmd(args);
    if (cmdResult.hasError) {
        cmdResult.printError('  ');
    } else {
        cmdResult.printResult('  ');
        cprint.green('Created load balancer');
    }

    if (service.hasConfigFile(serviceConfig.cwd)) {
        cache.save(serviceConfig.cwd, 'aws', awsCache);
    }

    cprint.magenta('----');
}

// ******************************

function awsCreateRepository (in_serviceConfig) {
    let serviceConfig = service.accessConfig(aws.getMergedServiceConfig(in_serviceConfig), {
        service: {
            name: 'STRING'
        },
        docker: {
            image: {
                name: 'STRING',
            }
        },
        cwd: 'STRING'
    });

    let sourceFolder = serviceConfig.cwd || false;
    let dockerFolder = docker.getFolder(sourceFolder);

    let serviceName = serviceConfig.service.name;
    if (!serviceName) {
        cprint.yellow('Service name not set');
        return false;
    }

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
        cache: awsCache
    });
    if (awsDockerRepository) {
        cprint.green('Repository already exists!');
        return;
    }

    cprint.cyan('Creating repository...');
    if (!aws.createDockerRepository(dockerImageName)) {
        return;
    }

    if (service.hasConfigFile(serviceConfig.cwd)) {
        cache.save(serviceConfig.cwd, 'aws', awsCache);
    }

    cprint.magenta('----');
}

// ******************************

function awsCreateCluster (in_serviceConfig, in_environment) {
    let serviceConfig = service.accessConfig(aws.getMergedServiceConfig(in_serviceConfig), {
        service: {
            name: 'STRING',
            clusters: [
                {
                    name: 'STRING',
                    environment: 'STRING'
                }
            ]
        },
        cwd: 'STRING'
    });

    let sourceFolder = serviceConfig.cwd || false;
    let dockerFolder = docker.getFolder(sourceFolder);

    let serviceName = serviceConfig.service.name;
    if (!serviceName) {
        cprint.yellow('Service name not set');
        return false;
    }

    if (!aws.installed()) {
        cprint.yellow('AWS-CLI isn\'t installed');
        return false;
    }

    let environment = in_environment;
    let environmentTitle = str.toTitleCase(environment);
    let cluster = (serviceConfig.service.clusters || []).find(c => {
            return c.environment === environment
        });

    if (!cluster) {
        cprint.yellow('No cluster set for "' + environment + '" environment');
        return false;
    }

    let awsClusterName = cluster.name;
    if (!awsClusterName) {
        cprint.yellow('Cluster name not set');
        return false;
    }

    let awsCache = cache.load(serviceConfig.cwd, 'aws');

    cprint.magenta('-- AWS ' + environmentTitle + ' Cluster --');
    print.keyVal('AWS ' + environmentTitle + ' Cluster Name', awsClusterName);

    let awsClusterArn = aws.getClusterArnForClusterName(awsClusterName, {
        cache: awsCache
    });
    if (awsClusterArn) {
        cprint.green('Cluster already exists!');
        return;
    }

    cprint.cyan('Creating cluster...');
    if (!aws.createCluster(awsClusterName)) {
        return;
    }

    if (service.hasConfigFile(serviceConfig.cwd)) {
        cache.save(serviceConfig.cwd, 'aws', awsCache);
    }

    cprint.magenta('----');
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
                        "container": 'NUMBER',
                        "env": 'STRING',
                        "host": 'NUMBER'
                    }
                ]
            }
        },
        service: {
            name: 'STRING',
            task_definition_name: 'STRING',
            clusters: [
                {
                    name: 'STRING',
                    service_name: 'STRING',
                    environment: 'STRING',
                    load_balancer_name: 'STRING',
                    instance: {
                        count: 'NUMBER'
                    }
                }
            ]
        },
        cwd: 'STRING'
    });

    let sourceFolder = serviceConfig.cwd || false;
    let dockerFolder = docker.getFolder(sourceFolder);

    let serviceName = serviceConfig.service.name;
    if (!serviceName) {
        cprint.yellow('Service name not set');
        return false;
    }

    if (!aws.installed()) {
        cprint.yellow('AWS-CLI isn\'t installed');
        return false;
    }

    let dockerImageName = serviceConfig.docker.image.name;
    if (!dockerImageName) {
        cprint.yellow('Docker image name not set');
        return false;
    }

    let dockerImageVersion = serviceConfig.docker.image.version || '1.0.0';

    let dockerImagePort;
    serviceConfig.docker.container.ports.forEach(port => {
        if (!port.host || !port.container) {
            return;
        }

        if (port.test || port.env === 'test') { // TODO: Deprecated
            return;
        }

        dockerImagePort = port.container;
    });

    if (!dockerImagePort) {
        cprint.yellow('Docker image port not set');
        return false;
    }

    let awsTaskDefinitionName = serviceConfig.service.task_definition_name;
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

    let environment = in_environment;
    let environmentTitle = str.toTitleCase(environment);
    let cluster = (serviceConfig.service.clusters || []).find(c => {
            return c.environment === environment
        });

    if (!cluster) {
        cprint.yellow('No cluster set for "' + environment + '" environment');
        return false;
    }

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

    if (cluster.load_balancer_name) {
        loadBalancers.push({
            loadBalancerName: cluster.load_balancer_name,
            containerName: dockerContainerName,
            containerPort: dockerImagePort
        });
    }

    let desiredCount = cluster.instance.count || 0;

    let awsCache = cache.load(serviceConfig.cwd, 'aws');

    cprint.magenta('-- AWS ' + environmentTitle + ' Cluster Service --');
    print.keyVal('AWS ' + environmentTitle + ' Cluster Name', awsClusterName);
    print.keyVal('AWS ' + environmentTitle + ' Cluster Service Desired Count', desiredCount);
    print.keyVal('AWS ' + environmentTitle + ' Load Balancers', JSON.stringify(loadBalancers, null, 4));

    print.keyVal('AWS Task Definition', '...', true);
    let taskDefinitionArn = aws.getLatestTaskDefinitionArnForTaskDefinition(awsTaskDefinitionName, {
        cache: awsCache,
        showWarning: true
    });
    if (!taskDefinitionArn) {
        return;
    }

    print.clearLine();
    print.keyVal('AWS Task Definition', awsTaskDefinitionName);

    let awsClusterServiceArn = aws.getClusterServiceArnForClusterName(awsClusterName, awsClusterServiceName, {
        cache: awsCache
    });
    if (awsClusterServiceArn) {
        cprint.green('Cluster service already exists!');
        return;
    }

    cprint.cyan('Creating cluster service...');
    if (!aws.createClusterService(awsClusterName, awsClusterServiceName, taskDefinitionArn, loadBalancers, desiredCount)) {
        return;
    }

    if (service.hasConfigFile(serviceConfig.cwd)) {
        cache.save(serviceConfig.cwd, 'aws', awsCache);
    }

    cprint.magenta('----');
}

// ******************************

function awsDockerLogin (in_serviceConfig) {
    let serviceConfig = service.accessConfig(aws.getMergedServiceConfig(in_serviceConfig), {
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

    let awsDockerCredentials = aws.getDockerCredentials(in_serviceConfig);
    serviceConfig = service.updateConfig(in_serviceConfig, {
        aws: {
            account_id: awsDockerCredentials.account_id,
            region: awsDockerCredentials.region
        }
    });

    let awsDockerRepositoryUrl = aws.getDockerRepositoryUrl(in_serviceConfig);
    if (!awsDockerRepositoryUrl) {
        cprint.yellow('Couldn\'t get aws docker repository');
        return false;
    }

    docker.login(awsDockerCredentials.username, awsDockerCredentials.password, awsDockerRepositoryUrl);
}

// ******************************

function awsStartCluster (in_serviceConfig, in_environment) {
    let serviceConfig = service.accessConfig(aws.getMergedServiceConfig(in_serviceConfig), {
        service: {
            name: 'STRING',
            clusters: [
                {
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

    let environment = in_environment;
    let cluster = (serviceConfig.service.clusters || []).find(c => {
            return c.environment === environment
        });
    if (!cluster) {
        cprint.yellow('AWS cluster doesn\'t exist');
        return;
    }

    let instanceCount = cluster.instance.count || 2;

    let autoScalingGroupName = cluster.auto_scaling_group.name;
    let autoScalingGroupInstanceCount = aws.getAutoScalingGroupInstanceCount(autoScalingGroupName);
    if (autoScalingGroupInstanceCount < 0) {
        cprint.yellow('AWS cluster doesn\'t exist');
        return;
    }

    if (autoScalingGroupInstanceCount == 0) {
        cprint.cyan('Starting AWS cluster...');
        aws.setAutoScalingGroupInstanceCount(autoScalingGroupName, instanceCount, {
            cache: awsCache
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
                    environment: 'STRING',
                    auto_scaling_group: {
                        name: 'STRING'
                    }
                }
            ]
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

    let environment = in_environment;
    let cluster = (serviceConfig.service.clusters || []).find(c => {
            return c.environment === environment
        });
    if (!cluster) {
        cprint.yellow('AWS cluster doesn\'t exist');
        return;
    }

    let autoScalingGroupName = cluster.auto_scaling_group.name;
    let autoScalingGroupInstanceCount = aws.getAutoScalingGroupInstanceCount(autoScalingGroupName);
    if (autoScalingGroupInstanceCount < 0) {
        cprint.yellow('AWS cluster doesn\'t exist');
        return;
    }

    if (autoScalingGroupInstanceCount > 0) {
        cprint.cyan('Stopping AWS cluster...');
        aws.setAutoScalingGroupInstanceCount(autoScalingGroupName, 0, {
            cache: awsCache
        });
    } else {
        cprint.green('AWS cluster already stopped');
    }

    if (service.hasConfigFile(serviceConfig.cwd)) {
        cache.save(serviceConfig.cwd, 'aws', awsCache);
    }
}

// ******************************
// Plugin Functions:
// ******************************

function handleCommand (in_args, in_params, in_serviceConfig) {
    let command = in_params.length ? in_params.shift().toLowerCase() : '';
    let env = in_args['env'] || in_args['environment'] || 'test';
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

        case 'create-task-definition':
            awsCreateTaskDefinition(in_serviceConfig);
            break;

        case 'clean-task-definitions':
        case 'clean':
            awsCleanTaskDefinitions(in_serviceConfig);
            break;

        case 'create-launch-configuration':
            awsCreateLaunchConfiguration(in_serviceConfig, env);
            break;

        case 'create-auto-scaling-group':
            awsCreateAutoScalingGroup(in_serviceConfig, env);
            break;

        case 'create-load-balancer':
            awsCreateLoadBalancer(in_serviceConfig, env);
            break;

        case 'create-repository':
            awsCreateRepository(in_serviceConfig);
            break;

        case 'create-cluster':
            awsCreateCluster(in_serviceConfig, env);
            break;

        case 'create-cluster-service':
            awsCreateClusterService(in_serviceConfig, env);
            break;

        case 'deploy':
            awsDeploy(in_serviceConfig, stopTasks, env);
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
        { params: ['create-task-definition'], description: 'Create task definition for the service' },
        { params: ['clean-task-definitions', 'clean'], description: 'Deregister old task definitions for the service' },
        { params: ['create-launch-configuration'], description: 'Create launch configuration for the service', options: [{param:'environment', description:'Environment'}] },
        { params: ['create-repository'], description: 'Create repository for the service' },
        { params: ['create-cluster'], description: 'Create cluster for the service', options: [{param:'environment', description:'Environment'}] },
        { params: ['create-cluster-service'], description: 'Create cluster-service for the service', options: [{param:'environment', description:'Environment'}] },
        { params: ['deploy'], description: 'Deploy latest task definition for service', options: [{param:'stop-tasks', description:'Stop existing tasks'}, {param:'environment', description:'Environment'}] },
        { params: ['start-cluster', 'start'], description: 'Start AWS cluster', options: [{param:'environment', description:'Environment'}] },
        { params: ['stop-cluster', 'stop'], description: 'Stop AWS cluster', options: [{param:'environment', description:'Environment'}] },
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
