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
                    vpc_subnet_name: 'STRING',
                    task_definition_name: 'STRING'
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
                    return true;
                }
            });

        if (serviceName) {
            cprint.magenta('-- AWS Clusters State --');

            clusters.forEach(cluster => {
                let environment = cluster.environment;
                if (!environment) {
                    return;
                }
                let environmentTitle = str.toTitleCase(environment);
                let awsAutoScalingGroupName = cluster.auto_scaling_group_name || '(Not Set)';
                let awsClusterName = cluster.name || '(Not Set)';
                let awsClusterServiceName = cluster.service_name || '(Not Set)';
                let awsTaskDefinitionName = cluster.task_definition_name || '(Not Set)';

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
                    print.keyVal('AWS ' + environmentTitle + ' Cluster Service ARN', '...', true);
                    let awsClusterServiceArn = _getClusterServiceArnForCluster(cluster.name, awsCache);
                    print.clearLine();

                    if (awsClusterServiceArn) {
                        print.keyVal('AWS ' + environmentTitle + ' Cluster Service ARN', awsClusterServiceArn);
                    } else {
                        print.keyVal('AWS ' + environmentTitle + ' Cluster Service ARN', '???');
                    }

                    print.keyVal('AWS ' + environmentTitle + ' Cluster Task ARNs', '...', true);
                    let awsClusterTaskArns = _getClusterTaskArnsForCluster(cluster.name, awsCache);
                    print.clearLine();

                    if (awsClusterTaskArns) {
                        print.keyVal('AWS ' + environmentTitle + ' Cluster Task ARNs', JSON.stringify(awsClusterTaskArns, null, 4));
                    } else {
                        print.keyVal('AWS ' + environmentTitle + ' Cluster Task ARNs', '???');
                    }
                }

                print.out('\n');
            });
        }

        if (in_extra) {
            cprint.magenta('-- AWS Network --');

            clusters.forEach(cluster => {
                let environment = cluster.environment;
                if (!environment) {
                    return;
                }
                let environmentTitle = str.toTitleCase(environment);
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

function awsDeploy (in_serviceConfig, in_prod) {
    let serviceConfig = service.accessConfig(_getAwsServiceConfig(in_serviceConfig), {
        docker: {
            image: {
                name: 'STRING',
                version: 'STRING'
            }
        },
        service: {
            name: 'STRING',
            clusters: [
                {
                    name: 'STRING',
                    service_name: 'STRING',
                    task_definition_name: 'STRING',
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
    let awsTaskDefinitionName = cluster.task_definition_name;
    let awsClusterName = cluster.name;
    let awsClusterServiceName = cluster.service_name;
    let awsClusterServiceInstanceCount = cluster.instance.count || 1;

    let awsCache = cache.load(serviceConfig.cwd, 'aws');

    cprint.magenta('-- Deploy --');
    print.keyVal('AWS Task Definition Name', awsTaskDefinitionName);
    print.keyVal('AWS Task Definition Image Path', awsTaskDefinitionImagePath);

    print.keyVal('AWS Task Definition ARN', '...', true);
    let taskDefinitionArn = _getTaskDefinitionArnForTaskDefinition(awsTaskDefinitionName, awsCache);
    if (!taskDefinitionArn) {
        return;
    }
    print.clearLine();
    print.keyVal('AWS Task Definition ARN', taskDefinitionArn);

    print.keyVal('AWS ' + environmentTitle + ' Cluster Name', awsClusterName);
    print.keyVal('AWS ' + environmentTitle + ' Cluster Service Name', awsClusterServiceName);
    print.keyVal('AWS ' + environmentTitle + ' Cluster Service Instance Count', awsClusterServiceInstanceCount);

    print.keyVal('AWS ' + environmentTitle + ' Cluster Task ARNs', '...', true);
    let awsClusterTaskArns = _getClusterTaskArnsForCluster(awsClusterName, awsCache);
    if (!awsClusterTaskArns) {
        return;
    }
    print.clearLine();
    print.keyVal('AWS ' + environmentTitle + ' Cluster Task ARNs', JSON.stringify(awsClusterTaskArns, null, 4));

    print.keyVal('AWS ' + environmentTitle + ' Cluster Service ARN', '...', true);
    let awsClusterServiceArn = _getClusterServiceArnForCluster(awsClusterName, awsCache);
    if (!awsClusterServiceArn) {
        return;
    }
    print.clearLine();
    print.keyVal('AWS ' + environmentTitle + ' Cluster Service ARN', awsClusterServiceArn);

    awsClusterTaskArns.forEach(t => {
        _stopClusterTask(awsClusterName, t)
    });

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
            name: 'STRING'
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
    let awsTaskDefinitionName = serviceName + '-task-definition';
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
                        volumes: []
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

    cmdResult.printResult('  ');
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

function _getTaskDefinitionArnForTaskDefinition (in_taskDefinitionName, in_cache, in_verbose) {
    if (in_verbose) {
        cprint.cyan('Retrieving AWS Task Definition ARN for AWS Task Definition "' + in_taskDefinitionName + '"...');
    }

    let cache = in_cache || {};
    let cacheItem = cache['TaskDefinitionArn_' + in_taskDefinitionName];
    let cacheVal = (cacheItem || {}).val;
    if (cacheVal !== undefined) {
        return cacheVal;
    }

    let cmdResult = aws.cmd([
        'ecs',
        'list-task-definitions'
    ], !in_verbose);

    if (cmdResult.hasError) {
        cmdResult.printError('  ');
        return false;
    }

    let latestTaskDefinitionArn;
    let awsResult = _parseCmdResult(cmdResult);
    if (awsResult && awsResult.taskDefinitionArns) {
        latestTaskDefinitionArn = awsResult.taskDefinitionArns
            .filter(obj => obj.match(in_taskDefinitionName))
            .sort()
            .reverse()
            .find(obj => true);
    }

    if (!latestTaskDefinitionArn) {
        cprint.yellow('Couldn\'t find AWS Task Definition ARN for AWS Task Definition "' + in_taskDefinitionName + '"');
        return;
    }

    cache['TaskDefinitionArn_' + in_taskDefinitionName] = {
        val: latestTaskDefinitionArn,
        expires: date.getTimestamp() + 120 * 1000
    };

    return latestTaskDefinitionArn;
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

        case 'create-launch-configuration':
            awsCreateLaunchConfiguration(in_serviceConfig, prod);
            break;

        case 'deploy':
            awsDeploy(in_serviceConfig, prod);
            break;

        case 'start-cluster':
            awsStartCluster(in_serviceConfig, prod);
            break;

        case 'stop-cluster':
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
        { params: ['create-launch-configuration'], description: 'Create launch configuration for the service' },
        { params: ['deploy'], description: 'Deploy latest task definition for service', options: [{param:'prod', description:'Production cluster'}] },
        { params: ['start-cluster'], description: 'Start AWS cluster', options: [{param:'prod', description:'Production cluster'}] },
        { params: ['stop-cluster'], description: 'Stop AWS cluster', options: [{param:'prod', description:'Production cluster'}] },
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
