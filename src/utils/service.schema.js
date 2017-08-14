'use strict'; // JS: ES6

// ******************************
// Functions:
// ******************************

function getServiceSchema () {
    return {
        "auth": {
            "certificate": "STRING",
            "key": "STRING",
            "rootCAKey": "PATH",
            "rootCACertificate": "PATH",
            "type": "STRING"
        },
        "aws": {
            "__allow_prod_access__": "BOOLEAN",
            "account_id": "NUMBER",
            "access_key": "STRING",
            "secret_key": "STRING",
            "region": "STRING"
        },
        "build": {
            "language": "STRING"
        },
        "corpus": {
            "version": "STRING"
        },
        "cwd": "STRING",
        "docker": {
            "container": {
                "commands": [
                    {
                        "env": "STRING",
                        "val": "STRING"
                    }
                ],
                "cpu_core_count": "NUMBER",
                "name": "STRING",
                "memory_limit": "NUMBER",
                "ports": [
                    {
                        "container": "NUMBER",
                        "host": "NUMBER",
                        "env": "STRING"
                    }
                ],
                "volumes": [
                    {
                        "container": "STRING",
                        "host": "STRING",
                        "name": "STRING"
                    }
                ]
            },
            "image": {
                "apt_get_packages": [
                    "STRING"
                ],
                "apt_get_update": "BOOLEAN",
                "base": "STRING",
                "commands": [
                    "STRING"
                ],
                "env_variables": [
                    {
                        "key": "STRING",
                        "val": "STRING"
                    }
                ],
                "filesystem": [
                    {
                        "contents": [
                            "STRING"
                        ],
                        "destination": "PATH",
                        "path": "PATH",
                        "permissions": "STRING",
                        "source": "PATH",
                        "type": "STRING"
                    }
                ],
                "language": "STRING",
                "log": "BOOLEAN",
                "name": "STRING",
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
                "pip_packages": [
                    "STRING"
                ],
                "pip_update": "BOOLEAN",
                "conda_channels": [
                    "STRING"
                ],
                "conda_packages": [
                    "STRING"
                ],
                "conda_update": "BOOLEAN",
                "npm_packages": [
                    "STRING"
                ],
                "ports": [
                    "NUMBER"
                ],
                "scripts": [
                    {
                        "key": "STRING",
                        "cmd": "BOOLEAN",
                        "commands": [
                            "STRING"
                        ],
                        "language": "STRING",
                        "name": "STRING"
                    }
                ],
                "tag_with_date": "BOOLEAN",
                "tags": [
                    "STRING"
                ],
                "version": "STRING",
                "working_directory": "PATH",
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
            "other_repositories": [
                {
                    "type": "STRING"
                }
            ],
            "password": "STRING",
            "username": "STRING"
        },
        "model": {
            "source": "STRING",
            "type": "STRING",
            "version": "STRING"
        },
        "service": {
            "run": {
                "cmd": "STRING",
                "args": [
                    "STRING"
                ]
            },
            "task_definition_name": "STRING",
            "filesystem": [
                {
                    "contents": [
                        "STRING"
                    ],
                    "path": "PATH",
                    "type": "STRING"
                }
            ],
            "clusters": [
                {
                    "environment": "STRING",
                    "url": "STRING",
                    "vpc_name": "STRING",
                    "vpc_subnet_name": "STRING",
                    "launch_configuration_name": "STRING",
                    "load_balancer_name": "STRING",
                    "auto_scaling_group_name": "STRING",
                    "name": "STRING",
                    "service_name": "STRING",
                    "identity_file": "STRING",
                    "instance": {
                        "count": "NUMBER",
                        "type": "STRING",
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
// Exports:
// ******************************

module.exports['get'] = getServiceSchema;

// ******************************
