'use strict'; // JS: ES6

// ******************************
// Requires:
// ******************************

let path = require('path');
let cprint = require('color-print');

let env = require('./env');
let exec = require('./exec');
let fs = require('./filesystem');
let ini = require('./ini');
let service = require('./service');

// ******************************
// Globals:
// ******************************

let g_AWS_CLI_INSTALLED = undefined;

// ******************************
// Functions:
// ******************************

function getAwsDockerRepository (in_serviceConfig) {
    let serviceConfig = service.accessConfig(in_serviceConfig, {
        aws: {
            account_id: 'NUMBER',
            region: 'STRING'
        }
    });

    if (!serviceConfig.aws.account_id) {
        cprint.yellow("AWS account id not set");
        return false;
    }

    return serviceConfig.aws.account_id + '.dkr.ecr.' + (serviceConfig.aws.region || 'ap-southeast-2') + '.amazonaws.com';
}

// ******************************

function getAwsDockerCredentials (in_serviceConfig) {
    if (!awsInstalled()) {
        cprint.yellow('AWS-CLI isn\'t installed');
        return false;
    }

    let awsCmdResult = awsCmd(['ecr', 'get-login'], {
        hide: true
    });

    if (awsCmdResult.hasError) {
        awsCmdResult.printError();
        return false;
    }

    let response = awsCmdResult.result;
    let responseRegExp = new RegExp('docker login -u (AWS) -p ([\\S]+) -e (.*?) (https?:\/\/.*)');
    let responseMatch = response.match(responseRegExp);
    if (!responseMatch || responseMatch.length !== 5) {
        return false;
    }

    let accountId = -1;
    let region = '';

    let address = responseMatch[4] || '';
    let addressMatch = address.match(/https?:\/\/([0-9]+)\.dkr\.ecr\.(.*)\.amazonaws\.com/);
    if (addressMatch && addressMatch.length === 3) {
        accountId = parseInt(addressMatch[1]);
        region = addressMatch[2];
    }

    return {
        username: responseMatch[1],
        password: responseMatch[2],
        account_id: accountId,
        region: region
    };
}

// ******************************

function getAwsServiceConfig () {
    let homeFolder = env.getShellHome();
    let serviceConfig = {
        aws: {}
    };

    let awsConfigFile = path.resolve(homeFolder, '.aws', 'config');
    let awsConfig = ini.parseFile(awsConfigFile);
    if (awsConfig.default && awsConfig.default.region) {
        serviceConfig.aws.region = awsConfig.default.region;
    }

    let awsCredentialsFile = path.resolve(homeFolder, '.aws', 'credentials');
    let awsCredentials = ini.parseFile(awsCredentialsFile);
    if (awsCredentials.default && awsCredentials.default.aws_access_key_id) {
        serviceConfig.aws.access_key = awsCredentials.default.aws_access_key_id;
        serviceConfig.aws.secret_key = awsCredentials.default.aws_secret_access_key;
    }

    service.checkConfigSchema(serviceConfig);
    return serviceConfig;
}

// ******************************

function getAwsRepositoryServiceConfig () {
    let serviceConfig = {
        docker: {
            other_repositories: []
        },
        aws: {
        }
    };

    serviceConfig.docker.other_repositories.push({
        'type': 'AWS'
    });

    if (awsInstalled()) {
        let awsCmdResult = awsCmd(['sts', 'get-caller-identity'], {
            hide: true
        });

        if (!awsCmdResult.hasError) {
            let awsStats = JSON.parse(awsCmdResult.result);
            if (awsStats && awsStats.Account) {
                serviceConfig.aws.account_id = parseInt(awsStats.Account);
            }
        }
    }

    service.checkConfigSchema(serviceConfig);
    return serviceConfig;
}

// ******************************

function getAwsSecretKey (in_serviceConfig) {
    let serviceConfig = service.accessConfig(in_serviceConfig, {
        aws: {
            access_key: 'STRING',
            secret_key: 'STRING'
        }
    });

    let awsSecretKey = serviceConfig.aws.secret_key;

    if (!awsSecretKey) {
        if (serviceConfig.aws.access_key) {
            awsSecretKey = env.getStoredSecretKey('aws', serviceConfig.aws.access_key);
        }
    }

    if (!awsSecretKey) {
        awsSecretKey = env.getStoredSecretKey('aws', '');
    }

    return awsSecretKey;
}

// ******************************

function awsLogin (in_serviceConfig) {
    let serviceConfig = service.accessConfig(in_serviceConfig, {
        aws: {
            access_key: 'STRING',
            secret_key: 'STRING'
        }
    });

    if (!awsInstalled()) {
        cprint.yellow('AWS-CLI isn\'t installed');
        return false;
    }

    let awsAccessKey = serviceConfig.aws.access_key;
    if (!awsAccessKey) {
        cprint.yellow("AWS access key not set");
        return false;
    }

    let awsSecretKey = getAwsSecretKey(in_serviceConfig);
    if (!awsSecretKey) {
        cprint.yellow("AWS secret key not set");
        return false;
    }

    let awsRegion = serviceConfig.aws.region || 'ap-southeast-2';

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

function awsCmd (in_args, in_options) {
    let options = in_options || {};
    let hide = options.hide;

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

    return exec.cmdSync('aws', in_args, '  ', !hide);
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
