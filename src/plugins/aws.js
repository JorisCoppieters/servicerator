'use strict'; // JS: ES6

// ******************************
// Requires:
// ******************************

let cprint = require('color-print');

let aws = require('../utils/aws');
let docker = require('../utils/docker');
let init = require('../utils/init');
let print = require('../utils/print');
let service = require('../utils/service');
let str = require('../utils/string');

// ******************************
// Functions:
// ******************************

function printAwsServiceInfo (in_serviceConfig, in_prod) {
    let serviceConfig = _getAwsServiceConfig(in_serviceConfig);
    let serviceConfigService = serviceConfig.service || {};
    let serviceConfigAws = serviceConfig.aws || {};

    let serviceName = serviceConfigService.name || false;

    let awsAccessKey = serviceConfigAws.access_key || false;
    let awsSecretKey = false;
    if (awsAccessKey) {
        awsSecretKey = aws.getSecretKey(serviceConfig);
    }

    let awsAccountId = serviceConfigAws.account_id || false;

    cprint.magenta('-- AWS --');
    print.keyVal('AWS Account Id', awsAccountId || '(Not Set)');
    print.keyVal('AWS Access Key', awsAccessKey || '(Not Set)');
    print.keyVal('AWS Secret Key', awsSecretKey ? '*******' : '(Not Set)');
    print.out('\n');

    if (awsAccessKey && awsSecretKey) {
        let environments = ['test'];
        if (in_prod) {
            environments.push('prod');
        }

        if (serviceName) {
            cprint.magenta('-- AWS Clusters State --');

            environments.forEach(environment => {
                let autoScalingGroupName = _getAutoScalingGroupNameForService(serviceName, environment);
                let awsClusterName = _getClusterNameForService(serviceName, environment);
                let awsClusterServiceName = _getClusterServiceNameForService(serviceName, environment);
                let awsTaskDefinitionName = _getTaskDefinitionNameForService(serviceName);

                print.keyVal('AWS ' + str.toTitleCase(environment) + ' Cluster Name', awsClusterName);
                print.keyVal('AWS ' + str.toTitleCase(environment) + ' Cluster Service Name', awsClusterServiceName);

                print.keyVal('AWS ' + str.toTitleCase(environment) + ' Cluster Service State', '...', true);
                let autoScalingGroupInstanceCount = _getAutoScalingGroupInstanceCount(autoScalingGroupName);
                print.clearLine();

                if (autoScalingGroupInstanceCount) {
                    let serviceState = _getServiceStateFromAutoScalingGroupInstanceCount(autoScalingGroupInstanceCount);
                    print.keyVal('AWS ' + str.toTitleCase(environment) + ' Cluster Service State', serviceState);
                } else {
                    print.keyVal('AWS ' + str.toTitleCase(environment) + ' Cluster Service State', '???');
                }

                print.keyVal('AWS ' + str.toTitleCase(environment) + ' Cluster Service ARN', '...', true);
                let awsClusterServiceArn = _getClusterServiceArnForCluster(awsClusterName);
                print.clearLine();

                if (awsClusterServiceArn) {
                    print.keyVal('AWS ' + str.toTitleCase(environment) + ' Cluster Service ARN', awsClusterServiceArn);
                } else {
                    print.keyVal('AWS ' + str.toTitleCase(environment) + ' Cluster Service ARN', '???');
                }

                print.keyVal('AWS ' + str.toTitleCase(environment) + ' Cluster Task ARNs', '...', true);
                let awsClusterTaskArns = _getClusterTaskArnsForCluster(awsClusterName);
                print.clearLine();

                if (awsClusterTaskArns) {
                    print.keyVal('AWS ' + str.toTitleCase(environment) + ' Cluster Task ARNs', JSON.stringify(awsClusterTaskArns, null, 4));
                } else {
                    print.keyVal('AWS ' + str.toTitleCase(environment) + ' Cluster Task ARNs', '???');
                }
            });

            print.out('\n');
        }

        cprint.magenta('-- AWS Network --');

        environments.forEach(environment => {
            let vpcName = _getVpcNameForEnvironment(environment);
            print.keyVal('AWS ' + str.toTitleCase(environment) + ' VPC Name', vpcName);

            print.keyVal('AWS ' + str.toTitleCase(environment) + ' VPC Id', '...', true);
            let vpcId = _getVpcIdForVpc(vpcName);
            print.clearLine();

            if (vpcId) {
                print.keyVal('AWS ' + str.toTitleCase(environment) + ' VPC Id', vpcId);
            } else {
                print.keyVal('AWS ' + str.toTitleCase(environment) + ' VPC Id', '???');
            }

            print.keyVal('AWS ' + str.toTitleCase(environment) + ' VPC Security Group Id', '...', true);
            let vpcSecurityGroupId = _getVpcSecurityGroupIdForVpc(vpcId);
            print.clearLine();

            if (vpcSecurityGroupId) {
                print.keyVal('AWS ' + str.toTitleCase(environment) + ' VPC Security Group Id', vpcSecurityGroupId);
            } else {
                print.keyVal('AWS ' + str.toTitleCase(environment) + ' VPC Security Group Id', '???');
            }

            let vpcSubnetName = _getVpcSubnetNameForEnvironment(environment);
            print.keyVal('AWS ' + str.toTitleCase(environment) + ' VPC Subnet Name', vpcSubnetName);

            print.keyVal('AWS ' + str.toTitleCase(environment) + ' VPC Subnet Id', '...', true);
            let vpcSubnetId = _getVpcSubnetIdForVpc(vpcId, vpcSubnetName);
            print.clearLine();

            if (vpcSubnetId) {
                print.keyVal('AWS ' + str.toTitleCase(environment) + ' VPC Subnet Id', vpcSubnetId);
            } else {
                print.keyVal('AWS ' + str.toTitleCase(environment) + ' VPC Subnet Id', '???');
            }
        });

        print.out('\n');
    }

    cprint.magenta('----');
}

