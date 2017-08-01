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
    let serviceConfig = in_serviceConfig || {};
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

    cprint.magenta('-- AWS Service --');
    print.keyVal('AWS Service Name', serviceName || '(Not Set)');
    print.out('\n');

    if (awsAccessKey && awsSecretKey && serviceName) {
        cprint.magenta('-- AWS Clusters State --');
        print.keyVal('AWS Service Test Cluster', '...', true);
        let testClusterState = _getAwsClusterState(in_serviceConfig, 'test');
        print.keyVal('\rAWS Service Test Cluster', testClusterState + ' '.repeat(10));

        if (in_prod) {
            print.keyVal('AWS Service Prod Cluster', '...', true);
            let prodClusterState = _getAwsClusterState(in_serviceConfig, 'prod');
            print.keyVal('\rAWS Service Prod Cluster', prodClusterState + ' '.repeat(10));
        }
        print.out('\n');
    }

    cprint.magenta('----');
}

// ******************************

function awsLogin (in_serviceConfig) {
    aws.login(in_serviceConfig);
}

// ******************************

function awsDeploy (in_serviceConfig) {
    let serviceConfig = in_serviceConfig || {};
    let serviceConfigDocker = serviceConfig.docker || {};
    let serviceConfigDockerImage = serviceConfigDocker.image || {};
    let serviceConfigService = serviceConfig.service || {};
    let serviceConfigServiceCluster = serviceConfigService.cluster || {};
    let serviceConfigServiceClusterInstance = serviceConfigServiceCluster.instance || {};

    let serviceName = serviceConfigService.name;

    let dockerImageName = serviceConfigDockerImage.name || 'image';
    let dockerImageVersion = serviceConfigDockerImage.version || '1.0.0';

    let awsClustersViewUrl = "https://ap-southeast-2.console.aws.amazon.com/ecs/home?region=ap-southeast-2#/clusters";

    let awsDockerRepository = aws.getDockerRepository(in_serviceConfig);
    let awsTaskDefinitionImagePath = awsDockerRepository + '/' + dockerImageName + ':' + dockerImageVersion;
    let awsTaskDefinitionName = serviceName + '-task-definition';
    let awsClusterName = serviceName + '-test-cluster';
    let awsServiceName = serviceName + '-test-service';
    let awsServiceInstanceCount = serviceConfigServiceClusterInstance.count || 1;

    let cmdResult = aws.cmd([
        'ecs',
        'list-task-definitions'
    ]);

    if (cmdResult.hasError) {
        cmdResult.printError('  ');
        return;
    }

    let latestTaskDefinitionArn;

    let awsResult = _parseCmdResult(cmdResult);
    if (awsResult && awsResult.taskDefinitionArns) {
        latestTaskDefinitionArn = awsResult.taskDefinitionArns
            .filter(a => a.match(awsTaskDefinitionName))
            .sort()
            .reverse()
            .find(a => true);
    }

    if (!latestTaskDefinitionArn) {
        cprint.yellow('Couldn\'t find latest task definition for "' + serviceName + '"');
        return;
    }

    cprint.cyan('Retrieving running test cluster task...');

    cmdResult = aws.cmd([
        'ecs',
        'list-tasks',
        '--cluster',
        awsClusterName
    ]);

    if (cmdResult.hasError) {
        cmdResult.printError('  ');
        return;
    }

    awsResult = _parseCmdResult(cmdResult);

    let awsClusterTasks = (awsResult || {}).taskArns;
    if (!awsClusterTasks) {
        cprint.yellow('Couldn\'t find test cluster tasks for "' + serviceName + '"');
        return;
    }

    cprint.cyan('Retrieving test cluster service...');

    cmdResult = aws.cmd([
        'ecs',
        'list-services',
        '--cluster',
        awsClusterName
    ]);

    if (cmdResult.hasError) {
        cmdResult.printError('  ');
        return;
    }

    let awsServiceArn;

    awsResult = _parseCmdResult(cmdResult);
    if (awsResult && awsResult.serviceArns) {
        awsServiceArn = awsResult.serviceArns
            .find(a => true);
    }

    if (!awsServiceArn) {
        cprint.yellow('Couldn\'t find test cluster service for "' + serviceName + '"');
        return;
    }

    cprint.yellow('Stopping existing cluster task...');

    awsClusterTasks.forEach(t => {
        cmdResult = aws.cmd([
            'ecs',
            'stop-task',
            '--task',
            t,
            '--cluster',
            awsClusterName
        ]);

        if (cmdResult.hasError) {
            cmdResult.printError('  ');
        } else {
            cmdResult.printResult('  ');
        }
    });

    cprint.cyan('Deploying latest task definition to test cluster...')

    cmdResult = aws.cmd([
        'ecs',
        'update-service',
        '--service',
        awsServiceArn,
        '--task-definition',
        latestTaskDefinitionArn,
        '--cluster',
        awsClusterName,
        '--desired-count',
        awsServiceInstanceCount
    ]);

    if (cmdResult.hasError) {
        cmdResult.printError('  ');
    } else {
        cmdResult.printResult('  ');
    }

    /*



            printCyan "Retrieving cluster task service name for service '"$AWS_SERVICE_NAME"'...";
            AWS_SERVICE_TEST_CLUSTER_TASK_SERVICE_ARN=`aws ecs list-services --cluster $AWS_SERVICE_TEST_CLUSTER_NAME | jq -r '.serviceArns[0]'`;
            if [[ "$AWS_SERVICE_TEST_CLUSTER_TASK_SERVICE_ARN" != 'arn'* ]]; then
                printYellow "AWS cluster task service isn't set up: $AWS_SERVICE_TEST_CLUSTER_NAME";
            fi

            if [[ "$AWS_SERVICE_TEST_CLUSTER_TASK_SERVICE_ARN" == 'arn'* ]]; then

                printCyan "Updating cluster service '"$AWS_SERVICE_TEST_CLUSTER_NAME"' with new task...";

                AWS_UPDATE_CLUSTER_SERVICE_RESULTS=`
                    aws ecs update-service \
                        --service $AWS_SERVICE_TEST_CLUSTER_TASK_SERVICE_ARN \
                        --task-definition $AWS_TASK_DEFINITION_ARN \
                        --cluster $AWS_SERVICE_TEST_CLUSTER_ARN \
                        --desired-count $AWS_SERVICE_INSTANCE_COUNT`;

                if [[ $AWS_UPDATE_CLUSTER_SERVICE_RESULTS != *'{'*'taskDefinition'*'}'* ]]; then
                    printRed "Updating cluster service failed:";
                    printRed "$AWS_UPDATE_CLUSTER_SERVICE_RESULTS";
                    exit;
                fi

                printGreen "Open $AWS_CLUSTERS_VIEW_URL";
            fi
        fi

    */
}

