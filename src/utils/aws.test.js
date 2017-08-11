'use strict'; // JS: ES6

// ******************************
// Requires:
// ******************************

let path = require('path');
let cprint = require('color-print');

let date = require('./date');
let aws = require('./aws');
let env = require('./env');
let fs = require('./filesystem');
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
    test.assertMatch('aws basic command', '{[\\s\\S]+"clusterArns"[\\s\\S]+}', aws.cmd(['ecs', 'list-clusters']));
}

// ******************************
// Exports:
// ******************************

module.exports['runTests'] = runTests;

// ******************************
