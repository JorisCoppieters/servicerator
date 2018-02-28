'use strict'; // JS: ES6

// ******************************
// Requires:
// ******************************

let cprint = require('color-print');

let aws = require('./aws');
let test = require('./test');

// ******************************
// Functions:
// ******************************

// arnToTitle
// clearCachedAutoScalingGroupInstanceCount
// clearCachedTaskDefinitionArnForTaskDefinition
// cmd
// createCluster
// createClusterService
// createDockerRepository
// deployTaskDefinitionToCluster
// deregisterTaskDefinition
// getAutoScalingGroupInstanceCount
// getDockerCredentials
// getDockerRepositoryUrl
// getRepositoryServiceConfig
// getSecretKey
// getServiceConfig
// getClusterArnForClusterName
// getClusterServiceArnForClusterName
// getClusterTaskArnsForCluster
// getDockerRepositoryForDockerImageName
// getInstanceIdsWithTags
// getLatestTaskDefinitionArnForTaskDefinition
// getMergedServiceConfig
// getPreviousTaskDefinitionArnsForTaskDefinition
// getServiceStateFromAutoScalingGroupInstanceCount
// getTaskDefinitionArnForClusterService
// getVpcIdForVpc
// getVpcSecurityGroupIdForVpc
// getVpcSubnetIdForVpc
// installed
// login
// parseCmdResult
// setAutoScalingGroupInstanceCount
// stopClusterTask
// version

function runTests () {
    cprint.magenta('Running aws util tests...');
    test.assertMatch('aws ecs list-clusters', '{[\\s\\S]+"clusterArns"[\\s\\S]+}', aws.cmd(['ecs', 'list-clusters']));
}

// ******************************
// Exports:
// ******************************

module.exports['runTests'] = runTests;

// ******************************
