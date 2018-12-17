'use strict'; // JS: ES6

// ******************************
// Requires:
// ******************************

let cprint = require('color-print');

let date = require('../utils/date');
let docker = require('../utils/docker');
let env = require('../utils/env');
let fs = require('../utils/filesystem');
let openssl = require('../utils/openssl');
let print = require('../utils/print');
let service = require('../utils/service');

// ******************************
// Functions:
// ******************************

function printAuthInfo (in_serviceConfig) {
    let serviceConfig = service.accessConfig(in_serviceConfig, {
        auth: {
            certificate: 'STRING',
            rootCACertificate: 'PATH'
        },
        cwd: 'STRING'
    });

    let path = require('path');

    let sourceFolder = serviceConfig.cwd || false;

    if (!sourceFolder) {
        cprint.yellow('Source folder not set');
        return;
    }

    let dockerFolder = docker.getFolder(sourceFolder);
    if (!dockerFolder || !fs.folderExists(dockerFolder)) {
        cprint.yellow('Docker folder not set up: ' + dockerFolder);
        return;
    }

    let authFolder = path.resolve(dockerFolder, 'auth');
    if (!authFolder || !fs.folderExists(authFolder)) {
        fs.createFolder(authFolder);
    }

    if (!authFolder || !fs.folderExists(authFolder)) {
        cprint.yellow('Auth folder not set up: ' + authFolder);
        return;
    }

    if (!serviceConfig.auth.rootCACertificate) {
        cprint.yellow('Root CA certificate not set');
        return;
    }

    if (!fs.fileExists(serviceConfig.auth.rootCACertificate)) {
        cprint.yellow('Root CA certificate cannot be found: ' + serviceConfig.auth.rootCACertificate);
        return;
    }

    let rootCACertificate = serviceConfig.auth.rootCACertificate;

    let serviceCertificateName = serviceConfig.auth.certificate || 'service.crt';
    let serviceCertificate = path.resolve(authFolder, serviceCertificateName);

    rootCACertificate = path.resolve(rootCACertificate);

    cprint.cyan('Verifying certificate...');
    let cmdResult = openssl.cmd(['verify', '-CAfile', rootCACertificate, serviceCertificate]);
    if (cmdResult.hasError) {
        cmdResult.throwError();
        return;
    } else {
        cmdResult.printResult();
    }
}

// ******************************