// ******************************

function awsDeploy (in_serviceConfig, in_prod) {
    let serviceConfig = _getAwsServiceConfig(in_serviceConfig);
    let serviceConfigDocker = serviceConfig.docker || {};
    let serviceConfigDockerImage = serviceConfigDocker.image || {};
    let serviceConfigService = serviceConfig.service || {};
    let serviceConfigServiceCluster = serviceConfigService.cluster || {};
    let serviceConfigServiceClusterInstance = serviceConfigServiceCluster.instance || {};

    let serviceName = serviceConfigService.name;

    let dockerImageName = serviceConfigDockerImage.name || 'image';
    let dockerImageVersion = serviceConfigDockerImage.version || '1.0.0';

    let environment = (in_prod) ? 'prod' : 'test';
    let awsDockerRepository = aws.getDockerRepository(in_serviceConfig);
    let awsTaskDefinitionImagePath = awsDockerRepository + '/' + dockerImageName + ':' + dockerImageVersion;
    let awsTaskDefinitionName = _getTaskDefinitionNameForService(serviceName);
    let awsClusterName = _getClusterNameForService(serviceName, environment);
    let awsClusterServiceName = _getClusterServiceNameForService(serviceName, environment);
    let awsClusterServiceInstanceCount = serviceConfigServiceClusterInstance.count || 1;

    cprint.magenta('-- Deploy --');
    print.keyVal('AWS Task Definition Name', awsTaskDefinitionName);
    print.keyVal('AWS Task Definition Image Path', awsTaskDefinitionImagePath);

    print.keyVal('AWS Task Definition ARN', '...', true);
    let taskDefinitionArn = _getTaskDefinitionArnForTaskDefinition(awsTaskDefinitionName);
    if (!taskDefinitionArn) {
        return;
    }
    print.clearLine();
    print.keyVal('AWS Task Definition ARN', taskDefinitionArn);

    print.keyVal('AWS ' + str.toTitleCase(environment) + ' Cluster Name', awsClusterName);
    print.keyVal('AWS ' + str.toTitleCase(environment) + ' Cluster Service Name', awsClusterServiceName);
    print.keyVal('AWS ' + str.toTitleCase(environment) + ' Cluster Service Instance Count', awsClusterServiceInstanceCount);

    print.keyVal('AWS ' + str.toTitleCase(environment) + ' Cluster Task ARNs', '...', true);
    let awsClusterTaskArns = _getClusterTaskArnsForCluster(awsClusterName);
    if (!awsClusterTaskArns) {
        return;
    }
    print.clearLine();
    print.keyVal('AWS ' + str.toTitleCase(environment) + ' Cluster Task ARNs', JSON.stringify(awsClusterTaskArns, null, 4));

    print.keyVal('AWS ' + str.toTitleCase(environment) + ' Cluster Service ARN', '...', true);
    let awsClusterServiceArn = _getClusterServiceArnForCluster(awsClusterName);
    if (!awsClusterServiceArn) {
        return;
    }
    print.clearLine();
    print.keyVal('AWS ' + str.toTitleCase(environment) + ' Cluster Service ARN', awsClusterServiceArn);

    awsClusterTaskArns.forEach(t => {
        _stopClusterTask(awsClusterName, t)
    });

    _deployTaskDefinitionToCluster(awsClusterName, awsClusterServiceArn, taskDefinitionArn, awsClusterServiceInstanceCount);
}

