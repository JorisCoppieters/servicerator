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
    let workdir = serviceConfigDockerImage.work_directory || '.';

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

        let serverLocations = (s.locations || []).map(l => {
            if (l.pass_through) {
                let serverLocationContent = [
                    ``,
                    `        location ${l.location} {`,
                    `            proxy_pass ${l.pass_through};`,
                    `            proxy_set_header X-Real-IP $remote_addr;`,
                    `        }`,
                ];

                return serverLocationContent.join('\n');
            }

            if (l.uwsgi_pass) {
                let serverLocationContent = [
                    ``,
                    `        location ${l.location} {`,
                    `            include uwsgi_params;`,
                    `            uwsgi_pass ${l.uwsgi_pass};`,
                    `        }`,
                ];

                return serverLocationContent.join('\n');
            }

            if (l.location_params && l.location_params.length) {
                let serverLocationContent = [
                    ``,
                    `        location ${l.location} {`,
                ]
                .concat(l.location_params.map(p => {
                    return `            ${p};`
                }))
                .concat([
                    `        }`
                ]);

                return serverLocationContent.join('\n');
            }
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

    let nginxContents = [
        `worker_processes ${workerProcesses};`,
        ``,
        `events { worker_connections ${workerConnections}; }`,
        ``,
        `http {`,
        ``,
        `    sendfile on;`,
        nginxServersContent,
        `}`
    ];

    if (serviceConfigDockerImageNginx.daemon_off) {
        nginxContents.push(`daemon off;`);
    }

    return nginxContents.join('\n');
}

// ******************************
// Exports:
// ******************************

module.exports['getFileContents'] = getNginxFileContents;

// ******************************
