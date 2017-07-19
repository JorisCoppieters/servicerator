'use strict'; // JS: ES5

// ******************************
// Requries:
// ******************************

var cprint = require('color-print');
var path = require('path');

// ******************************
// Functions:
// ******************************

function getServiceConfig (in_folderName) {
    let imageName = path.basename(in_folderName);
    // let serviceName =
    //     imageName
    //         .replace(/([a-z]+)-.*/g,'$1') + '-' +
    //     imageName
    //         .replace(/-([a-z])[a-z]+/g,'-$1')
    //         .replace(/^[a-z]+-/,'')
    //         .replace(/-/g,'');

    let serviceName =
        imageName
            .replace(/to/,'2')
            .replace(/-([a-z])[a-z]+/g,'-$1')
            .replace(/^([a-z])[a-z]+-/,'$1-')
            .replace(/-/g,'');

    let serviceTestUrl = 'https://' + serviceName + '.test.my-services-url.com';
    let serviceProdUrl = 'https://' + serviceName + '.my-services-url.com';

    return {
        'model':{
            'version': '1.0.0',
            'type': 'bundled'
        },
        'corpus':{
            'version': '1.0.0'
        },
        'service' : {
            'name': serviceName,
            'urls': [
                {'env': 'test', 'val': serviceTestUrl},
                {'env': 'prod', 'val': serviceProdUrl}
            ],
            'cluster': {
                'instance': {
                    'count': 2,
                    'type': 't2.small',
                    'volume_size': 58
                }
            }
        },
        'docker': {
            'username': 'my-docker-username',
            'image': {
                'base':'ubuntu:trusty',
                'name': imageName,
                'tags': [
                    'latest',
                    '1.0.0',
                    'model_1.0.0'
                ],
                'apt_get_packages': [
                    'htop',
                    'unzip',
                    'nano',
                    'jp2a'
                ],
                'pip_packages': [
                    'psutil',
                    'flask',
                    'flask_cors'
                ],
                'version': '1.0.0',
                'env_variables': [
                    {key:'BASE_DIR', val:'/root'},
                    {key:'PYTHON_DIR', val:'$BASE_DIR/python'},
                    {key:'MODEL_DIR', val:'$BASE_DIR/model'},
                    {key:'AUTH_DIR', val:'$BASE_DIR/auth'}
                ],
                'filesystem': [
                    {
                        'path': '$PYTHON_DIR',
                        'type': 'folder'
                    },
                    {
                        'source': 'python',
                        'destination': '$PYTHON_DIR',
                        'type': 'copy_folder'
                    },
                    {
                        'path': '$MODEL_DIR',
                        'type': 'folder'
                    },
                    {
                        'source': '/model',
                        'destination': '$MODEL_DIR',
                        'type': 'link'
                    },
                    {
                        'source': 'bundled_model',
                        'destination': '$MODEL_DIR',
                        'type': 'copy_folder'
                    },
                    {
                        'path': '$AUTH_DIR',
                        'type': 'folder'
                    },
                    {
                        'source': 'auth',
                        'destination': '$AUTH_DIR',
                        'type': 'copy_folder'
                    },
                    {
                        'path': '/var/log/tm-services/$SERVICE_NAME',
                        'type': 'folder'
                    },
                    {
                        'path': '/var/log/tm-services/$SERVICE_NAME/api.log',
                        'type': 'file'
                    }
                ],
                'nginx': true,
                'log': true,
                'env': 'python'
            },
            'container': {
                'memory_limit': 1500,
                'cpu_core_count': 1,
                'ports': [
                    {'number':5000, 'description': 'flask_http', 'secure': false},
                    {'number':5100, 'description': 'nginx_http', 'secure': false},
                    {'number':5200, 'description': 'nginx_https','secure': true}
                ],
                'commands': [
                    {'type':'python_start', 'needs_nginx': true, 'env':'test', 'val':'$BASE_DIR/start-test.sh', 'cmd': true},
                    {'type':'python_start', 'needs_nginx': true, 'env':'prod', 'val':'$BASE_DIR/start-prod.sh'},
                ]
            },
            'build': {
                'env': 'bash'
            }
        }
    };
}

// ******************************
// Exports:
// ******************************

module.exports['getConfig'] = getServiceConfig;

// ******************************
