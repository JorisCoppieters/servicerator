'use strict'; // JS: ES5

// ******************************
// Requries:
// ******************************

// ******************************
// Functions:
// ******************************

function getNginxFileContents (in_serviceConfig) {
    return [
        `worker_processes 4;`,
        ``,
        `events { worker_connections 1024; }`,
        ``,
        `http {`,
        ``,
        `    sendfile on;`,
        ``,
        `    server {`,
        ``,
        `        listen 5100;`,
        ``,
        `        access_log /var/log/nginx/docker.access.log;`,
        `        error_log /var/log/nginx/docker.error.log;`,
        ``,
        `        location / {`,
        `            proxy_pass http://127.0.0.1:5000/v1/status;`,
        `            proxy_set_header X-Real-IP $remote_addr;`,
        `        }`,
        ``,
        `        location /v1/status {`,
        `            proxy_pass http://127.0.0.1:5000/v1/status;`,
        `            proxy_set_header X-Real-IP $remote_addr;`,
        `        }`,
        ``,
        `        location /v1/classify {`,
        `            proxy_pass http://127.0.0.1:5000/v1/predict;`,
        `            proxy_set_header X-Real-IP $remote_addr;`,
        `        }`,
        ``,
        `        location /v1/predict {`,
        `            proxy_pass http://127.0.0.1:5000/v1/predict;`,
        `            proxy_set_header X-Real-IP $remote_addr;`,
        `        }`,
        `    }`,
        ``,
        `    server {`,
        ``,
        `        listen 5200;`,
        ``,
        `        ssl on;`,
        `        ssl_certificate /home/classifier/auth/service.crt;`,
        `        ssl_certificate_key /home/classifier/auth/service.key;`,
        ``,
        `        access_log /var/log/nginx/docker.ssl_access.log;`,
        `        error_log /var/log/nginx/docker.ssl_error.log;`,
        ``,
        `        location / {`,
        `            proxy_pass http://127.0.0.1:5000/v1/status;`,
        `            proxy_set_header X-Real-IP $remote_addr;`,
        `        }`,
        ``,
        `        location /v1/status {`,
        `            proxy_pass http://127.0.0.1:5000/v1/status;`,
        `            proxy_set_header X-Real-IP $remote_addr;`,
        `        }`,
        ``,
        `        location /v1/classify {`,
        `            proxy_pass http://127.0.0.1:5000/v1/predict;`,
        `            proxy_set_header X-Real-IP $remote_addr;`,
        `        }`,
        ``,
        `        location /v1/predict {`,
        `            proxy_pass http://127.0.0.1:5000/v1/predict;`,
        `            proxy_set_header X-Real-IP $remote_addr;`,
        `        }`,
        `    }`,
        `}`,
        ``,
        `daemon off;`,
    ].join('\n');
}

// ******************************
// Exports:
// ******************************

module.exports['getFileContents'] = getNginxFileContents;

// ******************************
