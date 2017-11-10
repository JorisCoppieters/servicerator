'use strict'; // JS: ES6

// ******************************
// Functions:
// ******************************

function getServiceSchema () {
    return {
        "cwd": "STRING",
        "auth": {
            "certificate": "STRING",
            "key": "STRING",
            "pkcs8": "STRING",
            "rootCAKey": "PATH",
            "rootCACertificate": "PATH",
            "type": "STRING"
        },
        "aws": {
            "__allow_prod_access__": "BOOLEAN",
            "account_id": "NUMBER",
            "access_key": "STRING",
            "secret_key": "STRING",
            "profile": "STRING",
            "region": "STRING"
        },
        "corpus": {
            "version": "STRING"
        },
        "model": {
            "source": "STRING",
            "type": "STRING",
            "version": "STRING"
        },
        "filesystem": [
            {
                "contents": [
                    "STRING"
                ],
                "source": "PATH",
                "destination": "PATH",
                "path": "PATH",
                "type": "STRING",
                "on_open": "BOOLEAN",
                "on_close": "BOOLEAN",
                "on_setup": "BOOLEAN",
                "overwrite": "BOOLEAN"
            }
        ],
        "version_control": {
            "type": "STRING",
            "ignore": [
                "STRING"
            ],
            "root_folder": "STRING"
        },

        "docker": {
            "container": {
                "commands": [
                    {
                        "test": "BOOLEAN",
                        "val": "STRING" // TODO: Rename to "value"
                    }
                ],
                "cpu_core_count": "NUMBER",
                "name": "STRING",
                "logging_support": "BOOLEAN",
                "memory_limit": "NUMBER",
                "ports": [
                    {
                        "test": "BOOLEAN",
                        "container": "NUMBER",
                        "host": "NUMBER",
                        "description": "STRING"
                    }
                ],
                "volumes": [
                    {
                        "container": "STRING",
                        "host": "STRING",
                        "name": "STRING",
                        "read_only": "BOOLEAN"
                    }
                ]
            },
            "image": {
                "name": "STRING",
                "base": "STRING",
                "language": "STRING",
                "log": "BOOLEAN",
                "tag_with_date": "BOOLEAN",
                "tag_with_revision": "BOOLEAN",
                "tags": [
                    "STRING"
                ],
                "version": "STRING",
                "working_directory": "PATH",
                "env_variables": [ // TODO: Rename to "environment_variables"
                    {
                        "key": "STRING",
                        "val": "STRING" // TODO: Rename to "value"
                    }
                ],
                "ignore": [
                    "STRING"
                ],
                "scripts": [
                    {
                        "key": "STRING",
                        "cmd": "BOOLEAN",
                        "contents": [
                            "STRING"
                        ],
                        "language": "STRING",
                        "name": "STRING"
                    }
                ],
                "operations": [
                    {
                        "type": "STRING",
                        "packages_source": "STRING",
                        "contents": [
                            "STRING"
                        ],
                        "packages": [
                            "STRING"
                        ],
                        "channels": [
                            "STRING"
                        ],
                        "description": "STRING",
                        "commands": [
                            "STRING"
                        ],
                        "update": "BOOLEAN",
                        "append": "BOOLEAN",
                        "destination": "PATH",
                        "path": "PATH",
                        "source": "PATH",
                        "permissions": "STRING",
                        "workdir": "STRING"
                    },
                ],
                "nginx": {
                    "servers": [
                        {
                            "access_log": "PATH",
                            "error_log": "PATH",
                            "locations": [
                                {
                                    "location": "PATH",
                                    "location_params": [
                                        "STRING"
                                    ],
                                    "pass_through": "URL",
                                    "uwsgi_pass": "STRING"
                                }
                            ],
                            "port": "NUMBER",
                            "ssl": {
                                "certificate": "PATH",
                                "key": "PATH"
                            }
                        }
                    ],
                    "daemon_off": "BOOLEAN"
                },
                "tests": [
                    {
                        "name": "STRING",
                        "type": "STRING",
                        "url": "STRING",
                        "method": "STRING",
                        "request_data": "ANY",
                        "expected": "STRING"
                    }
                ]
            },
            "args": [ // TODO: Rename to "arguments"
                {
                    "key": "STRING",
                    "val": "STRING", // TODO: Rename to "value"
                    "type": "STRING"
                }
            ],
            "build_folder": "STRING",
            "other_repositories": [
                {
                    "type": "STRING"
                }
            ],
            "password": "STRING",
            "username": "STRING",
            "organization": "STRING"
        },
        "service": {
            "run": {
                "cmd": "STRING",
                "cwd": "STRING",
                "args": [
                    "STRING"
                ]
            },
            "task_definition": {
                "name": "STRING",
                "environment_variables": [
                    {
                        "key": "STRING",
                        "value": "STRING"
                    }
                ]
            },
            "filesystem": [
                {
                    "contents": [
                        "STRING"
                    ],
                    "source": "PATH",
                    "destination": "PATH",
                    "path": "PATH",
                    "type": "STRING",
                    "on_open": "BOOLEAN",
                    "on_close": "BOOLEAN",
                    "on_setup": "BOOLEAN",
                    "overwrite": "BOOLEAN"
                }
            ],
            "clusters": [
                {
                    "default": "BOOLEAN",
                    "environment": "STRING",
                    "url": "STRING",
                    "vpc_name": "STRING",
                    "launch_configuration": {
                        "name": "STRING",
                        "security_groups": [
                            "STRING"
                        ]
                    },
                    "load_balancer_name": "STRING",
                    "load_balancer": {
                        "name": "STRING",
                        "subnets": [
                            "STRING"
                        ],
                        "security_groups": [
                            "STRING"
                        ],
                        "tags": [
                            {
                                "key": "STRING",
                                "val": "STRING" // TODO: Rename to "value"
                            }
                        ],
                        "ports": [
                            {
                                "protocol": "STRING",
                                "load_balancer_port": "NUMBER",
                                "instance_protocol": "STRING",
                                "instance_port": "NUMBER",
                                "ssl_certificate_id": "arn:aws:iam::123456789012:server-certificate/my-server-cert"
                            }
                        ],
                        "healthcheck": {
                            "target": "STRING",
                            "interval": "NUMBER",
                            "timeout": "NUMBER",
                            "unhealthy_threshold": "NUMBER",
                            "healthy_threshold": "NUMBER"
                        }
                    },
                    "auto_scaling_group": {
                        "name": "STRING",
                        "health_check_grace_period": "NUMBER",
                        "subnets": [
                            "STRING"
                        ]
                    },
                    "name": "STRING",
                    "service_name": "STRING",
                    "identity_file": "STRING",
                    "instance": {
                        "count": "NUMBER",
                        "type": "STRING",
                        "tags": [
                            {
                                "key": "STRING",
                                "val": "STRING" // TODO: Rename to "value"
                            }
                        ],
                        "volumes": [
                            {
                                "DeviceName": "STRING",
                                "Ebs": {
                                    "Encrypted": "BOOLEAN",
                                    "DeleteOnTermination": "BOOLEAN",
                                    "SnapshotId": "STRING",
                                    "VolumeSize": "NUMBER",
                                    "VolumeType": "STRING"
                                }
                            }
                        ],
                        "ami": "STRING",
                        "iam_role": "STRING",
                        "user_data": [
                            "STRING"
                        ]
                    }
                }
            ],
            "name": "STRING"
        }
    };
}

// ******************************

function getDeprecatedSchemaKeys () {
    return {
        "service.task_definition_name": "service.task_definition.name"
    }
}

// ******************************
// Exports:
// ******************************

module.exports['get'] = getServiceSchema;
module.exports['getDeprecatedSchemaKeys'] = getDeprecatedSchemaKeys;

// ******************************
