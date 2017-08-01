'use strict'; // JS: ES6

// ******************************
// Requires:
// ******************************

let path = require('path');
let cprint = require('color-print');

let ini = require('./ini');
let env = require('./env');
let exec = require('./exec');
let fs = require('./filesystem');

// ******************************
// Globals:
// ******************************

let g_AWS_CLI_INSTALLED = undefined;

// ******************************
// Functions:
// ******************************

function getAwsDockerRepository (in_serviceConfig) {
    let serviceConfig = in_serviceConfig || {};
    let serviceConfigAws = serviceConfig.aws || {};

    if (!serviceConfigAws.account_id) {
        cprint.yellow("AWS account id not set");
        return false;
    }

    let awsRegion = serviceConfigAws.region || 'ap-southeast-2';

    return serviceConfigAws.account_id + '.dkr.ecr.' + awsRegion + '.amazonaws.com';
}

// ******************************

function getAwsDockerCredentials (in_serviceConfig) {
    if (!awsInstalled()) {
        cprint.yellow('AWS-CLI isn\'t installed');
        return false;
    }

    let serviceConfig = in_serviceConfig || {};
    let serviceConfigAws = serviceConfig.aws || {};

    awsLogin(in_serviceConfig);

    let awsCmdResult = awsCmd(['ecr', 'get-login'], true);
    if (awsCmdResult.hasErrors) {
        return false;
    }

    let response = awsCmdResult.result;
    let responseRegExp = new RegExp('docker login -u (AWS) -p ([\\S]+)');
    let responseMatch = response.match(responseRegExp);
    if (!responseMatch || responseMatch.length !== 3) {
        return false;
    }

    return {
        username: responseMatch[1],
        password: responseMatch[2]
    };
}

// ******************************

function getAwsServiceConfig () {
    let serviceConfig = {};
    let homeFolder = env.getShellHome();

    serviceConfig.aws = serviceConfig.aws || {};

    let awsConfigFile = path.resolve(homeFolder, '.aws', 'config');
    let awsConfig = ini.parseFile(awsConfigFile);
    if (awsConfig.default && awsConfig.default.region) {
        serviceConfig.aws.region = awsConfig.default.region;
    }

    let awsCredentialsFile = path.resolve(homeFolder, '.aws', 'credentials');
    let awsCredentials = ini.parseFile(awsCredentialsFile);
    if (awsCredentials.default && awsCredentials.default.aws_access_key_id) {
        serviceConfig.aws.access_key = awsCredentials.default.aws_access_key_id;
    }

    return serviceConfig;
}

// ******************************

function getAwsRepositoryServiceConfig () {
    let serviceConfig = {};

    serviceConfig.docker = serviceConfig.docker || {};
    serviceConfig.docker.other_repositories = serviceConfig.docker.other_repositories || [];
    serviceConfig.docker.other_repositories.push({
        'type': 'AWS'
    });

    if (awsInstalled()) {
        let awsCmdResult = awsCmd(['sts', 'get-caller-identity'], true);
        if (!awsCmdResult.hasErrors) {
            serviceConfig.aws = serviceConfig.aws || {};
            let awsStats = JSON.parse(awsCmdResult.result);
            if (awsStats && awsStats.Account) {
                serviceConfig.aws.account_id = parseInt(awsStats.Account);
            }
        }
    }

    return serviceConfig;
}

// ******************************

function getAwsSecretKey (in_serviceConfig) {
    let serviceConfig = in_serviceConfig || {};
    let serviceConfigAws = serviceConfig.aws || {};

    if (!serviceConfigAws.access_key) {
        cprint.yellow("AWS access key not set");
        return false;
    }

    let awsAccessKey = serviceConfigAws.access_key;
    let awsSecretKey = serviceConfigAws.secret_key;

    if (!awsSecretKey) {
        awsSecretKey = env.getStoredSecretKey('aws', awsAccessKey);
    }

    if (!awsSecretKey) {
        awsSecretKey = env.getStoredSecretKey('aws', '');
    }

    return awsSecretKey;
}

// ******************************

function awsLogin (in_serviceConfig) {
    if (!awsInstalled()) {
        cprint.yellow('AWS-CLI isn\'t installed');
        return false;
    }

    let serviceConfig = in_serviceConfig || {};
    let serviceConfigAws = serviceConfig.aws || {};

    let awsAccessKey = serviceConfigAws.access_key;
    if (!awsAccessKey) {
        cprint.yellow("AWS access key not set");
        return false;
    }

    let awsSecretKey = getAwsSecretKey(in_serviceConfig);
    if (!awsSecretKey) {
        cprint.yellow("AWS secret key not set");
        return false;
    }

    let awsRegion = serviceConfigAws.region || 'ap-southeast-2';

    let awsFolder = path.resolve(env.getShellHome(), '.aws');
    if (!fs.folderExists(awsFolder)) {
        fs.createFolder(awsFolder);
    }

    let awsCredentialsFile = path.resolve(awsFolder, 'credentials');
    let awsConfigFile = path.resolve(awsFolder, 'config');

    cprint.cyan('Setting up AWS credentials...');

    fs.writeFile(awsCredentialsFile, [
        `[default]`,
        `aws_access_key_id = ${awsAccessKey}`,
        `aws_secret_access_key = ${awsSecretKey}`,
        ``
    ].join('\n'), true);

    fs.writeFile(awsConfigFile, [
        `[default]`,
        `region = ${awsRegion}`,
        ``
    ].join('\n'), true);
}

// ******************************

function awsCmd (in_args, in_hide) {
    if (!awsInstalled()) {
        cprint.yellow('AWS-CLI isn\'t installed');
        return false;
    }

    if (!in_args) {
        return false;
    }

    if (!Array.isArray(in_args)) {
        in_args = [in_args]
    }

    return exec.cmdSync('aws', in_args, '  ', !in_hide);
}

// ******************************

function awsInstalled () {
    if (g_AWS_CLI_INSTALLED === undefined) {
        g_AWS_CLI_INSTALLED = !!awsVersion();
    }
    return g_AWS_CLI_INSTALLED;
}

// ******************************

function awsVersion () {
    let cmdResult = exec.cmdSync('aws', ['--version'], '', false, true);
    if (cmdResult.hasError) {
        return false;
    } else {
        return cmdResult.result;
    }
}

// ******************************
// Exports:
// ******************************

module.exports['installed'] = awsInstalled;
module.exports['version'] = awsVersion;
module.exports['login'] = awsLogin;
module.exports['cmd'] = awsCmd;
module.exports['getServiceConfig'] = getAwsServiceConfig;
module.exports['getRepositoryServiceConfig'] = getAwsRepositoryServiceConfig;
module.exports['getSecretKey'] = getAwsSecretKey;
module.exports['getDockerCredentials'] = getAwsDockerCredentials;
module.exports['getDockerRepository'] = getAwsDockerRepository;

// ******************************
