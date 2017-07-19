'use strict'; // JS: ES6

// ******************************
// Requries:
// ******************************

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
    let pythonStartCommands =
        (serviceConfigDockerContainer.commands || [])
            .filter((c) => {return c.type==='python_start';});

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
                    .find((p) => {return p.description==='nginx_http'}) || {}).number
            };`,
        `DOCKER_CONTAINER_SECURE_PORT=${
                (containerPorts
                    .find((p) => {return p.description==='nginx_https'}) || {}).number
            };`,
        `DOCKER_CONTAINER_TEST_START_COMMAND="${
                (pythonStartCommands
                    .find((c) => {return c.env==='test'}) || {}).val
            }";`,
        `DOCKER_CONTAINER_START_COMMAND="${
                (pythonStartCommands
                    .find((c) => {return c.env==='prod'}) || {}).val
            }";`,
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
// Exports:
// ******************************

module.exports['getEnvContents'] = getBashEnvContents;

// ******************************
