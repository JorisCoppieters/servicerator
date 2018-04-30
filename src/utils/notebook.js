'use strict'; // JS: ES6

// ******************************
// Requires:
// ******************************

const cprint = require('color-print');

let fs = require('./filesystem');
let obj = require('./object');

// ******************************
// Functions:
// ******************************

function getNotebookFile (in_sourceFolder) {
    let path = require('path');

    let sourceFolder = path.resolve(in_sourceFolder);
    if (!sourceFolder) {
        cprint.yellow('Source folder not set');
        return;
    }

    let notebookFile = fs.files(sourceFolder)
        .filter(f => f.match(/\.*.ipynb/))
        .map(f => path.resolve(sourceFolder, f))
        .filter(fs.fileExists)
        .filter(fs.isFile)
        .find(() => true);

    return notebookFile;
}

// ******************************

function getNotebookCodeBlocks (in_notebookFile, in_sectionFilter) {
    let notebookContents = fs.readFile(in_notebookFile);
    let notebookData = JSON.parse(notebookContents);

    let codeBlocks = notebookData.cells
        .filter(cell => cell.cell_type === 'code')
        .map(cell => cell.source)
        .map(sourceLines => {
            let codeLines = sourceLines.filter(sourceLine => !sourceLine.match(/^#.*/));

            let metaLines = sourceLines.filter(sourceLine => sourceLine.match(/^#.*/));
            let meta = metaLines
                .map(metaLine => metaLine.match(/^#(.*):(.*)/))
                .filter(matches => matches)
                .map(matches => {
                    return {
                        key: matches[1].trim(),
                        val: matches[2].trim()
                    };
                })
                .map(keyValPair => {
                    if (keyValPair.key === 'section') {
                        keyValPair.key = 'sections';
                    }
                    if (keyValPair.key === 'sections') {
                        keyValPair.val = keyValPair.val.split(',').map(v => v.trim());
                    }

                    if (keyValPair.key === 'input') {
                        keyValPair.key = 'inputs';
                    }
                    if (keyValPair.key === 'inputs') {
                        keyValPair.val = keyValPair.val.split(',').map(v => v.trim());
                    }

                    return keyValPair;
                })
                .reduce((dict, keyValPair) => {
                    dict[keyValPair.key] = keyValPair.val;
                    return dict;
                }, {});

            return {
                meta,
                codeLines
            };
        })
        .filter(codeBlock => {
            if (!in_sectionFilter || !in_sectionFilter.length) {
                return true;
            }

            if (!obj.isArray(in_sectionFilter)) {
                in_sectionFilter = [in_sectionFilter];
            }

            let sections = codeBlock.meta.sections || [];
            return in_sectionFilter.find(sectionFilter => sections.find(section => section.match(sectionFilter)));
        });

    return codeBlocks;
}

// ******************************

function createNotebookTrainingFile (in_sourceFolder) {
    let notebookFile = getNotebookFile(in_sourceFolder);
    if (!notebookFile) {
        return;
    }

    const path = require('path');

    let pythonFolder = path.resolve(path.dirname(notebookFile), 'python');
    fs.setupFolder('Python', pythonFolder);

    let trainingCode = getNotebookCodeBlocks(notebookFile, 'training')
        .map(codeBlocks => codeBlocks.codeLines.map(line => line.trimRight() + '\n').join(''))
        .join('\n\n');
    let trainingFile = path.resolve(pythonFolder, 'train.py');
    trainingCode = '""" Training Script """\n' + trainingCode;
    fs.writeFile(trainingFile, trainingCode, true);

    return trainingFile;
}

// ******************************

function createNotebookCLIFile (in_sourceFolder) {
    let notebookFile = getNotebookFile(in_sourceFolder);
    if (!notebookFile) {
        return;
    }

    const path = require('path');

    let pythonFolder = path.resolve(path.dirname(notebookFile), 'python');
    fs.setupFolder('Python', pythonFolder);

    let cliCode = getNotebookCodeBlocks(notebookFile, ['activation', 'cli'])
        .map(codeBlocks => {
            if (codeBlocks.meta.inputs && codeBlocks.meta.loadFn && codeBlocks.meta.activateFn && codeBlocks.meta.inputFn) {
                let inputs = codeBlocks.meta.inputs;

                return [
                    `print ${codeBlocks.meta.activateFn}(`,
                    `    service_data=${codeBlocks.meta.loadFn}(),`,
                    '    request={',
                    inputs.map(input =>
                        `        "${input}": ${codeBlocks.meta.inputFn + '("' + input + '")'}`
                    ).join(',\n'),
                    '    }',
                    ')'
                ].join('\n');
            }

            return codeBlocks.codeLines.map(line => line.trimRight() + '\n').join('');
        })
        .join('\n\n');
    let cliFile = path.resolve(pythonFolder, 'cli.py');
    cliCode = '""" cli Script """\n' + cliCode + '\n';
    fs.writeFile(cliFile, cliCode, true);

    return cliFile;
}

// ******************************

function createNotebookAPIFile (in_sourceFolder) {
    let notebookFile = getNotebookFile(in_sourceFolder);
    if (!notebookFile) {
        return;
    }

    const path = require('path');

    let pythonFolder = path.resolve(path.dirname(notebookFile), 'python');
    fs.setupFolder('Python', pythonFolder);

    let apiCode = getNotebookCodeBlocks(notebookFile, ['activation', 'api'])
        .map(codeBlocks => {
            if (codeBlocks.meta.inputs && codeBlocks.meta.loadFn && codeBlocks.meta.activateFn && codeBlocks.meta.inputFn) {
                let inputs = codeBlocks.meta.inputs;

                return [
                    `print ${codeBlocks.meta.activateFn}(`,
                    `    service_data=${codeBlocks.meta.loadFn}(),`,
                    '    request={',
                    inputs.map(input =>
                        `        "${input}": ${codeBlocks.meta.inputFn + '("' + input + '")'}`
                    ).join(',\n'),
                    '    }',
                    ')'
                ].join('\n');
            }

            return codeBlocks.codeLines.map(line => line.trimRight() + '\n').join('');
        })
        .join('\n\n');
    let apiFile = path.resolve(pythonFolder, 'api.py');
    apiCode = '""" api Script """\n' + apiCode + '\n';
    fs.writeFile(apiFile, apiCode, true);

    return apiFile;
}

// ******************************
// Exports:
// ******************************

module.exports['getFile'] = getNotebookFile;
module.exports['getCodeBlocks'] = getNotebookCodeBlocks;
module.exports['createTrainingFile'] = createNotebookTrainingFile;
module.exports['createCLIFile'] = createNotebookCLIFile;
module.exports['createAPIFile'] = createNotebookAPIFile;

// ******************************