function generateAuthFiles (in_serviceConfig) {
    let serviceConfig = service.accessConfig(in_serviceConfig, {
        auth: {
            key: 'STRING',
            pkcs8: 'STRING',
            certificate: 'STRING',
            rootCAKey: 'PATH',
            rootCACertificate: 'PATH'
        },
        service: {
            name: 'STRING',
            clusters: [
                {
                    environment: 'STRING',
                    url: 'STRING'
                }
            ]
        },
        cwd: 'STRING'
    });

    let path = require('path');

    let sourceFolder = serviceConfig.cwd || false;
    if (!sourceFolder) {
        cprint.yellow('Source folder not set');
        return;
    }

    let dockerFolder = docker.getFolder(sourceFolder);
    if (!dockerFolder || !fs.folderExists(dockerFolder)) {
        cprint.yellow('Docker folder not set up: ' + dockerFolder);
        return;
    }

    let authFolder = path.resolve(dockerFolder, 'auth');
    if (!authFolder || !fs.folderExists(authFolder)) {
        fs.createFolder(authFolder);
    }

    if (!authFolder || !fs.folderExists(authFolder)) {
        cprint.yellow('Auth folder not set up: ' + authFolder);
        return;
    }

    let tempFolder = env.getTemp();
    let tmpAuthFolder = path.resolve(tempFolder, 'servicerator-auth-tmp-' + date.getTimestampTag());
    fs.createFolder(tmpAuthFolder);

    let caSignDB = path.resolve(tmpAuthFolder, 'tmp-db');
    let caSignSerial = path.resolve(tmpAuthFolder, 'tmp-serial');
    let caSignConfig = path.resolve(tmpAuthFolder, 'ca-sign-config.cnf');
    let caSignExtConfig = path.resolve(tmpAuthFolder, 'ca-sign-ext-config.cnf');
    let reqCrtConfig = path.resolve(tmpAuthFolder, 'req-crt-config.cnf');

    let rootCAKey = path.resolve(tmpAuthFolder, 'rootCA.key');
    let rootCACertificate = path.resolve(tmpAuthFolder, 'rootCA.crt');

    if (!serviceConfig.auth.rootCAKey) {
        cprint.yellow('Root CA key not set');
        return;
    }

    if (!fs.fileExists(serviceConfig.auth.rootCAKey)) {
        cprint.yellow('Root CA key cannot be found: ' + serviceConfig.auth.rootCAKey);
        return;
    }

    if (!serviceConfig.auth.rootCACertificate) {
        cprint.yellow('Root CA certificate not set');
        return;
    }

    if (!fs.fileExists(serviceConfig.auth.rootCACertificate)) {
        cprint.yellow('Root CA certificate cannot be found: ' + serviceConfig.auth.rootCACertificate);
        return;
    }

    let serviceKeyName = serviceConfig.auth.key || 'service.key';
    let serviceKey = path.resolve(authFolder, serviceKeyName);

    let serviceCertificateName = serviceConfig.auth.certificate || 'service.crt';
    let serviceCertificate = path.resolve(authFolder, serviceCertificateName);

    let serviceSigningRequest = path.resolve(tmpAuthFolder, 'service.csr');

    cprint.cyan('Setting up certificate configuration...');

    fs.writeFile(caSignDB, '');
    fs.writeFile(caSignSerial, '01');

    let urls = serviceConfig.service.clusters
        .filter(c => c.url)
        .map(c => service.replaceConfigReferences(in_serviceConfig, c.url)) || [];

    let firstUrl = urls[0] || false;
    let otherUrls = urls.slice(1);

    let afterCopy = () => {
        print.keyVal('Service key', serviceKey);
        print.keyVal('Service certificate', serviceCertificate);
        print.keyVal('Root CA certificate', rootCACertificate);

        let reqCaCrtConfigContents = [
            '[req]',
            'distinguished_name = req_distinguished_name',
            'default_bits = 2048',
            'req_extensions = req_ext',
            'prompt = no',

            '[req_distinguished_name]',
            'C = NZ',
            'ST = Wellington',
            'L = Wellington',
            'O = TradeMe Ltd.',
            'OU = Data Science'
        ];

        if (firstUrl) {
            reqCaCrtConfigContents.push(`CN = ${firstUrl}`);
        }

        reqCaCrtConfigContents = reqCaCrtConfigContents.concat([
            '[req_ext]',
            'keyUsage = keyEncipherment, dataEncipherment',
            'extendedKeyUsage = serverAuth'
        ]);

        if (otherUrls.length) {
            reqCaCrtConfigContents = reqCaCrtConfigContents.concat([
                'subjectAltName = @alt_names',

                '[alt_names]'
            ]);

            otherUrls.forEach((u, idx) => {
                reqCaCrtConfigContents.push(`DNS.${idx} = "${u}"`);
            });
        }

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
            '[ ca ]',
            'default_ca = tm_ds_ca',

            '[ tm_ds_ca ]',
            `serial = "${caSignSerial}"`,
            `database = "${caSignDB}"`,
            `new_certs_dir = "${tmpAuthFolder}"`,
            `certificate = "${rootCACertificate}"`,
            `private_key = "${rootCAKey}"`,
            'default_md = sha256',
            'default_days = 365',
            'policy = my_policy',

            '[ my_policy ]',
            'countryName = match',
            'stateOrProvinceName = supplied',
            'organizationName = supplied',
            'organizationalUnitName = optional'
        ];

        let caSignExtConfigContents = [
            'basicConstraints=CA:FALSE',
            'subjectKeyIdentifier = hash',
        ];

        if (urls.length) {
            caSignConfigContents = caSignConfigContents.concat([
                'commonName = supplied'
            ]);

            caSignExtConfigContents = caSignExtConfigContents.concat([
                'subjectAltName=@alternate_names',

                '[ alternate_names ]'
            ]);

            urls.forEach((u, idx) => {
                caSignExtConfigContents.push(`DNS.${idx} = "${u}"`);
            });
        }

        fs.writeFile(caSignConfig, caSignConfigContents.join('\n'));
        fs.writeFile(caSignExtConfig, caSignExtConfigContents.join('\n'));

        let cmdResult;

        cprint.cyan('Creating certificate key...');
        cmdResult = openssl.cmd(['genrsa', '-out', serviceKey, 2048]);
        if (!cmdResult) {
            return;
        }

        if (cmdResult.hasError) {
            cmdResult.throwError();
            return;
        }

        cmdResult.printResult();

        cprint.cyan('Generating certificate signing request...');
        cmdResult = openssl.cmd(['req', '-config', reqCrtConfig, '-extensions', 'req_ext', '-key', serviceKey, '-new', '-out', serviceSigningRequest]);
        if (!cmdResult) {
            return;
        }

        if (cmdResult.hasError) {
            cmdResult.printError('    ');
            cprint.yellow(['\n  There may be a fault in config file - ' + reqCrtConfig + ':']
                .concat(reqCaCrtConfigContents)
                .join('\n    ')
            );
            cprint.yellow('\n  Otherwise try generating the auth files again...\n');
            return;
        }

        cmdResult.printResult();

        cprint.cyan('Signing certificate...');
        cmdResult = openssl.cmd(['ca', '-config', caSignConfig, '-extfile', caSignExtConfig, '-in', serviceSigningRequest, '-batch', '-out', serviceCertificate]);
        if (!cmdResult) {
            return;
        }

        if (cmdResult.hasError) {
            cmdResult.printError('    ');
            cprint.yellow(['\n  There may be a fault in config file - ' + caSignConfig + ':']
                .concat(caSignConfigContents)
                .join('\n    ')
            );
            cprint.yellow(['\n  There may be a fault in config file - ' + caSignExtConfig + ':']
                .concat(caSignExtConfigContents)
                .join('\n    ')
            );
            cprint.yellow('\n  Otherwise try generating the auth files again...\n');
            return;
        }

        cmdResult.printResult();

        cprint.cyan('Verifying certificate...');
        cmdResult = openssl.cmd(['verify', '-CAfile', rootCACertificate, serviceCertificate]);
        if (!cmdResult) {
            return;
        }

        if (cmdResult.hasError) {
            cmdResult.throwError();
            return;
        }

        cmdResult.printResult();

        let servicePk8Name = serviceConfig.auth.pkcs8 || false;
        if (servicePk8Name) {
            let servicePk8 = path.resolve(authFolder, servicePk8Name);

            cprint.cyan('Converting to pkcs8 format...');
            cmdResult = openssl.cmd(['pkcs8', '-in', serviceKey, '-topk8', '-nocrypt', '-out', servicePk8]);
            if (cmdResult.hasError) {
                cmdResult.throwError();
                return;
            } else {
                cmdResult.printResult();
            }
        }

        return true;
    };

    fs.copyFile(serviceConfig.auth.rootCAKey, rootCAKey, () => {
        fs.copyFile(serviceConfig.auth.rootCACertificate, rootCACertificate, () => {
            setTimeout(() => { // To prevent race condition
                afterCopy();
                cprint.cyan('Cleaning up...');
                fs.deleteFolder(tmpAuthFolder);
            }, 200);
        });
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
