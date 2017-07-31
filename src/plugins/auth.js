'use strict'; // JS: ES6

// ******************************
// Requires:
// ******************************

let cprint = require('color-print');
let path = require('path');

let exec = require('../utils/exec');
let openssl = require('../utils/openssl');
let fs = require('../utils/filesystem');

// ******************************
// Functions:
// ******************************

function printAuthInfo (in_serviceConfig) {
    let serviceConfig = in_serviceConfig || {};
    let serviceConfigAuth = serviceConfig.auth || {};
    let sourceFolder = in_serviceConfig.cwd || false;

    if (!sourceFolder) {
        cprint.yellow('Source folder not set');
        return;
    }

    let authFolder = path.resolve(sourceFolder, 'auth');
    if (!authFolder || !fs.folderExists(authFolder)) {
        cprint.yellow('Auth folder not set up: ' + authFolder);
        return;
    }

    if (!serviceConfigAuth.rootCACertificate) {
        cprint.yellow('Root CA certificate not set');
        return;
    }

    if (!fs.fileExists(serviceConfigAuth.rootCACertificate)) {
        cprint.yellow('Root CA certificate cannot be found: ' + serviceConfigAuth.rootCACertificate);
        return;
    }

    let rootCACertificate = serviceConfigAuth.rootCACertificate;
    let serviceCertificate = path.resolve(authFolder, "service.crt");

    cprint.cyan('Verifying certificate...');
    let cmdResult = openssl.cmd(['verify', '-CAfile', rootCACertificate, serviceCertificate]);
    if (cmdResult.hasError) {
        cmdResult.printError();
        return;
    } else {
        cmdResult.printResult();
    }
}

// ******************************

