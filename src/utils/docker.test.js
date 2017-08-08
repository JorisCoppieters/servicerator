'use strict'; // JS: ES6

// ******************************
// Requires:
// ******************************

let path = require('path');
let cprint = require('color-print');

let date = require('./date');
let docker = require('./docker');
let env = require('./env');
let fs = require('./filesystem');
let test = require('./test');

// ******************************
// Functions:
// ******************************

function runTests () {
    let tempFolder = env.getTemp();
    if (!tempFolder || !fs.folderExists(tempFolder)) {
        cprint.red('Failed to access temp folder, cannot run tests');
        return;
    }

    let tempDockerFolder = fs.createFolder(path.resolve(env.getTemp(), 'docker.test'));
    let tempDockerFile = fs.writeFile(path.resolve(tempDockerFolder, 'Dockerfile'), [
        `FROM ubuntu:trusty`
    ].join('\n'));

    cprint.magenta('Running docker util tests...');
    test.assertMatch('docker folder', '.*docker\.test', docker.getFolder(tempDockerFolder));
    test.assertMatch('docker file', '.*\\Dockerfile', docker.getDockerfile(tempDockerFolder));
    test.assertMatch('docker password', '.+', docker.getPassword({
        docker: {
            username: 'trademe'
        }
    }));
    test.assertEquals('basic docker file parse', {"docker":{"image":{"base":"ubuntu:trusty"}}}, docker.parseDockerfileContents([
        '# ----------------------',
        '#',
        '# BASE',
        '#',
        '# ----------------------',
        '',
        '    FROM ubuntu:trusty',
        '',
        '# ----------------------',
        '#',
        '# ENVIRONMENT',
        '#',
        '# ----------------------'
    ].join('\n')));
    test.assertMatch('docker default repository', '.+', docker.getDefaultRepository());
    test.assertMatch('docker version', 'Docker version .*, build .*', docker.version());
    test.assertEquals('docker file for empty config', [
        '# ----------------------',
        '#',
        '# BASE',
        '#',
        '# ----------------------',
        '',
        '    FROM ubuntu:trusty',
        '',
        '# ----------------------',
        '#',
        '# ENVIRONMENT',
        '#',
        '# ----------------------'
    ].join('\n'), docker.getDockerfileContents({}));
    test.assertEquals('docker file with service configured', [
        '# ----------------------',
        '#',
        '# BASE',
        '#',
        '# ----------------------',
        '',
        '    FROM ubuntu:trusty',
        '',
        '# ----------------------',
        '#',
        '# ENVIRONMENT',
        '#',
        '# ----------------------',
        '',
        '    ENV SERVICE_NAME "test-service"',
        '    ENV BASE_DIR "mydir"',
        '',
        '# ----------------------',
        '#',
        '# WORKDIR',
        '#',
        '# ----------------------',
        '',
        '    WORKDIR $BASE_DIR'
    ].join('\n'), docker.getDockerfileContents({
        service: {
            name: 'test-service',
        },
        docker: {
            image: {
                env_variables: [
                    {
                        key: 'SERVICE_NAME',
                        val: 'test-service'
                    },
                    {
                        key: 'BASE_DIR',
                        val: 'mydir'
                    }
                ],
                working_directory: 'mydir'
            }
        }
    }));
    test.assertEquals('docker ignore contents for empty config', '', docker.getIgnoreDockerContents());
    test.assertEquals('docker ignore contents with model', 'model/*', docker.getIgnoreDockerContents({
        model: {
            version: '1.2.3'
        }
    }));
    test.assertEquals('docker ignore contents with node as language', 'node/node_modules/*', docker.getIgnoreDockerContents({
        docker: {
            image: {
                language: 'node'
            }
        }
    }));
    test.assertEquals('docker ignore contents with python as language', '*.pyc', docker.getIgnoreDockerContents({
        docker: {
            image: {
                language: 'python'
            }
        }
    }));
    test.assertEquals('docker ignore contents with logging', 'logs/*', docker.getIgnoreDockerContents({
        docker: {
            image: {
                log: true
            }
        }
    }));
    test.assertEquals('docker ignore contents with bash as build language', [
        'setup-aws-infrastructure.sh',
        'create-docker-image.sh',
        '_env.sh'
    ].join('\n'), docker.getIgnoreDockerContents({
        build: {
            language: 'bash'
        }
    }));
    test.assertEquals('docker ignore contents with all', [
        'node/node_modules/*',
        'logs/*',
        'setup-aws-infrastructure.sh',
        'create-docker-image.sh',
        '_env.sh',
        'model/*'
    ].join('\n'), docker.getIgnoreDockerContents({
        auth: {
            certificate: 'mycert'
        },
        model: {
            version: '1.2.3'
        },
        corpus: {
            version: '1.2.3'
        },
        docker: {
            image: {
                language: 'node',
                log: true
            },
        },
        build: {
            language: 'bash'
        }
    }));
    test.assertEquals('docker tags for empty config', ['latest'], docker.getImageTags());
    test.assertEquals('docker tags for config with model', ['model-version-1.2.3', 'latest'], docker.getImageTags({
        model: {
            version: '1.2.3'
        }
    }));
    test.assertEquals('docker tags for config with corpus', ['corpus-version-4.5.6', 'latest'], docker.getImageTags({
        corpus: {
            version: '4.5.6'
        }
    }));
    test.assertEquals('docker tags for config with image version', ['7alpha', 'latest'], docker.getImageTags({
        docker: {
            image: {
                version: '7alpha'
            }
        }
    }));
    test.assertEquals('docker tags for config with image tags', ['tag1', 'tag2', 'latest'], docker.getImageTags({
        docker: {
            image: {
                tags: ['tag1', 'tag2']
            }
        }
    }));
    test.assertEquals('docker tags for config with tag_with_date set to true', [date.getTag(), 'latest'], docker.getImageTags({
        docker: {
            image: {
                tag_with_date: true
            }
        }
    }));
    test.assertEquals('docker tags for config with all tags', ['tag1','tag2','7alpha',date.getTag(),'model-version-1.2.3','corpus-version-4.5.6','latest'], docker.getImageTags({
        corpus: {
            version: '4.5.6'
        },
        model: {
            version: '1.2.3'
        },
        docker: {
            image: {
                tag_with_date: true,
                version: '7alpha',
                tags: ['tag1', 'tag2']
            }
        }
    }));

    fs.deleteFolder(tempDockerFolder);
}

// ******************************
// Exports:
// ******************************

module.exports['runTests'] = runTests;

// ******************************
