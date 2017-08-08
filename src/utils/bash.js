'use strict'; // JS: ES6

// ******************************
// Requires:
// ******************************

let fs = require('./filesystem');
let print = require('./print');
let service = require('./service');

// ******************************
// Functions:
// ******************************

function parseBashEnvFile (in_bashEnvFile) {
    let baseEnvContents = fs.readFile(in_bashEnvFile);
    return parseBashEnvContents(baseEnvContents);
}

// ******************************

function parseBashEnvContents (in_bashEnvContents) {
    let serviceConfig = {};
    let bashEnvLines = in_bashEnvContents.split(/(?:\n)|(?:\r\n?)/);

    bashEnvLines.forEach(l => {
        let matches = l.match(/^(.*)="?(.*?)"?;?(?: *#.*)?$/);
        if (!matches) {
            return;
        }
        let key = matches[1];
        let val = matches[2];

        if (key === '_MODEL_VERSION') {
            serviceConfig.model = serviceConfig.model || {};
            serviceConfig.model.version = val;
        } else if (key === 'DOCKER_IMAGE_USERNAME') {
            serviceConfig.docker = serviceConfig.docker || {};
            serviceConfig.docker.username = val;
        } else if (key === 'DOCKER_IMAGE_NAME') {
            serviceConfig.docker = serviceConfig.docker || {};
            serviceConfig.docker.image = serviceConfig.docker.image || {};
            serviceConfig.docker.image.name = val;
        } else if (key === 'DOCKER_IMAGE_VERSION') {
            serviceConfig.docker = serviceConfig.docker || {};
            serviceConfig.docker.image = serviceConfig.docker.image || {};
            serviceConfig.docker.image.version = val;
        } else if (key === 'DOCKER_IMAGE_MEMORY_LIMIT') {
            serviceConfig.docker = serviceConfig.docker || {};
            serviceConfig.docker.container = serviceConfig.docker.container || {};
            serviceConfig.docker.container.memory_limit = parseInt(val);
        } else if (key === 'DOCKER_CONTAINER_PORT') {
            serviceConfig.docker = serviceConfig.docker || {};
            serviceConfig.docker.container = serviceConfig.docker.container || {};
            serviceConfig.docker.container.ports = serviceConfig.docker.container.ports || [];
            serviceConfig.docker.container.ports.push({
                'host': parseInt(val),
                'container': parseInt(val),
                'env': 'test'
            });

            serviceConfig.docker.container.ports.push({
                'host': 80,
                'container': parseInt(val),
                'env': 'prod'
            });

            serviceConfig.docker.image = serviceConfig.docker.image || {};
            serviceConfig.docker.image.ports = serviceConfig.docker.image.ports || [];
            serviceConfig.docker.image.ports.push(parseInt(val));

        } else if (key === 'DOCKER_CONTAINER_SECURE_PORT') {
            serviceConfig.docker = serviceConfig.docker || {};
            serviceConfig.docker.container = serviceConfig.docker.container || {};
            serviceConfig.docker.container.ports = serviceConfig.docker.container.ports || [];
            serviceConfig.docker.container.ports.push({
                'host': parseInt(val),
                'container': parseInt(val),
                'env': 'test'
            });

            serviceConfig.docker.container.ports.push({
                'host': 443,
                'container': parseInt(val),
                'env': 'prod'
            });

            serviceConfig.docker.image = serviceConfig.docker.image || {};
            serviceConfig.docker.image.ports = serviceConfig.docker.image.ports || [];
            serviceConfig.docker.image.ports.push(parseInt(val));

        } else if (key === 'DOCKER_CONTAINER_TEST_START_COMMAND') {
            serviceConfig.docker = serviceConfig.docker || {};
            serviceConfig.docker.image = serviceConfig.docker.image || {};
            serviceConfig.docker.image.scripts = serviceConfig.docker.image.scripts || [];
            serviceConfig.docker.image.scripts.push({
                'name': 'start-test',
                'language': 'bash',
                'commands': [
                    'nginx &',
                    'cd python; python api-test.py'
                ],
                'cmd': true
            });

            serviceConfig.docker.container = serviceConfig.docker.container || {};
            serviceConfig.docker.container.commands = serviceConfig.docker.container.commands || [];
            serviceConfig.docker.container.commands.push({
                'env': 'test',
                'val': './scripts/start-test.sh'
            });

        } else if (key === 'DOCKER_CONTAINER_START_COMMAND') {
            serviceConfig.docker = serviceConfig.docker || {};
            serviceConfig.docker.image = serviceConfig.docker.image || {};
            serviceConfig.docker.image.scripts = serviceConfig.docker.image.scripts || [];
            serviceConfig.docker.image.scripts.push({
                'name': 'start-prod',
                'language': 'bash',
                'commands': [
                    'nginx &',
                    'cd python; python api-prod.py'
                ]
            });

            serviceConfig.docker.container = serviceConfig.docker.container || {};
            serviceConfig.docker.container.commands = serviceConfig.docker.container.commands || [];
            serviceConfig.docker.container.commands.push({
                'env': 'prod',
                'val': './scripts/start-prod.sh'
            });

        } else if (key === 'DOCKER_VERIFY_API_COMMAND') {
        } else if (key === 'DOCKER_VERIFY_API_EXPECTED_RESULT') {
        } else if (key === 'DOCKER_EXTRA_TAG') {
        } else if (key === 'DOCKER_CONTAINER_SECURE_URL_TEST') {
            serviceConfig.service = serviceConfig.service || {};
            serviceConfig.service.clusters = serviceConfig.service.clusters || [];
            let cluster = serviceConfig.service.clusters
                .find(c => c.environment === 'test');
            if (!cluster) {
                cluster = {
                    environment: 'test'
                };
                serviceConfig.service.clusters.push(cluster);
            }
            cluster.url = val;
        } else if (key === 'DOCKER_CONTAINER_SECURE_URL_PROD') {
            serviceConfig.service = serviceConfig.service || {};
            serviceConfig.service.clusters = serviceConfig.service.clusters || [];
            let cluster = serviceConfig.service.clusters
                .find(c => c.environment === 'production');
            if (!cluster) {
                cluster = {
                    environment: 'production'
                };
                serviceConfig.service.clusters.push(cluster);
            }
            cluster.url = val;
        } else if (key === 'DOCKER_CONTAINER_MOUNT_VOLUMES') {
        } else if (key === 'CLUSTER_INSTANCE_COUNT') {
            serviceConfig.service = serviceConfig.service || {};
            serviceConfig.service.clusters = serviceConfig.service.clusters || [];
            if (!serviceConfig.service.clusters[0]) {
                serviceConfig.service.clusters[0] = {};
            }
            let cluster = serviceConfig.service.clusters[0];
            cluster.instance = cluster.instance || {};
            cluster.instance.count = parseInt(val);
        } else if (key === 'INSTANCE_CPU_COUNT') {
            serviceConfig.docker = serviceConfig.docker || {};
            serviceConfig.docker.container = serviceConfig.docker.container || {};
            serviceConfig.docker.container.cpu_core_count = parseInt(val);
        } else if (key === 'SERVICE_NAME') {
            serviceConfig.service = serviceConfig.service || {};
            serviceConfig.service.name = val;
        } else if (key === 'AWS_SERVICE_INSTANCE_TYPE') {
            serviceConfig.aws = serviceConfig.aws || {};
            serviceConfig.service = serviceConfig.service || {};
            serviceConfig.service.clusters = serviceConfig.service.clusters || [];
            if (!serviceConfig.service.clusters[0]) {
                serviceConfig.service.clusters[0] = {};
            }
            let cluster = serviceConfig.service.clusters[0];
            cluster.instance = cluster.instance || {};
            cluster.instance.type = val;
        } else if (key === 'AWS_SERVICE_INSTANCE_VOLUME_SIZE') {
            serviceConfig.aws = serviceConfig.aws || {};
            serviceConfig.service = serviceConfig.service || {};
            serviceConfig.service.clusters = serviceConfig.service.clusters || [];
            if (!serviceConfig.service.clusters[0]) {
                serviceConfig.service.clusters[0] = {};
            }
            let cluster = serviceConfig.service.clusters[0];
            cluster.instance = cluster.instance || {};
            cluster.instance.volumes = cluster.instance.volumes || [];
            if (!cluster.instance.volumes[0]) {
                cluster.instance.volumes[0] = {};
            }
            let volume = cluster.instance.volumes[0];
            volume.Ebs = volume.Ebs || {};
            volume.Ebs.VolumeSize = parseInt(val);
        }
    });

    if (serviceConfig.service && serviceConfig.service.name) {
        let serviceName = serviceConfig.service.name;

        serviceConfig.service = serviceConfig.service || {};
        serviceConfig.service.clusters = serviceConfig.service.clusters || [];
        serviceConfig.service.clusters.forEach(c => {
            if (!c.environment) {
                return;
            }

            let environment = c.environment;
            if (environment === 'production') {
                environment = 'prod';
            }

            _setIfNotSet(c, 'name', serviceName + '-' + environment + '-cluster');
            _setIfNotSet(c, 'service_name', serviceName + '-' + environment + '-service');
            _setIfNotSet(c, 'task_definition_name', serviceName + '-task-definition');
            _setIfNotSet(c, 'launch_configuration_name', serviceName + '-' + environment + '-launch-configuration');
            _setIfNotSet(c, 'auto_scaling_group_name', serviceName + '-' + environment + '-auto-scaling-group');
            _setIfNotSet(c, 'instance', serviceConfig.service.clusters[0].instance);
        });
    }

    service.checkConfigSchema(serviceConfig);
    return serviceConfig;
}

// ******************************
// Helper Functions:
// ******************************

function _setIfNotSet (in_object, in_field, in_value) {
    in_object[in_field] = in_object[in_field] || in_value;
}

// ******************************
// Exports:
// ******************************

module.exports['parseEnvFile'] = parseBashEnvFile;
module.exports['parseEnvContents'] = parseBashEnvContents;

// ******************************
