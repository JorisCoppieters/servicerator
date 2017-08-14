'use strict'; // JS: ES6

// ******************************
// Requires:
// ******************************

let service = require('./service');

// ******************************
// Functions:
// ******************************

function getNginxFileContents (in_serviceConfig) {
    let serviceConfig = service.accessConfig(in_serviceConfig, {
        docker: {
            image: {
                nginx: {
                    servers: [
                        {
                            access_log: 'PATH',
                            error_log: 'PATH',
                            locations: [
                                {
                                    location: 'PATH',
                                    location_params: [
                                        'STRING'
                                    ],
                                    pass_through: 'URL',
                                    uwsgi_pass: 'STRING'
                                }
                            ],
                            port: 'NUMBER',
                            ssl: {
                                certificate: 'PATH',
                                key: 'PATH'
                            }
                        }
                    ],
                    daemon_off: 'BOOLEAN'
                },
                working_directory: 'PATH'
            },
            container: {}
        }
    });

    let workdir = serviceConfig.docker.image.working_directory || '.';

    let workerProcesses = 1;
    let workerConnections = 1024;

    let dockerAuthDir = workdir + '/auth';
    let nginxServers = serviceConfig.docker.image.nginx.servers || [];

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

    if (serviceConfig.docker.image.nginx.daemon_off) {
        nginxContents.push(`daemon off;`);
    }

    return nginxContents.join('\n');
}

// ******************************
// Exports:
// ******************************

module.exports['getFileContents'] = getNginxFileContents;

// ******************************
