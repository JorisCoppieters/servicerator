'use strict'; // JS: ES6

// ******************************
// Requries:
// ******************************

let aws = require('../utils/aws');
let docker = require('../utils/docker');

// ******************************
// Functions:
// ******************************

function handleCommand (in_args, in_params, in_serviceConfig) {
    let command = in_params.length ? in_params.shift() : '';
    switch(command)
    {
        case '':
        case 'setup':
        case 'login':
            awsLogin(in_serviceConfig);
            break;

        case 'docker-login':
            awsDockerLogin(in_serviceConfig);
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
        { params: ['', 'setup', 'login'], description: 'Setup AWS login information' },
        { params: ['docker-login'], description: 'Log into AWS docker repository' }
    ];
}

// ******************************

function getTitle () {
    return 'AWS';
}

// ******************************

function awsLogin (in_serviceConfig) {
    aws.login(in_serviceConfig);
}

// ******************************

function awsDockerLogin (in_serviceConfig) {
    let awsDockerCredentials = aws.getDockerCredentials(in_serviceConfig);
    docker.login(awsDockerCredentials.username, awsDockerCredentials.password);
}

// ******************************
// Exports:
// ******************************

module.exports['handleCommand'] = handleCommand;
module.exports['getBaseCommands'] = getBaseCommands;
module.exports['getCommands'] = getCommands;
module.exports['getTitle'] = getTitle;

// ******************************
