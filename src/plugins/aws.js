'use strict'; // JS: ES6

// ******************************
// Requires:
// ******************************

let cprint = require('color-print');

let aws = require('../utils/aws');
let cache = require('../utils/cache');
let date = require('../utils/date');
let docker = require('../utils/docker');
let init = require('../utils/init');
let object = require('../utils/object');
let print = require('../utils/print');
let service = require('../utils/service');
let str = require('../utils/string');

// ******************************
// Functions:
// ******************************

function printAwsServiceInfo (in_serviceConfig, in_prod, in_extra) {
    let serviceConfig = service.accessConfig(aws.getMergedServiceConfig(in_serviceConfig), {
        service: {
            name: 'STRING',
            clusters: [
                {
                    name: 'STRING',
                    service_name: 'STRING',
                    environment: 'STRING',
                    auto_scaling_group_name: 'STRING',
                    vpc_name: 'STRING',
                    vpc_subnet_name: 'STRING'
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
                if (!in_prod) {
                    return c.environment !== 'production';
                } else {
                    return c.environment === 'production';
                }
            });

        if (serviceName) {
            clusters.forEach(cluster => {
                let environment = cluster.environment;
                if (!environment) {
                    return;
                }

                let environmentTitle = str.toTitleCase(environment);

                cprint.magenta('-- AWS ' + environmentTitle + ' Clusters State --');

                let awsAutoScalingGroupName = cluster.auto_scaling_group_name || '(Not Set)';
                let awsClusterName = cluster.name || '(Not Set)';
                let awsClusterServiceName = cluster.service_name || '(Not Set)';

                print.keyVal('AWS ' + environmentTitle + ' Cluster Name', awsClusterName);
                print.keyVal('AWS ' + environmentTitle + ' Cluster Service Name', awsClusterServiceName);

                if (cluster.auto_scaling_group_name) {
                    print.keyVal('AWS ' + environmentTitle + ' Cluster Service State', '...', true);
                    let awsAutoScalingGroupInstanceCount = aws.getAutoScalingGroupInstanceCount(cluster.auto_scaling_group_name, awsCache);
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
                    let awsClusterServiceArn = aws.getClusterServiceArnForClusterName(cluster.name, awsClusterServiceName, awsCache);
                    print.clearLine();

                    if (awsClusterServiceArn) {
                        let awsClusterServiceName = aws.arnToTitle(awsClusterServiceArn);
                        print.keyVal('AWS ' + environmentTitle + ' Cluster Service', awsClusterServiceName);
                    } else {
                        print.keyVal('AWS ' + environmentTitle + ' Cluster Service', '???');
                    }

                    print.keyVal('AWS ' + environmentTitle + ' Cluster Service Task Definition', '...', true);
                    let awsTaskDefinitionArn = aws.getTaskDefinitionArnForClusterService(cluster.name, awsClusterServiceArn, awsCache);
                    print.clearLine();

                    if (awsTaskDefinitionArn) {
                        let awsTaskDefinitionName = aws.arnToTitle(awsTaskDefinitionArn);
                        print.keyVal('AWS ' + environmentTitle + ' Cluster Service Task Definition', awsTaskDefinitionName);
                    } else {
                        print.keyVal('AWS ' + environmentTitle + ' Cluster Service Task Definition', '???');
                    }

                    print.keyVal('AWS ' + environmentTitle + ' Cluster Tasks', '...', true);
                    let awsClusterTaskArns = aws.getClusterTaskArnsForCluster(cluster.name, awsCache);
                    print.clearLine();

                    if (awsClusterTaskArns) {
                        let awsClusterTaskNames = awsClusterTaskArns.map(a => aws.arnToTitle(a));
                        print.keyVal('AWS ' + environmentTitle + ' Cluster Tasks', JSON.stringify(awsClusterTaskNames, null, 4));
                    } else {
                        print.keyVal('AWS ' + environmentTitle + ' Cluster Tasks', '???');
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
                    print.keyVal('Instance VpcId', i.VpcId);
                    print.keyVal('Instance SubnetId', i.SubnetId);
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
                    let awsVpcId = aws.getVpcIdForVpc(cluster.vpc_name, awsCache);
                    print.clearLine();

                    if (awsVpcId) {
                        print.keyVal('AWS ' + environmentTitle + ' VPC Id', awsVpcId);
                    } else {
                        print.keyVal('AWS ' + environmentTitle + ' VPC Id', '???');
                    }

                    print.keyVal('AWS ' + environmentTitle + ' VPC Security Group Id', '...', true);
                    let awsVpcSecurityGroupId = aws.getVpcSecurityGroupIdForVpc(awsVpcId, awsCache);
                    print.clearLine();

                    if (awsVpcSecurityGroupId) {
                        print.keyVal('AWS ' + environmentTitle + ' VPC Security Group Id', awsVpcSecurityGroupId);
                    } else {
                        print.keyVal('AWS ' + environmentTitle + ' VPC Security Group Id', '???');
                    }

                    let awsVpcSubnetName = cluster.vpc_subnet_name;
                    print.keyVal('AWS ' + environmentTitle + ' VPC Subnet Name', awsVpcSubnetName);

                    print.keyVal('AWS ' + environmentTitle + ' VPC Subnet Id', '...', true);
                    let awsVpcSubnetId = aws.getVpcSubnetIdForVpc(awsVpcId, awsVpcSubnetName, awsCache);
                    print.clearLine();

                    if (awsVpcSubnetId) {
                        print.keyVal('AWS ' + environmentTitle + ' VPC Subnet Id', awsVpcSubnetId);
                    } else {
                        print.keyVal('AWS ' + environmentTitle + ' VPC Subnet Id', '???');
                    }
                }

                print.out('\n');
            });
        }
    }

    if (init.hasServiceConfigFile(serviceConfig.cwd)) {
        cache.save(serviceConfig.cwd, 'aws', awsCache);
    }

    cprint.magenta('----');
}

// ******************************

function awsDeploy (in_serviceConfig, in_stopTasks, in_prod) {
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

    let environment = (in_prod) ? 'prod' : 'test';
    let environmentNameLong = (in_prod) ? 'production' : 'test';
    let environmentTitle = str.toTitleCase(environment);
    let cluster = (serviceConfig.service.clusters || []).find(c => {
            return c.environment === environmentNameLong
        });

    if (!cluster) {
        cprint.yellow('No cluster set for "' + environmentNameLong + '" environment');
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
    let taskDefinitionArn = aws.getLatestTaskDefinitionArnForTaskDefinition(awsTaskDefinitionName, awsCache);
    if (!taskDefinitionArn) {
        return;
    }

    let awsClusterServiceArn = aws.getClusterServiceArnForClusterName(awsClusterName, awsClusterServiceName, awsCache);
    if (!awsClusterServiceArn) {
        return;
    }

    print.clearLine();
    print.keyVal('AWS Task Definition', awsTaskDefinitionName);

    print.keyVal('AWS ' + environmentTitle + ' Cluster Name', awsClusterName);
    print.keyVal('AWS ' + environmentTitle + ' Cluster Service Name', awsClusterServiceName);
    print.keyVal('AWS ' + environmentTitle + ' Cluster Service Instance Count', awsClusterServiceInstanceCount);

    print.keyVal('AWS ' + environmentTitle + ' Cluster Tasks', '...', true);
    let awsClusterTaskArns = aws.getClusterTaskArnsForCluster(awsClusterName, awsCache);
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

    if (init.hasServiceConfigFile(serviceConfig.cwd)) {
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
        // TODO - remove TM specific environment
        if (command.env === 'prod') {
            serviceContainerDefinition.command = command.val
                .split(' ')
            return;
        }
    });

    serviceConfig.docker.container.ports.forEach(port => {
        if (!port.host || !port.container) {
            return;
        }
        // TODO - remove TM specific environment
        if (port.env !== 'prod') {
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

        let volumeContainer = service.replaceServiceConfigReferences(in_serviceConfig, volume.container);
        let volumeName = service.replaceServiceConfigReferences(in_serviceConfig, volume.name || volume.host);

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

        let volumeContainer = service.replaceServiceConfigReferences(in_serviceConfig, volume.container);
        let volumeName = service.replaceServiceConfigReferences(in_serviceConfig, volume.name || volume.host);

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
            let volumeName = service.replaceServiceConfigReferences(in_serviceConfig, volume.name || volume.host);
            uniqueHosts[volumeName] = volume;
        });

    Object.keys(uniqueHosts)
        .forEach(host => {
            let volume = uniqueHosts[host];
            let volumeContainer = service.replaceServiceConfigReferences(in_serviceConfig, volume.container);
            let volumeName = service.replaceServiceConfigReferences(in_serviceConfig, volume.name || volume.host);

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

    if (init.hasServiceConfigFile(serviceConfig.cwd)) {
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

    let taskDefinitionArns = aws.getPreviousTaskDefinitionArnsForTaskDefinition(awsTaskDefinitionName, awsCache);

    if (!taskDefinitionArns || !taskDefinitionArns.length) {
        cprint.green('Nothing to clean up!');
        return;
    }

    taskDefinitionArns
        .forEach(t => {
            aws.deregisterTaskDefinition(t);
        });

    if (init.hasServiceConfigFile(serviceConfig.cwd)) {
        cache.save(serviceConfig.cwd, 'aws', awsCache);
    }
}

// ******************************

function awsCreateLaunchConfiguration (in_serviceConfig, in_prod) {
    let serviceConfig = service.accessConfig(aws.getMergedServiceConfig(in_serviceConfig), {
        service: {
            name: 'STRING',
            clusters: [
                {
                    name: 'STRING',
                    identity_file: 'STRING',
                    vpc_name: 'STRING',
                    vpc_subnet_name: 'STRING',
                    launch_configuration_name: 'STRING',
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

    let environment = (in_prod) ? 'prod' : 'test';
    let environmentNameLong = (in_prod) ? 'production' : 'test';
    let environmentTitle = str.toTitleCase(environment);
    let cluster = (serviceConfig.service.clusters || []).find(c => {
            return c.environment === environmentNameLong
        });

    if (!cluster) {
        cprint.yellow('No cluster set for "' + environmentNameLong + '" environment');
        return false;
    }

    let awsClusterName = cluster.name;
    let awsInstanceType = cluster.instance.type || 't2.micro';
    let awsIamRole = cluster.instance.iam_role || 'role';
    let awsAmi = cluster.instance.ami || 'ami';

    let awsCache = cache.load(serviceConfig.cwd, 'aws');

    cprint.magenta('-- Launch Configuration --');
    print.keyVal('AWS Instance Type', awsInstanceType);
    print.keyVal('AWS IAM Role', awsIamRole);
    print.keyVal('AWS AMI', awsAmi);

    let awsLaunchConfigurationName = cluster.launch_configuration_name + '-' + date.getTimestampTag();
    print.keyVal('AWS ' + environmentTitle + ' Launch Configuration', awsLaunchConfigurationName);

    let pemKeyName = cluster.identity_file;
    print.keyVal('AWS ' + environmentTitle + ' PEM Key', pemKeyName);

    let awsVpcName = cluster.vpc_name;
    print.keyVal('AWS ' + environmentTitle + ' VPC Name', awsVpcName);

    print.keyVal('AWS ' + environmentTitle + ' VPC Id', '...', true);
    let awsVpcId = aws.getVpcIdForVpc(awsVpcName, awsCache);
    if (!awsVpcId) {
        return;
    }
    print.clearLine();
    print.keyVal('AWS ' + environmentTitle + ' VPC Id', awsVpcId);

    print.keyVal('AWS ' + environmentTitle + ' VPC Security Group Id', '...', true);
    let awsVpcSecurityGroupId = aws.getVpcSecurityGroupIdForVpc(awsVpcId, awsCache);
    if (!awsVpcSecurityGroupId) {
        return;
    }
    print.clearLine();
    print.keyVal('AWS ' + environmentTitle + ' VPC Security Group Id', awsVpcSecurityGroupId);

    let awsVpcSubnetName = cluster.vpc_subnet_name;
    print.keyVal('AWS ' + environmentTitle + ' VPC Subnet Name', awsVpcSubnetName);

    print.keyVal('AWS ' + environmentTitle + ' VPC Subnet Id', '...', true);
    let awsVpcSubnetId = aws.getVpcSubnetIdForVpc(awsVpcId, awsVpcSubnetName, awsCache);
    if (!awsVpcSubnetId) {
        return;
    }
    print.clearLine();
    print.keyVal('AWS ' + environmentTitle + ' VPC Subnet Id', awsVpcSubnetId);

    let userData = (cluster.instance.user_data || []).join('\n');
    userData = service.replaceServiceConfigReferences(in_serviceConfig, userData, {
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
        awsVpcSecurityGroupId,

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

    if (init.hasServiceConfigFile(serviceConfig.cwd)) {
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

    let awsDockerRepository = aws.getDockerRepositoryForDockerImageName(dockerImageName, awsCache);
    if (awsDockerRepository) {
        cprint.green('Repository already exists!');
        return;
    }

    cprint.cyan('Creating repository...');
    if (!aws.createDockerRepository(dockerImageName)) {
        return;
    }

    if (init.hasServiceConfigFile(serviceConfig.cwd)) {
        cache.save(serviceConfig.cwd, 'aws', awsCache);
    }

    cprint.magenta('----');
}

// ******************************

function awsCreateCluster (in_serviceConfig, in_prod) {
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

    let environment = (in_prod) ? 'prod' : 'test';
    let environmentNameLong = (in_prod) ? 'production' : 'test';
    let environmentTitle = str.toTitleCase(environment);
    let cluster = (serviceConfig.service.clusters || []).find(c => {
            return c.environment === environmentNameLong
        });

    if (!cluster) {
        cprint.yellow('No cluster set for "' + environmentNameLong + '" environment');
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

    let awsClusterArn = aws.getClusterArnForClusterName(awsClusterName, awsCache);
    if (awsClusterArn) {
        cprint.green('Cluster already exists!');
        return;
    }

    cprint.cyan('Creating cluster...');
    if (!aws.createCluster(awsClusterName)) {
        return;
    }

    if (init.hasServiceConfigFile(serviceConfig.cwd)) {
        cache.save(serviceConfig.cwd, 'aws', awsCache);
    }

    cprint.magenta('----');
}

// ******************************

function awsCreateClusterService (in_serviceConfig, in_prod) {
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
        // TODO - remove TM specific environment
        if (port.env !== 'prod') {
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

    let environment = (in_prod) ? 'prod' : 'test';
    let environmentNameLong = (in_prod) ? 'production' : 'test';
    let environmentTitle = str.toTitleCase(environment);
    let cluster = (serviceConfig.service.clusters || []).find(c => {
            return c.environment === environmentNameLong
        });

    if (!cluster) {
        cprint.yellow('No cluster set for "' + environmentNameLong + '" environment');
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
    let taskDefinitionArn = aws.getLatestTaskDefinitionArnForTaskDefinition(awsTaskDefinitionName, awsCache);
    if (!taskDefinitionArn) {
        return;
    }

    print.clearLine();
    print.keyVal('AWS Task Definition', awsTaskDefinitionName);

    let awsClusterServiceArn = aws.getClusterServiceArnForClusterName(awsClusterName, awsClusterServiceName, awsCache);
    if (awsClusterServiceArn) {
        cprint.green('Cluster service already exists!');
        return;
    }

    cprint.cyan('Creating cluster service...');
    if (!aws.createClusterService(awsClusterName, awsClusterServiceName, taskDefinitionArn, loadBalancers, desiredCount)) {
        return;
    }

    if (init.hasServiceConfigFile(serviceConfig.cwd)) {
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
    serviceConfig = init.updateServiceConfig(in_serviceConfig, {
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

function awsStartCluster (in_serviceConfig, in_prod) {
    let serviceConfig = service.accessConfig(aws.getMergedServiceConfig(in_serviceConfig), {
        service: {
            name: 'STRING',
            clusters: [
                {
                    environment: 'STRING',
                    auto_scaling_group_name: 'STRING'
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

    let environment = (in_prod) ? 'prod' : 'test';
    let environmentNameLong = (in_prod) ? 'production' : 'test';
    let cluster = (serviceConfig.service.clusters || []).find(c => {
            return c.environment === environmentNameLong
        });
    if (!cluster) {
        cprint.yellow('AWS cluster doesn\'t exist');
        return;
    }

    let autoScalingGroupName = cluster.auto_scaling_group_name;
    let autoScalingGroupInstanceCount = aws.getAutoScalingGroupInstanceCount(autoScalingGroupName);
    if (autoScalingGroupInstanceCount < 0) {
        cprint.yellow('AWS cluster doesn\'t exist');
        return;
    }

    if (autoScalingGroupInstanceCount == 0) {
        cprint.cyan('Starting AWS cluster...');
        aws.setAutoScalingGroupInstanceCount(autoScalingGroupName, 2, awsCache);
    } else {
        cprint.green('AWS cluster already started');
    }

    if (init.hasServiceConfigFile(serviceConfig.cwd)) {
        cache.save(serviceConfig.cwd, 'aws', awsCache);
    }
}

// ******************************

function awsStopCluster (in_serviceConfig, in_prod) {
    let serviceConfig = service.accessConfig(aws.getMergedServiceConfig(in_serviceConfig), {
        service: {
            name: 'STRING',
            clusters: [
                {
                    environment: 'STRING',
                    auto_scaling_group_name: 'STRING'
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

    let environment = (in_prod) ? 'prod' : 'test';
    let environmentNameLong = (in_prod) ? 'production' : 'test';
    let cluster = (serviceConfig.service.clusters || []).find(c => {
            return c.environment === environmentNameLong
        });
    if (!cluster) {
        cprint.yellow('AWS cluster doesn\'t exist');
        return;
    }

    let autoScalingGroupName = cluster.auto_scaling_group_name;
    let autoScalingGroupInstanceCount = aws.getAutoScalingGroupInstanceCount(autoScalingGroupName);
    if (autoScalingGroupInstanceCount < 0) {
        cprint.yellow('AWS cluster doesn\'t exist');
        return;
    }

    if (autoScalingGroupInstanceCount > 0) {
        cprint.cyan('Stopping AWS cluster...');
        aws.setAutoScalingGroupInstanceCount(autoScalingGroupName, 0, awsCache);
    } else {
        cprint.green('AWS cluster already stopped');
    }

    if (init.hasServiceConfigFile(serviceConfig.cwd)) {
        cache.save(serviceConfig.cwd, 'aws', awsCache);
    }
}

// ******************************
// Plugin Functions:
// ******************************

function handleCommand (in_args, in_params, in_serviceConfig) {
    let command = in_params.length ? in_params.shift().toLowerCase() : '';
    let _arg_prod = in_args['prod'];
    let extra = in_args['extra'];
    let stopTasks = in_args['stop-tasks'];

    let serviceConfig = in_serviceConfig || {};
    let serviceConfigAws = serviceConfig.aws || {};

    let prod = false;
    let allowProdAccess = serviceConfigAws.__allow_prod_access__;

    if (_arg_prod && allowProdAccess) {
        prod = true;
    } else if (_arg_prod) {
        cprint.red('Prod access has been denied');
        return true;
    }

    switch(command)
    {
        case '':
        case 'info':
        case 'state':
        case 'service':
            printAwsServiceInfo(in_serviceConfig, prod, extra);
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
            awsCreateLaunchConfiguration(in_serviceConfig, prod);
            break;

        case 'create-repository':
            awsCreateRepository(in_serviceConfig);
            break;

        case 'create-cluster':
            awsCreateCluster(in_serviceConfig, prod);
            break;

        case 'create-cluster-service':
            awsCreateClusterService(in_serviceConfig, prod);
            break;

        case 'deploy':
            awsDeploy(in_serviceConfig, stopTasks, prod);
            break;

        case 'start-cluster':
        case 'start':
            awsStartCluster(in_serviceConfig, prod);
            break;

        case 'stop-cluster':
        case 'stop':
            awsStopCluster(in_serviceConfig, prod);
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
            {param:'prod', description:'Include production environment information'},
            {param:'extra', description:'Include extra information'}
        ] },
        { params: ['docker-login'], description: 'Log into AWS docker repository' },
        { params: ['create-task-definition'], description: 'Create task definition for the service' },
        { params: ['clean-task-definitions', 'clean'], description: 'Deregister old task definitions for the service' },
        { params: ['create-launch-configuration'], description: 'Create launch configuration for the service' },
        { params: ['create-repository'], description: 'Create repository for the service' },
        { params: ['create-cluster'], description: 'Create cluster for the service' },
        { params: ['create-cluster-service'], description: 'Create cluster-service for the service' },
        { params: ['deploy'], description: 'Deploy latest task definition for service', options: [{param:'stop-tasks', description:'Stop existing tasks'}, {param:'prod', description:'Production cluster'}] },
        { params: ['start-cluster', 'start'], description: 'Start AWS cluster', options: [{param:'prod', description:'Production cluster'}] },
        { params: ['stop-cluster', 'stop'], description: 'Stop AWS cluster', options: [{param:'prod', description:'Production cluster'}] },
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
