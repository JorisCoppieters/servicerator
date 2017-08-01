'use strict'; // JS: ES6

// ******************************
// Requires:
// ******************************

let print = require('./print');
let fs = require('./filesystem');

// ******************************
// Functions:
// ******************************

function getBashEnvContents (in_serviceConfig) {
    let serviceConfig = in_serviceConfig || {};
    let serviceConfigModel = serviceConfig.model || {};
    let serviceConfigDocker = serviceConfig.docker || {};
    let serviceConfigDockerImage = serviceConfigDocker.image || {};
    let serviceConfigDockerContainer = serviceConfigDocker.container || {};
    let serviceConfigService = serviceConfig.service || {};
    let serviceConfigServiceCluster = serviceConfigService.cluster || {};
    let serviceConfigServiceClusterInstance = serviceConfigServiceCluster.instance || {};

    let containerPorts = serviceConfigDockerContainer.ports || [];
    let serviceConfigServiceUrls = serviceConfigService.urls || [];

    let scripts = (serviceConfigDockerImage.scripts || []);

    return [
        `_MODEL_VERSION="${serviceConfigModel.version}";`,
        ``,
        `BASE_DIR="./";`,
        `DOCKER_IMAGE_USERNAME="${serviceConfigDocker.username}";`,
        `DOCKER_IMAGE_NAME="${serviceConfigDockerImage.name}";`,
        `DOCKER_IMAGE_VERSION="${serviceConfigDockerImage.version}";`,
        `DOCKER_IMAGE_MEMORY_LIMIT=${serviceConfigDockerContainer.memory_limit};`,
        `DOCKER_CONTAINER_PORT=${
                (containerPorts
                    .find((p) => {return p.description==='nginx_http'}) || {}).container
            };`,
        `DOCKER_CONTAINER_SECURE_PORT=${
                (containerPorts
                    .find((p) => {return p.description==='nginx_https'}) || {}).container
            };`,
        `DOCKER_VERIFY_API_COMMAND="curl -s -k https://localhost:$DOCKER_CONTAINER_SECURE_PORT";`,
        `DOCKER_VERIFY_API_EXPECTED_RESULT='{'*'container_version'*':'*$DOCKER_IMAGE_VERSION*'cpu_count'*'cpu_percent'*'model_version'*':'*$_MODEL_VERSION*'processes'*'}';`,
        `DOCKER_EXTRA_TAG="model-version-"$_MODEL_VERSION;`,
        `DOCKER_CONTAINER_SECURE_URL_TEST="${
                (serviceConfigServiceUrls
                    .find((u) => {return u.env==='test'}) || {}).val
            }";`,
        `DOCKER_CONTAINER_SECURE_URL_PROD="${
                (serviceConfigServiceUrls
                    .find((u) => {return u.env==='prod'}) || {}).val
            }";`,
        `DOCKER_CONTAINER_MOUNT_VOLUMES=true;`,
        `CLUSTER_INSTANCE_COUNT=${serviceConfigServiceClusterInstance.count};`,
        `INSTANCE_CPU_COUNT=${serviceConfigDockerContainer.cpu_core_count};`,
        `SERVICE_NAME="${serviceConfigService.name}";`,
        ``,
        `AWS_SERVICE_INSTANCE_TYPE="${serviceConfigServiceClusterInstance.type}";`,
        `AWS_SERVICE_INSTANCE_VOLUME_SIZE=${serviceConfigServiceClusterInstance.volume_size};`,
        ``,
        `CONSTANTS_FILE="python/constants.py";`,
        `echo "#CONSTANTS" > "$CONSTANTS_FILE";`,
        `echo "service_name = \\\""$SERVICE_NAME"\\\"" >> "$CONSTANTS_FILE";`,
        `echo "log_file = \\\"/var/log/tm-services/%s/api.log\\\" % (service_name)" >> "$CONSTANTS_FILE";`,
        `echo "model_version = \\\""$_MODEL_VERSION"\\\"" >> "$CONSTANTS_FILE";`,
        `echo "container_version = \\\""$DOCKER_IMAGE_VERSION"\\\"" >> "$CONSTANTS_FILE";`,
        `echo "cpu_count = "$INSTANCE_CPU_COUNT >> "$CONSTANTS_FILE";`,
    ].join('\n');
}

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
        let matches = l.match(/^(.*)="?(.*?)"?;?$/);
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
                'container': parseInt(val)
            });

            serviceConfig.docker = serviceConfig.docker || {};
            serviceConfig.docker.image = serviceConfig.docker.image || {};
            serviceConfig.docker.image.ports = serviceConfig.docker.image.ports || [];
            serviceConfig.docker.image.ports.push(parseInt(val));

        } else if (key === 'DOCKER_CONTAINER_SECURE_PORT') {
            serviceConfig.docker = serviceConfig.docker || {};
            serviceConfig.docker.container = serviceConfig.docker.container || {};
            serviceConfig.docker.container.ports = serviceConfig.docker.container.ports || [];
            serviceConfig.docker.container.ports.push({
                'host': parseInt(val),
                'container': parseInt(val)
            });

            serviceConfig.docker = serviceConfig.docker || {};
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
        } else if (key === 'DOCKER_VERIFY_API_COMMAND') {
        } else if (key === 'DOCKER_VERIFY_API_EXPECTED_RESULT') {
        } else if (key === 'DOCKER_EXTRA_TAG') {
        } else if (key === 'DOCKER_CONTAINER_SECURE_URL_TEST') {
            serviceConfig.service = serviceConfig.service || {};
            serviceConfig.service.urls = serviceConfig.service.urls || [];
            serviceConfig.service.urls.push({
                'env': 'test',
                'val': val
            });
        } else if (key === 'DOCKER_CONTAINER_SECURE_URL_PROD') {
            serviceConfig.service = serviceConfig.service || {};
            serviceConfig.service.urls = serviceConfig.service.urls || [];
            serviceConfig.service.urls.push({
                'env': 'prod',
                'val': val
            });
        } else if (key === 'DOCKER_CONTAINER_MOUNT_VOLUMES') {
        } else if (key === 'CLUSTER_INSTANCE_COUNT') {
            serviceConfig.service = serviceConfig.service || {};
            serviceConfig.service.cluster = serviceConfig.service.cluster || {};
            serviceConfig.service.cluster.instance = serviceConfig.service.cluster.instance || {};
            serviceConfig.service.cluster.instance.count = parseInt(val);
        } else if (key === 'INSTANCE_CPU_COUNT') {
            serviceConfig.docker = serviceConfig.docker || {};
            serviceConfig.docker.container = serviceConfig.docker.container || {};
            serviceConfig.docker.container.cpu_core_count = parseInt(val);
        } else if (key === 'SERVICE_NAME') {
            serviceConfig.service = serviceConfig.service || {};
            serviceConfig.service.name = val;
        } else if (key === 'AWS_SERVICE_INSTANCE_TYPE') {
            serviceConfig.service = serviceConfig.service || {};
            serviceConfig.service.cluster = serviceConfig.service.cluster || {};
            serviceConfig.service.cluster.instance = serviceConfig.service.cluster.instance || {};
            serviceConfig.service.cluster.instance.type = val;
        } else if (key === 'AWS_SERVICE_INSTANCE_VOLUME_SIZE') {
            serviceConfig.service = serviceConfig.service || {};
            serviceConfig.service.cluster = serviceConfig.service.cluster || {};
            serviceConfig.service.cluster.instance = serviceConfig.service.cluster.instance || {};
            serviceConfig.service.cluster.instance.volume_size = parseInt(val);
        // } else {
        //     print.keyVal(key, val);
        }
    });

    return serviceConfig;
}

// ******************************
// Exports:
// ******************************

module.exports['getEnvContents'] = getBashEnvContents;
module.exports['parseEnvFile'] = parseBashEnvFile;
module.exports['parseEnvContents'] = parseBashEnvContents;

// ******************************
