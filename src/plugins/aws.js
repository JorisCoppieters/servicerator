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
    let serviceConfig = service.accessConfig(_getAwsServiceConfig(in_serviceConfig), {
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
                    let awsAutoScalingGroupInstanceCount = _getAutoScalingGroupInstanceCount(cluster.auto_scaling_group_name, awsCache);
                    print.clearLine();

                    if (awsAutoScalingGroupInstanceCount !== undefined) {
                        let serviceState = _getServiceStateFromAutoScalingGroupInstanceCount(awsAutoScalingGroupInstanceCount);
                        print.keyVal('AWS ' + environmentTitle + ' Cluster Service State', serviceState);
                    } else {
                        print.keyVal('AWS ' + environmentTitle + ' Cluster Service State', '???');
                    }
                }

                if (in_extra && cluster.name) {
                    print.keyVal('AWS ' + environmentTitle + ' Cluster Service', '...', true);
                    let awsClusterServiceArn = _getClusterServiceArnForCluster(cluster.name, awsCache);
                    print.clearLine();

                    if (awsClusterServiceArn) {
                        let awsClusterServiceName = _arnToTitle(awsClusterServiceArn);
                        print.keyVal('AWS ' + environmentTitle + ' Cluster Service', awsClusterServiceName);
                    } else {
                        print.keyVal('AWS ' + environmentTitle + ' Cluster Service', '???');
                    }

                    print.keyVal('AWS ' + environmentTitle + ' Cluster Service Task Definition', '...', true);
                    let awsTaskDefinitionArn = _getTaskDefinitionArnForClusterService(cluster.name, awsClusterServiceArn, awsCache);
                    print.clearLine();

                    if (awsTaskDefinitionArn) {
                        let awsTaskDefinitionName = _arnToTitle(awsTaskDefinitionArn);
                        print.keyVal('AWS ' + environmentTitle + ' Cluster Service Task Definition', awsTaskDefinitionName);
                    } else {
                        print.keyVal('AWS ' + environmentTitle + ' Cluster Service Task Definition', '???');
                    }

                    print.keyVal('AWS ' + environmentTitle + ' Cluster Tasks', '...', true);
                    let awsClusterTaskArns = _getClusterTaskArnsForCluster(cluster.name, awsCache);
                    print.clearLine();

                    if (awsClusterTaskArns) {
                        let awsClusterTaskNames = awsClusterTaskArns.map(a => _arnToTitle(a));
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

                let instanceIds = _getInstanceIdsWithTags([
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
                    let awsVpcId = _getVpcIdForVpc(cluster.vpc_name, awsCache);
                    print.clearLine();

                    if (awsVpcId) {
                        print.keyVal('AWS ' + environmentTitle + ' VPC Id', awsVpcId);
                    } else {
                        print.keyVal('AWS ' + environmentTitle + ' VPC Id', '???');
                    }

                    print.keyVal('AWS ' + environmentTitle + ' VPC Security Group Id', '...', true);
                    let awsVpcSecurityGroupId = _getVpcSecurityGroupIdForVpc(awsVpcId, awsCache);
                    print.clearLine();

                    if (awsVpcSecurityGroupId) {
                        print.keyVal('AWS ' + environmentTitle + ' VPC Security Group Id', awsVpcSecurityGroupId);
                    } else {
                        print.keyVal('AWS ' + environmentTitle + ' VPC Security Group Id', '???');
                    }

                    let awsVpcSubnetName = cluster.vpc_subnet_name;
                    print.keyVal('AWS ' + environmentTitle + ' VPC Subnet Name', awsVpcSubnetName);

                    print.keyVal('AWS ' + environmentTitle + ' VPC Subnet Id', '...', true);
                    let awsVpcSubnetId = _getVpcSubnetIdForVpc(awsVpcId, awsVpcSubnetName, awsCache);
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
    let serviceConfig = service.accessConfig(_getAwsServiceConfig(in_serviceConfig), {
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
        cprint.yellow('No service name set');
        return false;
    }

    let awsTaskDefinitionName = serviceConfig.service.task_definition_name;
    if (!awsTaskDefinitionName) {
        cprint.yellow('No service task definition name set');
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

    let dockerImageName = serviceConfig.docker.image.name || 'image';
    let dockerImageVersion = serviceConfig.docker.image.version || '1.0.0';
    let awsDockerRepository = aws.getDockerRepository(in_serviceConfig);
    if (!awsDockerRepository) {
        cprint.yellow('Couldn\'t get aws docker repository');
        return false;
    }

    let awsTaskDefinitionImagePath = awsDockerRepository + '/' + dockerImageName + ':' + dockerImageVersion;
    let awsClusterName = cluster.name;
    let awsClusterServiceName = cluster.service_name;
    let awsClusterServiceInstanceCount = cluster.instance.count || 1;

    let awsCache = cache.load(serviceConfig.cwd, 'aws');

    cprint.magenta('-- Deploy --');
    print.keyVal('AWS Task Definition Name', awsTaskDefinitionName);
    print.keyVal('AWS Task Definition Image Path', awsTaskDefinitionImagePath);

    print.keyVal('AWS Task Definition', '...', true);
    let taskDefinitionArn = _getLatestTaskDefinitionArnForTaskDefinition(awsTaskDefinitionName, awsCache);
    if (!taskDefinitionArn) {
        return;
    }

    let awsClusterServiceArn = _getClusterServiceArnForCluster(awsClusterName, awsCache);
    if (!awsClusterServiceArn) {
        return;
    }

    print.clearLine();
    print.keyVal('AWS Task Definition', awsTaskDefinitionName);

    print.keyVal('AWS ' + environmentTitle + ' Cluster Name', awsClusterName);
    print.keyVal('AWS ' + environmentTitle + ' Cluster Service Name', awsClusterServiceName);
    print.keyVal('AWS ' + environmentTitle + ' Cluster Service Instance Count', awsClusterServiceInstanceCount);

    print.keyVal('AWS ' + environmentTitle + ' Cluster Tasks', '...', true);
    let awsClusterTaskArns = _getClusterTaskArnsForCluster(awsClusterName, awsCache);
    if (!awsClusterTaskArns) {
        return;
    }
    print.clearLine();
    let awsClusterTaskNames = awsClusterTaskArns.map(a => _arnToTitle(a));
    print.keyVal('AWS ' + environmentTitle + ' Cluster Tasks', JSON.stringify(awsClusterTaskNames, null, 4));

    if (in_stopTasks) {
        awsClusterTaskArns.forEach(t => {
            _stopClusterTask(awsClusterName, t)
        });
    }

    _deployTaskDefinitionToCluster(awsClusterName, awsClusterServiceArn, taskDefinitionArn, awsClusterServiceInstanceCount);

    if (init.hasServiceConfigFile(serviceConfig.cwd)) {
        cache.save(serviceConfig.cwd, 'aws', awsCache);
    }

    cprint.magenta('----');
}

// ******************************

function awsCreateTaskDefinition (in_serviceConfig) {
    let serviceConfig = service.accessConfig(_getAwsServiceConfig(in_serviceConfig), {
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
        cprint.yellow('No service name set');
        return false;
    }

    let awsTaskDefinitionName = serviceConfig.service.task_definition_name;
    if (!awsTaskDefinitionName) {
        cprint.yellow('No service task definition name set');
        return false;
    }

    if (!aws.installed()) {
        cprint.yellow('AWS-CLI isn\'t installed');
        return false;
    }

    let dockerImageName = serviceConfig.docker.image.name || 'image';
    let dockerImageVersion = serviceConfig.docker.image.version || '1.0.0';

    let awsDockerRepository = aws.getDockerRepository(in_serviceConfig);
    if (!awsDockerRepository) {
        cprint.yellow('Couldn\'t get aws docker repository');
        return false;
    }

    let awsTaskDefinitionImagePath = awsDockerRepository + '/' + dockerImageName + ':' + dockerImageVersion;
    let awsTaskDefinitionMemoryLimit = serviceConfig.docker.container.memory_limit || 500;

    let awsCache = cache.load(serviceConfig.cwd, 'aws');

    cprint.magenta('-- Task Definition --');
    print.keyVal('AWS Task Definition Name', awsTaskDefinitionName);
    print.keyVal('AWS Task Definition Image Path', awsTaskDefinitionImagePath);

    // TODO - remove TM specific filebeat
    let awsTaskDefinitionFilebeatImagePath = awsDockerRepository + '/' + 'filebeat-tm-services' + ':' + 'latest';
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
        _clearCachedTaskDefinitionArnForTaskDefinition(awsTaskDefinitionName, cache);
    }

    if (init.hasServiceConfigFile(serviceConfig.cwd)) {
        cache.save(serviceConfig.cwd, 'aws', awsCache);
    }

    cprint.magenta('----');
}

// ******************************

function awsCleanTaskDefinitions (in_serviceConfig) {
    let serviceConfig = service.accessConfig(_getAwsServiceConfig(in_serviceConfig), {
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
        cprint.yellow('No service name set');
        return false;
    }

    let awsTaskDefinitionName = serviceConfig.service.task_definition_name;
    if (!awsTaskDefinitionName) {
        cprint.yellow('No service task definition name set');
        return false;
    }

    if (!aws.installed()) {
        cprint.yellow('AWS-CLI isn\'t installed');
        return false;
    }

    let awsCache = cache.load(serviceConfig.cwd, 'aws');

    let taskDefinitionArns = _getPreviousTaskDefinitionArnsForTaskDefinition(awsTaskDefinitionName, awsCache);

    if (!taskDefinitionArns || !taskDefinitionArns.length) {
        cprint.green('Nothing to clean up!');
        return;
    }

    taskDefinitionArns
        .forEach(t => {
            _deregisterTaskDefinition(t);
        });

    if (init.hasServiceConfigFile(serviceConfig.cwd)) {
        cache.save(serviceConfig.cwd, 'aws', awsCache);
    }
}

// ******************************

function awsCreateLaunchConfiguration (in_serviceConfig, in_prod) {
    let serviceConfig = service.accessConfig(_getAwsServiceConfig(in_serviceConfig), {
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
        cprint.yellow('No service name set');
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
    let awsVpcId = _getVpcIdForVpc(awsVpcName, awsCache);
    if (!awsVpcId) {
        return;
    }
    print.clearLine();
    print.keyVal('AWS ' + environmentTitle + ' VPC Id', awsVpcId);

    print.keyVal('AWS ' + environmentTitle + ' VPC Security Group Id', '...', true);
    let awsVpcSecurityGroupId = _getVpcSecurityGroupIdForVpc(awsVpcId, awsCache);
    if (!awsVpcSecurityGroupId) {
        return;
    }
    print.clearLine();
    print.keyVal('AWS ' + environmentTitle + ' VPC Security Group Id', awsVpcSecurityGroupId);

    let awsVpcSubnetName = cluster.vpc_subnet_name;
    print.keyVal('AWS ' + environmentTitle + ' VPC Subnet Name', awsVpcSubnetName);

    print.keyVal('AWS ' + environmentTitle + ' VPC Subnet Id', '...', true);
    let awsVpcSubnetId = _getVpcSubnetIdForVpc(awsVpcId, awsVpcSubnetName, awsCache);
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

function awsDockerLogin (in_serviceConfig) {
    let serviceConfig = service.accessConfig(_getAwsServiceConfig(in_serviceConfig), {
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

    let awsDockerRepository = aws.getDockerRepository(in_serviceConfig);
    if (!awsDockerRepository) {
        cprint.yellow('Couldn\'t get aws docker repository');
        return false;
    }

    docker.login(awsDockerCredentials.username, awsDockerCredentials.password, awsDockerRepository);
}

// ******************************

function awsStartCluster (in_serviceConfig, in_prod) {
    let serviceConfig = service.accessConfig(_getAwsServiceConfig(in_serviceConfig), {
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
        cprint.yellow('No service name set');
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
    let autoScalingGroupInstanceCount = _getAutoScalingGroupInstanceCount(autoScalingGroupName);
    if (autoScalingGroupInstanceCount < 0) {
        cprint.yellow('AWS cluster doesn\'t exist');
        return;
    }

    if (autoScalingGroupInstanceCount == 0) {
        cprint.cyan('Starting AWS cluster...');
        _setAutoScalingGroupInstanceCount(autoScalingGroupName, 2, awsCache);
    } else {
        cprint.green('AWS cluster already started');
    }

    if (init.hasServiceConfigFile(serviceConfig.cwd)) {
        cache.save(serviceConfig.cwd, 'aws', awsCache);
    }
}

// ******************************

function awsStopCluster (in_serviceConfig, in_prod) {
    let serviceConfig = service.accessConfig(_getAwsServiceConfig(in_serviceConfig), {
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
        cprint.yellow('No service name set');
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
    let autoScalingGroupInstanceCount = _getAutoScalingGroupInstanceCount(autoScalingGroupName);
    if (autoScalingGroupInstanceCount < 0) {
        cprint.yellow('AWS cluster doesn\'t exist');
        return;
    }

    if (autoScalingGroupInstanceCount > 0) {
        cprint.cyan('Stopping AWS cluster...');
        _setAutoScalingGroupInstanceCount(autoScalingGroupName, 0, awsCache);
    } else {
        cprint.green('AWS cluster already stopped');
    }

    if (init.hasServiceConfigFile(serviceConfig.cwd)) {
        cache.save(serviceConfig.cwd, 'aws', awsCache);
    }
}

// ******************************
// Helper Functions:
// ******************************

function _getServiceStateFromAutoScalingGroupInstanceCount (in_autoScalingGroupInstanceCount) {
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

function _setAutoScalingGroupInstanceCount (in_autoScalingGroupName, in_autoScalingGroupInstanceCount, in_cache) {
    cprint.cyan('Setting Instance Count for AWS Auto Scaling Group "' + in_autoScalingGroupName + '" to ' + in_autoScalingGroupInstanceCount + '...');

    let autoScalingGroupInstanceCount = in_autoScalingGroupInstanceCount || 1;

    let cmdResult = aws.cmd([
        'autoscaling',
        'update-auto-scaling-group',
        '--auto-scaling-group=' + in_autoScalingGroupName,
        '--desired-capacity=' + in_autoScalingGroupInstanceCount,
        '--min-size=0'
    ]);

    if (cmdResult.hasError) {
        cmdResult.printError('  ');
        return false;
    }

    cmdResult.printResult('  ');
    cprint.green('Set Instance Count for AWS Auto Scaling Group "' + in_autoScalingGroupName + '" to ' + in_autoScalingGroupInstanceCount);
    _clearCachedAutoScalingGroupInstanceCount(in_autoScalingGroupName, in_cache);
    return true;
}

// ******************************

function _clearCachedAutoScalingGroupInstanceCount (in_autoScalingGroupName, in_cache) {
    let cache = in_cache || {};
    cache['AutoScalingGroupInstanceCount_' + in_autoScalingGroupName] = undefined;
}

// ******************************

function _getAutoScalingGroupInstanceCount (in_autoScalingGroupName, in_cache, in_verbose) {
    if (in_verbose) {
        cprint.cyan('Retrieving Instance Count for AWS Auto Scaling Group "' + in_autoScalingGroupName + '"...');
    }

    let cache = in_cache || {};
    let cacheItem = cache['AutoScalingGroupInstanceCount_' + in_autoScalingGroupName];
    let cacheVal = (cacheItem || {}).val;
    if (cacheVal !== undefined) {
        return cacheVal;
    }

    let cmdResult = aws.cmd([
        'autoscaling',
        'describe-auto-scaling-groups',
        '--auto-scaling-group=' + in_autoScalingGroupName
    ], !in_verbose);

    if (cmdResult.hasError) {
        cmdResult.printError('  ');
        return;
    }

    let desiredCapacity;
    let awsResult = _parseCmdResult(cmdResult);
    if (awsResult && awsResult.AutoScalingGroups) {
        desiredCapacity = awsResult.AutoScalingGroups
            .map(obj => obj.DesiredCapacity)
            .find(obj => true);
    }

    if (desiredCapacity === undefined) {
        cprint.yellow('Couldn\'t find Instance Count for AWS Auto Scaling Group "' + in_autoScalingGroupName + '"');
        return;
    }

    cache['AutoScalingGroupInstanceCount_' + in_autoScalingGroupName] = {
        val: desiredCapacity,
        expires: date.getTimestamp() + 120 * 1000
    };

    return desiredCapacity;
}

// ******************************

function _deployTaskDefinitionToCluster (in_clusterName, in_serviceArn, in_taskDefinitionArn, in_instanceCount) {
    cprint.cyan('Deploying AWS Task Definition "' + in_taskDefinitionArn + '" to AWS Cluster "' + in_clusterName + '"...');

    let instanceCount = in_instanceCount || 1;

    let cmdResult = aws.cmd([
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
    ]);

    if (cmdResult.hasError) {
        cmdResult.printError('  ');
        return false;
    }

    // cmdResult.printResult('  ');
    cprint.green('Deployed AWS Task Definition "' + in_taskDefinitionArn + '" to AWS Cluster "' + in_clusterName + '"');
    return true;
}

// ******************************

function _stopClusterTask (in_clusterName, in_taskArn) {
    cprint.cyan('Stopping AWS Task "' + in_taskArn + '" in AWS Cluster "' + in_clusterName + '"...');

    let cmdResult = aws.cmd([
        'ecs',
        'stop-task',
        '--task',
        in_taskArn,
        '--cluster',
        in_clusterName
    ]);

    if (cmdResult.hasError) {
        cmdResult.printError('  ');
        return false;
    }

    cmdResult.printResult('  ');
    cprint.green('Stopped AWS Task "' + in_taskArn + '" in AWS Cluster "' + in_clusterName + '"');
    return true;
}

// ******************************

function _getClusterServiceArnForCluster (in_clusterName, in_cache, in_verbose) {
    if (in_verbose) {
        cprint.cyan('Retrieving AWS Cluster Service ARN for AWS Cluster "' + in_clusterName + '"...');
    }

    let cache = in_cache || {};
    let cacheItem = cache['ClusterServiceArn_' + in_clusterName];
    let cacheVal = (cacheItem || {}).val;
    if (cacheVal !== undefined) {
        return cacheVal;
    }

    let cmdResult = aws.cmd([
        'ecs',
        'list-services',
        '--cluster',
        in_clusterName
    ], !in_verbose);

    if (cmdResult.hasError) {
        cmdResult.printError('  ');
        return;
    }

    let awsClusterServiceArn;
    let awsResult = _parseCmdResult(cmdResult);
    if (awsResult && awsResult.serviceArns) {
        awsClusterServiceArn = awsResult.serviceArns
            .find(obj => true);
    }

    if (!awsClusterServiceArn) {
        cprint.yellow('Couldn\'t find AWS Cluster Service ARN for AWS Cluster "' + in_clusterName + '"');
        return;
    }

    cache['ClusterServiceArn_' + in_clusterName] = {
        val: awsClusterServiceArn,
        expires: date.getTimestamp() + 120 * 1000
    };

    return awsClusterServiceArn;
}

// ******************************

function _getTaskDefinitionArnForClusterService (in_clusterName, in_clusterServiceArn, in_cache, in_verbose) {
    if (in_verbose) {
        cprint.cyan('Retrieving AWS Task Definition ARN for AWS Cluster Service "' + in_clusterServiceArn + '"...');
    }

    let cache = in_cache || {};
    let cacheItem = cache['TaskDefinitionArn_' + in_clusterServiceArn];
    let cacheVal = (cacheItem || {}).val;
    if (cacheVal !== undefined) {
        return cacheVal;
    }

    let cmdResult = aws.cmd([
        'ecs',
        'describe-services',
        '--cluster',
        in_clusterName,
        '--service',
        in_clusterServiceArn
    ], !in_verbose);

    if (cmdResult.hasError) {
        cmdResult.printError('  ');
        return;
    }

    let awsTaskDefinitionArn;
    let awsResult = _parseCmdResult(cmdResult);
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
        expires: date.getTimestamp() + 120 * 1000
    };

    return awsTaskDefinitionArn;
}

// ******************************

function _getClusterTaskArnsForCluster (in_clusterName, in_cache, in_verbose) {
    if (in_verbose) {
        cprint.cyan('Retrieving AWS Cluster Task ARNs for AWS Cluster "' + in_clusterName + '"...');
    }

    let cache = in_cache || {};
    let cacheItem = cache['ClusterTaskArns_' + in_clusterName];
    let cacheVal = (cacheItem || {}).val;
    if (cacheVal !== undefined) {
        return cacheVal;
    }

    let cmdResult = aws.cmd([
        'ecs',
        'list-tasks',
        '--cluster',
        in_clusterName
    ], !in_verbose);

    if (cmdResult.hasError) {
        cmdResult.printError('  ');
        return;
    }

    let awsResult = _parseCmdResult(cmdResult);
    let awsClusterTaskArns = (awsResult || {}).taskArns;

    if (!awsClusterTaskArns) {
        cprint.yellow('Couldn\'t find AWS Cluster Task ARNs for AWS Cluster "' + in_clusterName + '"');
        return;
    }

    cache['ClusterTaskArns_' + in_clusterName] = {
        val: awsClusterTaskArns,
        expires: date.getTimestamp() + 120 * 1000
    };

    return awsClusterTaskArns;
}

// ******************************

function _getInstanceIdsWithTags (in_tags, in_cache, in_verbose) {
    let tags = in_tags || [];
    let tagsStr = JSON.stringify(tags);

    if (in_verbose) {
        cprint.cyan('Retrieving AWS Instance IDs for tags [' + tagsStr + ']...');
    }

    let cache = in_cache || {};
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

    let cmdResult = aws.cmd(args, !in_verbose);

    if (cmdResult.hasError) {
        cmdResult.printError('  ');
        return false;
    }

    let awsInstanceIds;
    let awsResult = _parseCmdResult(cmdResult);
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
        expires: date.getTimestamp() + 600 * 1000
    };

    return awsInstanceIds;
}

// ******************************

function _getVpcIdForVpc (in_vpcName, in_cache, in_verbose) {
    if (in_verbose) {
        cprint.cyan('Retrieving AWS VPC ID for AWS VPC Name "' + in_vpcName + '"...');
    }

    let cache = in_cache || {};
    let cacheItem = cache['VpcId_' + in_vpcName];
    let cacheVal = (cacheItem || {}).val;
    if (cacheVal !== undefined) {
        return cacheVal;
    }

    let cmdResult = aws.cmd([
        'ec2',
        'describe-vpcs',
        '--filter',
        `Name="tag-value",Values="${in_vpcName}"`
    ], !in_verbose);

    if (cmdResult.hasError) {
        cmdResult.printError('  ');
        return false;
    }

    let awsVpcId;
    let awsResult = _parseCmdResult(cmdResult);
    if (awsResult && awsResult.Vpcs) {
        awsVpcId = awsResult.Vpcs
            .sort()
            .reverse()
            .map(obj => obj.VpcId)
            .find(obj => true);
    }

    if (!awsVpcId) {
        cprint.yellow('Couldn\'t find AWS VPC ID for AWS VPC Name "' + in_vpcName + '"');
        return false;
    }

    cache['VpcId_' + in_vpcName] = {
        val: awsVpcId,
        expires: date.getTimestamp() + 7 * 24 * 3600 * 1000
    };

    return awsVpcId;
}

// ******************************

function _getVpcSecurityGroupIdForVpc (in_vpcId, in_cache, in_verbose) {
    if (in_verbose) {
        cprint.cyan('Retrieving AWS Security Group Id for AWS VPC Id "' + in_vpcId + '"...');
    }

    let cache = in_cache || {};
    let cacheItem = cache['VpcSecurityGroupId_' + in_vpcId];
    let cacheVal = (cacheItem || {}).val;
    if (cacheVal !== undefined) {
        return cacheVal;
    }

    let cmdResult = aws.cmd([
        'ec2',
        'describe-security-groups',
        '--filters',
        `Name=vpc-id,Values="${in_vpcId}"`,
        `Name=group-name,Values="default"`
    ], !in_verbose);

    if (cmdResult.hasError) {
        cmdResult.printError('  ');
        return false;
    }

    let awsVpcSecurityGroupId;
    let awsResult = _parseCmdResult(cmdResult);
    if (awsResult && awsResult.SecurityGroups) {
        awsVpcSecurityGroupId = awsResult.SecurityGroups
            .sort()
            .reverse()
            .map(obj => obj.GroupId)
            .find(obj => true);
    }

    if (!awsVpcSecurityGroupId) {
        cprint.yellow('Couldn\'t find AWS Security Group Id for AWS VPC Id "' + in_vpcId + '"');
        return false;
    }

    cache['VpcSecurityGroupId_' + in_vpcId] = {
        val: awsVpcSecurityGroupId,
        expires: date.getTimestamp() + 7 * 24 * 3600 * 1000
    };

    return awsVpcSecurityGroupId;
}

// ******************************

function _getVpcSubnetIdForVpc (in_vpcId, in_vpcSubnetName, in_cache, in_verbose) {
    if (in_verbose) {
        cprint.cyan('Retrieving AWS VPC Subnet Id for AWS VPC Subnet Name "' + in_vpcSubnetName + '"...');
    }

    let cache = in_cache || {};
    let cacheItem = cache['VpcSubnetId_' + in_vpcSubnetName];
    let cacheVal = (cacheItem || {}).val;
    if (cacheVal !== undefined) {
        return cacheVal;
    }

    let cmdResult = aws.cmd([
        'ec2',
        'describe-subnets',
        '--filters',
        `Name=vpc-id,Values="${in_vpcId}"`,
        `Name=tag-value,Values="${in_vpcSubnetName}"`
    ], !in_verbose);

    if (cmdResult.hasError) {
        cmdResult.printError('  ');
        return false;
    }

    let awsVpcSubnetId;
    let awsResult = _parseCmdResult(cmdResult);
    if (awsResult && awsResult.Subnets) {
        awsVpcSubnetId = awsResult.Subnets
            .sort()
            .reverse()
            .map(obj => obj.SubnetId)
            .find(obj => true);
    }

    if (!awsVpcSubnetId) {
        cprint.yellow('Couldn\'t find AWS VPC Subnet Id for AWS VPC Subnet Name "' + in_vpcSubnetName + '"');
        return false;
    }

    cache['VpcSubnetId_' + in_vpcSubnetName] = {
        val: awsVpcSubnetId,
        expires: date.getTimestamp() + 7 * 24 * 3600 * 1000
    };

    return awsVpcSubnetId;
}

// ******************************

function _getLatestTaskDefinitionArnForTaskDefinition (in_taskDefinitionName, in_cache, in_verbose) {
    if (in_verbose) {
        cprint.cyan('Retrieving latest AWS Task Definition ARN for AWS Task Definition "' + in_taskDefinitionName + '"...');
    }

    let cache = in_cache || {};
    let cacheItem = cache['LatestTaskDefinitionArn_' + in_taskDefinitionName];
    let cacheVal = (cacheItem || {}).val;
    if (cacheVal !== undefined) {
        return cacheVal;
    }

    let cmdResult = aws.cmd([
        'ecs',
        'list-task-definitions',
        '--family-prefix',
        in_taskDefinitionName
    ], !in_verbose);

    if (cmdResult.hasError) {
        cmdResult.printError('  ');
        return false;
    }

    let latestTaskDefinitionArn;
    let awsResult = _parseCmdResult(cmdResult);
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
        expires: date.getTimestamp() + 120 * 1000
    };

    return latestTaskDefinitionArn;
}

// ******************************

function _getPreviousTaskDefinitionArnsForTaskDefinition (in_taskDefinitionName, in_cache, in_verbose) {
    if (in_verbose) {
        cprint.cyan('Retrieving previous AWS Task Definition ARNs for AWS Task Definition "' + in_taskDefinitionName + '"...');
    }

    let cache = in_cache || {};
    let cacheItem = cache['PreviousTaskDefinitionArns_' + in_taskDefinitionName];
    let cacheVal = (cacheItem || {}).val;
    if (cacheVal !== undefined) {
        return cacheVal;
    }

    let cmdResult = aws.cmd([
        'ecs',
        'list-task-definitions',
        '--family-prefix',
        in_taskDefinitionName
    ], !in_verbose);

    if (cmdResult.hasError) {
        cmdResult.printError('  ');
        return false;
    }

    let previousTaskDefinitionArn;
    let awsResult = _parseCmdResult(cmdResult);
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
        expires: date.getTimestamp() + 1000
    };

    return previousTaskDefinitionArn;
}

// ******************************

function _deregisterTaskDefinition (in_taskDefinitionArn) {
    cprint.cyan('Deregistering AWS Task Definition "' + in_taskDefinitionArn + '"...');

    let cmdResult = aws.cmd([
        'ecs',
        'deregister-task-definition',
        '--task-definition',
        in_taskDefinitionArn
    ]);

    if (cmdResult.hasError) {
        cmdResult.printError('  ');
        return false;
    }

    cmdResult.printResult('  ');
    cprint.green('Deregistered AWS Task Definition "' + in_taskDefinitionArn + '"');
    return true;
}

// ******************************

function _arnToTitle (in_arn) {
    let title = in_arn || '';
    let match = in_arn.match(/arn:aws:[a-z]+:[a-z0-9-]+:[0-9]+:[a-z-]+\/(.*)/);
    if (match) {
        title = match[1];
    }

    return title;
}

// ******************************

function _clearCachedTaskDefinitionArnForTaskDefinition (in_taskDefinitionName, in_cache) {
    let cache = in_cache || {};
    cache['TaskDefinitionArn_' + in_taskDefinitionName] = undefined;
}

// ******************************

function _parseCmdResult (in_cmdResult) {
    if (in_cmdResult.hasError) {
        in_cmdResult.printError('  ');
    }

    let jsonObject;
    try {
        jsonObject = JSON.parse(in_cmdResult.result)
    } catch (e) {
        cprint.red('Failed to parse "' + jsonObject.result + '":\n  ' + e);
        return false;
    }

    return jsonObject;
}

// ******************************

function _getAwsServiceConfig (in_serviceConfig) {
    let serviceConfig = in_serviceConfig || {};
    let awsServiceConfig = aws.getServiceConfig();
    service.copyConfig(awsServiceConfig, serviceConfig);
    return serviceConfig;
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
