'use strict'; // JS: ES6

// ******************************
// Requires:
// ******************************

// ******************************
// Functions:
// ******************************

function getNginxFileContents (in_serviceConfig) {
    let serviceConfig = in_serviceConfig || {};
    let serviceConfigDocker = serviceConfig.docker || {};
    let serviceConfigDockerImage = serviceConfigDocker.image || {};
    let serviceConfigDockerImageNginx = serviceConfigDockerImage.nginx || {};
    let serviceConfigDockerContainer = serviceConfigDocker.container || {};
    let workdir = serviceConfigDockerImage.work_directory || './';

    let workerProcesses = 4;
    let workerConnections = 1024;

    let dockerAuthDir = workdir + '/auth';
    let nginxServers = serviceConfigDockerImageNginx.servers || [];

    let nginxServersContent = nginxServers.map(s => {
        let authContent = [];

        if (s.ssl) {
            authContent.push('');
            authContent.push(`        ssl on;`);

            let dockerAuthCertificateFile = s.ssl.certificate.replace(/\$AUTH_DIR/, dockerAuthDir);
            authContent.push(`        ssl_certificate ${dockerAuthCertificateFile};`);

            let dockerAuthKeyFile = s.ssl.key.replace(/\$AUTH_DIR/, dockerAuthDir);
            authContent.push(`        ssl_certificate_key ${dockerAuthKeyFile};`);
        }

        let serverLocations = s.locations.map(l => {
            let serverLocationContent = [
                ``,
                `        location ${l.location} {`,
                `            proxy_pass ${l.pass_through};`,
                `            proxy_set_header X-Real-IP $remote_addr;`,
                `        }`,
            ];

            return serverLocationContent.join('\n');
        });

        return [
            ``,
            `    server {`,
            `        listen ${s.port};`]
            .concat(authContent)
            .concat([
            ``,
            `        access_log ${s.access_log};`,
            `        error_log ${s.error_log};`])
            .concat(serverLocations)
            .concat([
            `    }`
            ])
            .join('\n');
    }).join('\n');

    return [
        `worker_processes ${workerProcesses};`,
        ``,
        `events { worker_connections ${workerConnections}; }`,
        ``,
        `http {`,
        ``,
        `    sendfile on;`,
        nginxServersContent,
        `}`,
        `daemon off;`,
    ].join('\n');
}

// ******************************
// Exports:
// ******************************

module.exports['getFileContents'] = getNginxFileContents;

// ******************************