// ******************************

function awsCreateTaskDefinition (in_serviceConfig) {
    let serviceConfig = _getAwsServiceConfig(in_serviceConfig);
    let serviceConfigService = serviceConfig.service || {};
    let serviceConfigDocker = serviceConfig.docker || {};
    let serviceConfigDockerImage = serviceConfigDocker.image || {};
    let serviceConfigDockerContainer = serviceConfigDocker.container || {};
    let serviceConfigDockerContainerPorts = serviceConfigDockerContainer.ports || [];
    let serviceConfigDockerContainerVolumes = serviceConfigDockerContainer.volumes || [];
    let serviceConfigDockerContainerCommands = serviceConfigDockerContainer.commands || [];
    let sourceFolder = serviceConfig.cwd || false;

    let dockerFolder = docker.getFolder(sourceFolder);

    let serviceName = serviceConfigService.name;
    if (!serviceName) {
        cprint.yellow('No service name set');
        return false;
    }

    let dockerImageName = serviceConfigDockerImage.name || 'image';
    let dockerImageVersion = serviceConfigDockerImage.version || '1.0.0';

    let awsDockerRepository = aws.getDockerRepository(in_serviceConfig);

    let awsTaskDefinitionImagePath = awsDockerRepository + '/' + dockerImageName + ':' + dockerImageVersion;
    let awsTaskDefinitionName = serviceName + '-task-definition';
    let awsTaskDefinitionMemoryLimit = serviceConfigDockerContainer.memory_limit || 500;

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

    serviceConfigDockerContainerCommands.forEach(command => {
        if (command.env === 'prod') {
            serviceContainerDefinition.command = command.val
                .split(' ')
            return;
        }
    });

    serviceConfigDockerContainerPorts.forEach(port => {
        if (!port.host || !port.container) {
            return;
        }
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

    serviceConfigDockerContainerVolumes.forEach(volume => {
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

    let serviceConfigDockerContainerHosts = {};
    serviceConfigDockerContainerVolumes
        .concat(awsTaskDefinitionFilebeatVolumes)
        .forEach(volume => {
            let volumeName = service.replaceServiceConfigReferences(in_serviceConfig, volume.name || volume.host);
            serviceConfigDockerContainerHosts[volumeName] = volume;
        });


    Object.keys(serviceConfigDockerContainerHosts)
        .forEach(host => {
            let volume = serviceConfigDockerContainerHosts[host];
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
    }
}

// ******************************

function awsCreateLaunchConfiguration (in_serviceConfig, in_prod) {
    let serviceConfig = _getAwsServiceConfig(in_serviceConfig);
    let serviceConfigService = serviceConfig.service || {};
    let serviceConfigDocker = serviceConfig.docker || {};
    let serviceConfigDockerImage = serviceConfigDocker.image || {};
    let serviceConfigDockerContainer = serviceConfigDocker.container || {};
    let serviceConfigDockerContainerPorts = serviceConfigDockerContainer.ports || [];
    let serviceConfigDockerContainerVolumes = serviceConfigDockerContainer.volumes || [];
    let serviceConfigDockerContainerCommands = serviceConfigDockerContainer.commands || [];
    let sourceFolder = serviceConfig.cwd || false;

    let dockerFolder = docker.getFolder(sourceFolder);

    let serviceName = serviceConfigService.name;
    if (!serviceName) {
        cprint.yellow('No service name set');
        return false;
    }

    let environment = (in_prod) ? 'prod' : 'test';

    cprint.magenta('-- Launch Configuration --');

    let vpcName = _getVpcNameForEnvironment(environment);
    print.keyVal('AWS ' + str.toTitleCase(environment) + ' VPC Name', vpcName);

    print.keyVal('AWS ' + str.toTitleCase(environment) + ' VPC Id', '...', true);
    let vpcId = _getVpcIdForVpc(vpcName);
    if (!vpcId) {
        return;
    }
    print.clearLine();
    print.keyVal('AWS ' + str.toTitleCase(environment) + ' VPC Id', vpcId);

    print.keyVal('AWS ' + str.toTitleCase(environment) + ' VPC Security Group Id', '...', true);
    let vpcSecurityGroupId = _getVpcSecurityGroupIdForVpc(vpcId);
    if (!vpcSecurityGroupId) {
        return;
    }
    print.clearLine();
    print.keyVal('AWS ' + str.toTitleCase(environment) + ' VPC Security Group Id', vpcSecurityGroupId);

    let vpcSubnetName = _getVpcSubnetNameForEnvironment(environment);
    print.keyVal('AWS ' + str.toTitleCase(environment) + ' VPC Subnet Name', vpcSubnetName);

    print.keyVal('AWS ' + str.toTitleCase(environment) + ' VPC Subnet Id', '...', true);
    let vpcSubnetId = _getVpcSubnetIdForVpc(vpcId, vpcSubnetName);
    if (!vpcSubnetId) {
        return;
    }
    print.clearLine();
    print.keyVal('AWS ' + str.toTitleCase(environment) + ' VPC Subnet Id', vpcSubnetId);

    // TODO - launch configurations
/*
        SECURITY_GROUPS=$AWS_VPC_SECURITY_GROUP_ID;

        USER_DATA="";
        USER_DATA=$USER_DATA"#!/bin/bash\n";
        USER_DATA=$USER_DATA"\n";
        USER_DATA=$USER_DATA"echo ECS_CLUSTER=$AWS_SERVICE_CLUSTER_NAME > /etc/ecs/ecs.config\n";
        USER_DATA=$USER_DATA"\n";
        USER_DATA=$USER_DATA"# Create tm-services environment script.\n";
        USER_DATA=$USER_DATA"mkdir -p /etc/tm-services && touch /etc/tm-services/env.sh && chmod +x /etc/tm-services/env.sh;\n";
        USER_DATA=$USER_DATA"echo \"export ENV_TYPE=$AWS_SERVICE_ENVIRONMENT;\" >> /etc/tm-services/env.sh\n";
        USER_DATA=$USER_DATA"echo \"export HOSTNAME=\\\"\`hostname\`\\\";\" >> /etc/tm-services/env.sh\n";

        ENCODED_USER_DATA=`echo -e -n $USER_DATA`;

        AWS_CREATE_LAUNCH_CONFIGURATION_RESULT=`
            aws autoscaling create-launch-configuration \
                --launch-configuration-name="$AWS_SERVICE_LAUNCH_CONFIGURATION_NAME" \
                --security-groups="$SECURITY_GROUPS" \
                --key-name="$AWS_KEY_NAME" \
                --instance-type="$AWS_SERVICE_INSTANCE_TYPE" \
                --iam-instance-profile="$AWS_SERVICE_IAM_ROLE" \
                --instance-monitoring="{\"Enabled\": false}" \
                --image-id="$AWS_ECS_OPTIMIZED_AMI" \
                --block-device-mappings="[ \
                    { \
                        \"DeviceName\": \"/dev/xvdcz\", \
                        \"Ebs\": { \
                            \"DeleteOnTermination\": true, \
                            \"Encrypted\": false, \
                            \"VolumeSize\": 22, \
                            \"VolumeType\": \"gp2\" \
                        } \
                    }, \
                    { \
                        \"DeviceName\": \"/dev/xvda\", \
                        \"Ebs\": { \
                            \"DeleteOnTermination\": true, \
                            \"SnapshotId\": \"$AWS_ECS_OPTIMIZED_SNAPSHOT_ID\", \
                            \"VolumeSize\": $AWS_SERVICE_INSTANCE_VOLUME_SIZE, \
                            \"VolumeType\": \"gp2\" \
                        } \
                    } \
                ]" \
                --user-data="$ENCODED_USER_DATA" \
            2>&1`;

        if [[ "$AWS_CREATE_LAUNCH_CONFIGURATION_RESULT" != '' ]]; then
            printRed "> Failed to create launch configuration for the service '"$AWS_SERVICE_NAME"'";
            echo -n "$AWS_CREATE_LAUNCH_CONFIGURATION_RESULT";
            exit;
        fi

        AWS_SERVICE_LAUNCH_CONFIGURATION_ARN=`
            aws autoscaling describe-launch-configurations \
                --launch-configuration-name $AWS_SERVICE_LAUNCH_CONFIGURATION_NAME | jq -r '.LaunchConfigurations[0]'`;

        if [[ "$AWS_SERVICE_LAUNCH_CONFIGURATION_ARN" == '{'*'}' ]]; then
            printGreen "> Launch configuration created succesfully for the service '"$AWS_SERVICE_NAME"'";
        fi
    fi
*/
}

// ******************************

function awsDockerLogin (in_serviceConfig) {
    let serviceConfig = _getAwsServiceConfig(in_serviceConfig);

    let awsDockerCredentials = aws.getDockerCredentials(serviceConfig);
    serviceConfig = init.updateServiceConfig(serviceConfig, {
        aws: {
            account_id: awsDockerCredentials.account_id,
            region: awsDockerCredentials.region
        }
    });

    let awsDockerRepository = aws.getDockerRepository(serviceConfig);
    docker.login(awsDockerCredentials.username, awsDockerCredentials.password, awsDockerRepository);
}

// ******************************

function awsStartCluster (in_serviceConfig, in_prod) {
    let serviceConfig = _getAwsServiceConfig(in_serviceConfig);
    let serviceConfigService = serviceConfig.service || {};

    let serviceName = serviceConfigService.name;
    if (!serviceName) {
        cprint.yellow('No service name set');
        return false;
    }

    let environment = (in_prod) ? 'prod' : 'test';

    let autoScalingGroupName = _getAutoScalingGroupNameForService(serviceName, environment);
    let autoScalingGroupInstanceCount = _getAutoScalingGroupInstanceCount(autoScalingGroupName);
    if (autoScalingGroupInstanceCount < 0) {
        cprint.yellow('AWS cluster doesn\'t exist');
        return;
    }

    if (autoScalingGroupInstanceCount == 0) {
        cprint.cyan('Starting AWS cluster...');
        _setAutoScalingGroupInstanceCount(autoScalingGroupName, 2);
    } else {
        cprint.green('AWS cluster already started');
    }
}

// ******************************

function awsStopCluster (in_serviceConfig, in_prod) {
    let serviceConfig = _getAwsServiceConfig(in_serviceConfig);
    let serviceConfigService = serviceConfig.service || {};

    let serviceName = serviceConfigService.name;
    if (!serviceName) {
        cprint.yellow('No service name set');
        return false;
    }

    let environment = (in_prod) ? 'prod' : 'test';

    let autoScalingGroupName = _getAutoScalingGroupNameForService(serviceName, environment);
    let autoScalingGroupInstanceCount = _getAutoScalingGroupInstanceCount(autoScalingGroupName);
    if (autoScalingGroupInstanceCount < 0) {
        cprint.yellow('AWS cluster doesn\'t exist');
        return;
    }

    if (autoScalingGroupInstanceCount > 0) {
        cprint.cyan('Stopping AWS cluster...');
        _setAutoScalingGroupInstanceCount(autoScalingGroupName, 0);
    } else {
        cprint.green('AWS cluster already stopped');
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

function _setAutoScalingGroupInstanceCount (in_autoScalingGroupName, in_autoScalingGroupInstanceCount) {
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
    return true;
}

// ******************************

function _getAutoScalingGroupInstanceCount (in_autoScalingGroupName, in_verbose) {
    if (in_verbose) {
        cprint.cyan('Retrieving Instance Count for AWS Auto Scaling Group "' + in_autoScalingGroupName + '"...');
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

    if (!desiredCapacity) {
        cprint.yellow('Couldn\'t find Instance Count for AWS Auto Scaling Group "' + in_autoScalingGroupName + '"');
        return;
    }

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

function _getClusterServiceArnForCluster (in_clusterName, in_verbose) {
    if (in_verbose) {
        cprint.cyan('Retrieving AWS Cluster Service ARN for AWS Cluster "' + in_clusterName + '"...');
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

    return awsClusterServiceArn;
}

// ******************************

function _getClusterTaskArnsForCluster (in_clusterName, in_verbose) {
    if (in_verbose) {
        cprint.cyan('Retrieving AWS Cluster Task ARNs for AWS Cluster "' + in_clusterName + '"...');
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

    return awsClusterTaskArns;
}

// ******************************

function _getVpcNameForEnvironment (in_environment) {
    // TODO - remove TM specific naming
    let environment = in_environment || 'test';
    return 'tm-' + environment + '-vpc';
}

// ******************************

function _getVpcIdForVpc (in_vpcName, in_verbose) {
    if (in_verbose) {
        cprint.cyan('Retrieving AWS VPC ID for AWS VPC Name "' + in_vpcName + '"...');
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

    return awsVpcId;
}

// ******************************

function _getVpcSecurityGroupIdForVpc (in_vpcId, in_verbose) {
    if (in_verbose) {
        cprint.cyan('Retrieving AWS Security Group Id for AWS VPC Id "' + in_vpcId + '"...');
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

    return awsVpcSecurityGroupId;
}

// ******************************

function _getVpcSubnetNameForEnvironment (in_environment) {
    // TODO - remove TM specific naming
    let environment = in_environment || 'test';
    if (environment === 'prod') {
        return 'tm-' + environment + '-vpc-public-b';
    } else {
        return 'tm-' + environment + '-vpc-public-a';
    }
}

// ******************************

function _getVpcSubnetIdForVpc (in_vpcId, in_vpcSubnetName, in_verbose) {
    if (in_verbose) {
        cprint.cyan('Retrieving AWS VPC Subnet Id for AWS VPC Subnet Name "' + in_vpcSubnetName + '"...');
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

    return awsVpcSubnetId;
}

// ******************************

function _getTaskDefinitionArnForTaskDefinition (in_taskDefinitionName, in_verbose) {
    if (in_verbose) {
        cprint.cyan('Retrieving AWS Task Definition ARN for AWS Task Definition "' + in_taskDefinitionName + '"...');
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

    return latestTaskDefinitionArn;
}

// ******************************

function _getAutoScalingGroupNameForService (in_serviceName, in_environment) {
    let serviceName = in_serviceName || 'service';
    let environment = in_environment || 'test';
    return serviceName + '-' + environment + '-auto-scaling-group';
}

// ******************************

function _getTaskDefinitionNameForService (in_serviceName) {
    let serviceName = in_serviceName || 'service';
    return serviceName + '-task-definition';
}

// ******************************

function _getClusterNameForService (in_serviceName, in_environment) {
    let serviceName = in_serviceName || 'service';
    let environment = in_environment || 'test';
    return serviceName + '-' + environment + '-cluster';
}

// ******************************

function _getClusterServiceNameForService (in_serviceName, in_environment) {
    let serviceName = in_serviceName || 'service';
    let environment = in_environment || 'test';
    return serviceName + '-' + environment + '-service';
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
            printAwsServiceInfo(in_serviceConfig, prod);
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
        { params: ['', 'info', 'state', 'service'], description: 'Print AWS state information', options: [{param:'prod', description:'Include production information'}] },
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