function generateAuthFiles (in_serviceConfig) {
    let serviceConfig = in_serviceConfig || {};
    let serviceConfigAuth = serviceConfig.auth || {};
    let serviceConfigService = serviceConfig.service || {};
    let serviceConfigServiceUrls = serviceConfigService.urls || [];
    let serviceName = serviceConfigService.name || false;
    let sourceFolder = in_serviceConfig.cwd || false;

    if (!sourceFolder) {
        cprint.yellow('Source folder not set');
        return;
    }

    let authFolder = path.resolve(sourceFolder, 'auth');
    if (!authFolder || !fs.folderExists(authFolder)) {
        cprint.yellow('Auth folder not set up: ' + authFolder);
        return;
    }

    let tmpAuthFolder = path.resolve(authFolder, 'tmp');
    fs.deleteFolder(tmpAuthFolder);
    fs.createFolder(tmpAuthFolder);

    let caSignDB = path.resolve(tmpAuthFolder, "tmp-db");
    let caSignSerial = path.resolve(tmpAuthFolder, "tmp-serial");
    let caSignConfig = path.resolve(tmpAuthFolder, "ca-sign-config.cnf");
    let caSignExtConfig = path.resolve(tmpAuthFolder, "ca-sign-ext-config.cnf");
    let reqCaCrtConfig = path.resolve(tmpAuthFolder, "req-ca-crt-config.cnf");
    let reqCrtConfig = path.resolve(tmpAuthFolder, "req-crt-config.cnf");

    let rootCAKey = path.resolve(tmpAuthFolder, "rootCA.key");
    let rootCACertificate = path.resolve(tmpAuthFolder, "rootCA.crt");

    if (!serviceConfigAuth.rootCAKey) {
        cprint.red('Root CA key not set');
        return;
    }

    if (!fs.fileExists(serviceConfigAuth.rootCAKey)) {
        cprint.yellow('Root CA key cannot be found: ' + serviceConfigAuth.rootCAKey);
        return;
    }

    if (!serviceConfigAuth.rootCACertificate) {
        cprint.yellow('Root CA certificate not set');
        return;
    }

    if (!fs.fileExists(serviceConfigAuth.rootCACertificate)) {
        cprint.yellow('Root CA certificate cannot be found: ' + serviceConfigAuth.rootCACertificate);
        return;
    }

    let serviceKey = path.resolve(authFolder, "service.key");
    let serviceCertificate = path.resolve(authFolder, "service.crt");
    let serviceSigningRequest = path.resolve(tmpAuthFolder, "service.csr");

    cprint.cyan('Setting up certificate configuration...');

    fs.writeFile(caSignDB, '');
    fs.writeFile(caSignSerial, '01');

    fs.copyFile(serviceConfigAuth.rootCAKey, rootCAKey)
    .then(() => {
        return fs.copyFile(serviceConfigAuth.rootCACertificate, rootCACertificate);
    })
    .then(() => {
        let reqCaCrtConfigContents = [
            `[req]`,
            `distinguished_name = req_distinguished_name`,
            `default_bits = 2048`,
            `req_extensions = req_ext`,
            `prompt = no`,

            `[req_distinguished_name]`,
            `C = NZ`,
            `ST = Wellington`,
            `L = Wellington`,
            `O = TradeMe Ltd.`,
            `OU = Data Science`,
            `CN = "${serviceName}".trademe-ds.com`,

            `[req_ext]`,
            `keyUsage = keyEncipherment, dataEncipherment`,
            `extendedKeyUsage = serverAuth`,
            `subjectAltName = @alt_names`,

            `[alt_names]`
        ];

        [`${serviceName}.test.trademe-ds.com`].concat(serviceConfigServiceUrls.map(u => u.val)).forEach((u, idx) => {
            reqCaCrtConfigContents.push(`DNS.${idx} = "${u}"`);
        });

        fs.writeFile(reqCrtConfig, reqCaCrtConfigContents.join('\n'));

        caSignSerial = caSignSerial.replace(new RegExp('\\\\', 'g'), '/');
        caSignDB = caSignDB.replace(new RegExp('\\\\', 'g'), '/');
        tmpAuthFolder = tmpAuthFolder.replace(new RegExp('\\\\', 'g'), '/');
        rootCACertificate = rootCACertificate.replace(new RegExp('\\\\', 'g'), '/');
        rootCAKey = rootCAKey.replace(new RegExp('\\\\', 'g'), '/');
        reqCrtConfig = reqCrtConfig.replace(new RegExp('\\\\', 'g'), '/');
        caSignConfig = caSignConfig.replace(new RegExp('\\\\', 'g'), '/');
        caSignExtConfig = caSignExtConfig.replace(new RegExp('\\\\', 'g'), '/');
        serviceSigningRequest = serviceSigningRequest.replace(new RegExp('\\\\', 'g'), '/');
        serviceCertificate = serviceCertificate.replace(new RegExp('\\\\', 'g'), '/');
        serviceKey = serviceKey.replace(new RegExp('\\\\', 'g'), '/');

        let caSignConfigContents = [
            `[ ca ]`,
            `default_ca = tm_ds_ca`,

            `[ tm_ds_ca ]`,
            `serial = "${caSignSerial}"`,
            `database = "${caSignDB}"`,
            `new_certs_dir = "${tmpAuthFolder}"`,
            `certificate = "${rootCACertificate}"`,
            `private_key = "${rootCAKey}"`,
            `default_md = sha256`,
            `default_days = 365`,
            `policy = my_policy`,

            `[ my_policy ]`,
            `countryName = match`,
            `stateOrProvinceName = supplied`,
            `organizationName = supplied`,
            `commonName = supplied`,
            `organizationalUnitName = optional`,
            `commonName = supplied`
        ];

        fs.writeFile(caSignConfig, caSignConfigContents.join('\n'));

        let caSignExtConfigContents = [
            `basicConstraints=CA:FALSE`,
            `subjectAltName=@alternate_names`,
            `subjectKeyIdentifier = hash`,

            `[ alternate_names ]`
        ];

        [`${serviceName}.test.trademe-ds.com`].concat(serviceConfigServiceUrls.map(u => u.val)).forEach((u, idx) => {
            caSignExtConfigContents.push(`DNS.${idx} = "${u}"`);
        });

        fs.writeFile(caSignExtConfig, caSignExtConfigContents.join('\n'));

        let cmdResult;

        cprint.cyan('Creating certificate key...');
        cmdResult = openssl.cmd(['genrsa', '-out', serviceKey, 2048]);
        if (cmdResult.hasError) {
            cmdResult.printError();
            return;
        } else {
            cmdResult.printResult();
        }

        cprint.cyan('Generating certificate signing request...');
        cmdResult = openssl.cmd(['req', '-config', reqCrtConfig, '-extensions', 'req_ext', '-key', serviceKey, '-new', '-out', serviceSigningRequest]);
        if (cmdResult.hasError) {
            cmdResult.printError();
            return;
        } else {
            cmdResult.printResult();
        }

        cprint.cyan('Signing certificate...');
        cmdResult = openssl.cmd(['ca', '-config', caSignConfig, '-extfile', caSignExtConfig, '-in', serviceSigningRequest, '-batch', '-out', serviceCertificate]);
        if (cmdResult.hasError) {
            cmdResult.printError();
            return;
        } else {
            cmdResult.printResult();
        }

        cprint.cyan('Verifying certificate...');
        cmdResult = openssl.cmd(['verify', '-CAfile', rootCACertificate, serviceCertificate]);
        if (cmdResult.hasError) {
            cmdResult.printError();
            return;
        } else {
            cmdResult.printResult();
        }

        cprint.cyan('Cleaning up...');
        fs.deleteFolder(tmpAuthFolder);
    });
}

// ******************************
// Plugin Functions:
// ******************************

function handleCommand (in_args, in_params, in_serviceConfig) {
    let command = in_params.length ? in_params.shift().toLowerCase() : '';

    switch(command)
    {
        case '':
        case 'info':
            printAuthInfo(in_serviceConfig);
            break;

        case 'generate':
        case 'create':
            generateAuthFiles(in_serviceConfig);
            break;

        default:
            return false;
    }
    return true;
}

// ******************************

function getBaseCommands () {
    return ['auth', 'cert', 'authentication', 'certificate'];
}

// ******************************

function getCommands () {
    return [
        { params: ['', 'info'], description: 'Print authentication information'},
        { params: ['generate', 'create'], description: 'Create authentication files' }
    ];
}

// ******************************

function getTitle () {
    return 'Auth';
}

// ******************************
// Exports:
// ******************************

module.exports['handleCommand'] = handleCommand;
module.exports['getBaseCommands'] = getBaseCommands;
module.exports['getCommands'] = getCommands;
module.exports['getTitle'] = getTitle;

// ******************************
