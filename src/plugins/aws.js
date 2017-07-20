'use strict'; // JS: ES6

// ******************************
// Requries:
// ******************************

let cprint = require('color-print');

let aws = require('../utils/aws');
let docker = require('../utils/docker');
let print = require('../utils/print');

// ******************************
// Functions:
// ******************************

function printAwsServiceInfo (in_serviceConfig, in_prod) {
    let serviceConfig = in_serviceConfig || {};
    let serviceConfigService = serviceConfig.service || {};

    let serviceName = serviceConfigService.name;
    if (!serviceName) {
        cprint.yellow('No service name set');
        return false;
    }

    cprint.magenta('-- AWS Service State --');
    print.keyVal('Service Name', serviceName);

    print.keyVal('Service Test Cluster', '...', true);
    let testClusterState = _getAwsClusterState(in_serviceConfig, 'test');
    print.keyVal('\rService Test Cluster', testClusterState + ' '.repeat(10));

    if (in_prod) {
        print.keyVal('Service Prod Cluster', '...', true);
        let prodClusterState = _getAwsClusterState(in_serviceConfig, 'prod');
        print.keyVal('\rService Prod Cluster', prodClusterState + ' '.repeat(10));
    }

    cprint.magenta('----');
}

// ******************************

function awsLogin (in_serviceConfig) {
    aws.login(in_serviceConfig);
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
    let command = in_params.length ? in_params.shift() : '';
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

        case 'setup':
        case 'login':
            awsLogin(in_serviceConfig);
            break;

        case 'docker-login':
            awsDockerLogin(in_serviceConfig);
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
        { params: ['setup', 'login'], description: 'Setup AWS login information' },
        { params: ['docker-login'], description: 'Log into AWS docker repository' },
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