// ******************************

function awsCreateTaskDefinition (in_serviceConfig) {
    let serviceConfig = in_serviceConfig || {};
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

function awsConfigure (in_serviceConfig) {
    let serviceConfig = in_serviceConfig || {};

    let awsServiceConfig = aws.getServiceConfig();
    service.copyConfig(awsServiceConfig, serviceConfig);

    let awsRepositoryServiceConfig = aws.getRepositoryServiceConfig();
    service.copyConfig(awsRepositoryServiceConfig, serviceConfig);

    init.saveServiceConfig(serviceConfig);
}

// ******************************

function awsDockerLogin (in_serviceConfig) {
    let awsDockerCredentials = aws.getDockerCredentials(in_serviceConfig);
    let awsDockerRepository = aws.getDockerRepository(in_serviceConfig);
    docker.login(awsDockerCredentials.username, awsDockerCredentials.password, awsDockerRepository);
}

// ******************************

function awsStartCluster (in_serviceConfig, in_prod) {
    let environment = (in_prod) ? 'prod' : 'test';
    let desiredCapacity = _getAwsClusterCapacity(in_serviceConfig, environment);
    if (desiredCapacity < 0) {
        cprint.yellow('AWS cluster doesn\'t exist');
        return;
    }
    if (desiredCapacity == 0) {
        cprint.cyan('Starting AWS cluster...');
        _setAwsClusterCapacity(in_serviceConfig, environment, 2);
    } else {
        cprint.green('AWS cluster already started');
    }
}

// ******************************

function awsStopCluster (in_serviceConfig, in_prod) {
    let environment = (in_prod) ? 'prod' : 'test';
    let desiredCapacity = _getAwsClusterCapacity(in_serviceConfig, environment);
    if (desiredCapacity < 0) {
        cprint.yellow('AWS cluster doesn\'t exist');
        return;
    }
    if (desiredCapacity > 0) {
        cprint.cyan('Stopping AWS cluster...');
        _setAwsClusterCapacity(in_serviceConfig, environment, 0);
    } else {
        cprint.green('AWS cluster already stopped');
    }
}

// ******************************
// Helper Functions:
// ******************************

function _getAwsClusterCapacity (in_serviceConfig, in_environment) {
    let serviceConfig = in_serviceConfig || {};
    let serviceConfigService = serviceConfig.service || {};

    let serviceName = serviceConfigService.name;
    if (!serviceName) {
        cprint.yellow('No service name set');
        return false;
    }

    let autoScalingGroupName = serviceName + '-' + in_environment + '-auto-scaling-group';
    let cmdResult = aws.cmd([
        'autoscaling',
        'describe-auto-scaling-groups',
        '--auto-scaling-group=' + autoScalingGroupName
    ], true);

    let desiredCapacity = -1;
    let autoScalingGroup = _parseCmdResult(cmdResult);
    if (autoScalingGroup && autoScalingGroup.AutoScalingGroups && autoScalingGroup.AutoScalingGroups.length) {
        try {
            desiredCapacity = autoScalingGroup.AutoScalingGroups[0].DesiredCapacity;
        } catch (e) { }
    }

    return desiredCapacity;
}

// ******************************

function _getAwsClusterState (in_serviceConfig, in_environment) {
    let desiredCapacity = _getAwsClusterCapacity(in_serviceConfig, in_environment);
    let testClusterState;

    if (desiredCapacity > 0) {
        testClusterState = 'Up';
    } else if (desiredCapacity === 0) {
        testClusterState = 'Down';
    } else {
        testClusterState = 'N/A';
    }

    return testClusterState;
}

// ******************************

function _setAwsClusterCapacity (in_serviceConfig, in_environment, in_capacity) {
    let serviceConfig = in_serviceConfig || {};
    let serviceConfigService = serviceConfig.service || {};

    let serviceName = serviceConfigService.name;
    if (!serviceName) {
        cprint.yellow('No service name set');
        return false;
    }

    let autoScalingGroupName = serviceName + '-' + in_environment + '-auto-scaling-group';
    let cmdResult = aws.cmd([
        'autoscaling',
        'update-auto-scaling-group',
        '--auto-scaling-group=' + autoScalingGroupName,
        '--desired-capacity=' + in_capacity,
        '--min-size=0'
    ]);
    if (cmdResult.hasError) {
        cmdResult.printError('  ');
    } else {
        cmdResult.printResult('  ');
    }
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

        case 'config':
        case 'configure':
            awsConfigure(in_serviceConfig);
            break;

        case 'setup':
        case 'login':
            awsLogin(in_serviceConfig);
            break;

        case 'docker-login':
            awsDockerLogin(in_serviceConfig);
            break;

        case 'create-task-definition':
            awsCreateTaskDefinition(in_serviceConfig);
            break;

        case 'deploy':
            awsDeploy(in_serviceConfig);
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
        { params: ['config', 'configure'], description: 'Configure AWS' },
        { params: ['setup', 'login'], description: 'Log into AWS' },
        { params: ['docker-login'], description: 'Log into AWS docker repository' },
        { params: ['create-task-definition'], description: 'Create task definition for service' },
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
