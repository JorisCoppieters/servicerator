'use strict'; // JS: ES6

// ******************************
// Requires:
// ******************************

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
    let path = require('path');

    let tempFolder = env.getTemp();
    if (!tempFolder || !fs.folderExists(tempFolder)) {
        throw new Error('Failed to access temp folder, cannot run tests');
    }

    let tempDockerFolder = fs.createFolder(path.resolve(env.getTemp(), 'docker.test'));
    fs.writeFile(path.resolve(tempDockerFolder, 'Dockerfile'), '');

    cprint.magenta('Running docker util tests...');
    test.assertMatch('docker folder', '.*docker.test', docker.getFolder(tempDockerFolder));
    test.assertMatch('docker file', '.*\\Dockerfile', docker.getDockerfile(tempDockerFolder));
    test.assertMatch('docker password', '.+', docker.getPassword({
        docker: {
            username: 'trademe'
        }
    }));
    test.assertMatch('docker default repository', '.+', docker.getDefaultRepositoryStore());
    test.assertMatch('docker version', 'Docker version .*, build .*', docker.version());
    test.assertEquals('docker tags for empty config', ['latest'], docker.getImageTags({}));
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
    test.assertEquals('docker tags for config with image tags', ['latest','tag1', 'tag2'], docker.getImageTags({
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
    test.assertEquals('docker tags for config with all tags', ['7alpha',date.getTag(),'model-version-1.2.3','corpus-version-4.5.6','latest','tag1','tag2'], docker.getImageTags({
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
