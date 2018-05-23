'use strict'; // JS: ES6

// ******************************
// Requires:
// ******************************

let cprint = require('color-print');

let print = require('../utils/print');
let service = require('../utils/service');

// ******************************
// Functions:
// ******************************

function showAllWizard (in_serviceConfig) {
    let serviceConfig = service.accessConfig(in_serviceConfig, {
        docker: {
            image: {
                name: 'STRING',
                version: 'STRING'
            }
        },
        service: {
            name: 'STRING'
        },
        cwd: 'STRING'
    });

    let questions = [
        {
            prompt: 'What is your docker image name',
            currentValue: serviceConfig.docker.image.name,
            path: 'docker.image.name'
        },
        {
            prompt: 'What is your service name',
            currentValue: serviceConfig.service.name,
            path: 'service.name'
        }
    ];

    let questionHandlers = [];

    questions.forEach(simpleQuestion => {
        if (!simpleQuestion.currentValue) {
            let defaultValue = simpleQuestion.defaultValue;
            let prompt = simpleQuestion.prompt;
            if (defaultValue) {
                prompt += ` (default = ${defaultValue})`;
            }
            questionHandlers.push({
                prompt: prompt,
                handler: (answer) => {
                    if (!answer && !defaultValue) {
                        return;
                    }
                    service.setValue(
                        serviceConfig,
                        simpleQuestion.path,
                        answer || defaultValue,
                        {
                            suppressOutput: true
                        }
                    );
                }
            });
        }
    });

    if (!questionHandlers.length) {
        cprint.green('Nothing to do...');
        return;
    }

    _printHeader('...The Magic Wizard...');

    _handleQuestions(questionHandlers, () => {
        cprint.green('Done!');
        // service.updateConfig(in_serviceConfig, serviceConfig);
    });
}

// ******************************
// Helper Functions:
// ******************************

function _printHeader (in_title) {
    print.out('\n');
    cprint.backgroundLightYellow(cprint.toBlack(' '.repeat(in_title.length + 2), true));
    cprint.backgroundLightYellow(cprint.toBlack(' ' + in_title + ' ', true));
    cprint.backgroundLightYellow(cprint.toBlack(' '.repeat(in_title.length + 2), true));
    print.out('\n');
}

// ******************************

function _handleQuestions (in_questions, in_doneCb) {
    let questions = in_questions || [];

    let currentHandler = null;
    let currentQuestionIdx = 0;

    let done = () => {
        if (in_doneCb) {
            in_doneCb();
        }
        process.exit(0);
    };

    let setNextHandler = () => {
        let currentQuestion = questions[currentQuestionIdx++];
        if (!currentQuestion) {
            done();
            return;
        }
        currentHandler = currentQuestion.handler;
        print.out(cprint.toMagenta(currentQuestion.prompt + '? '));
    };

    setNextHandler();

    process.stdin.resume();
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (text) => {
        currentHandler(text.trim());
        setNextHandler();
    });
}

// ******************************

// function _askQuestion (in_prompt, in_handler) {
//     return () => {
//         return new Promise((resolve, reject) => {
//             rl.question(cprint.toMagenta(in_prompt + '? '), (answer) => {
//                 in_handler(answer);
//             });
//         });
//     }
// }

// ******************************
// Plugin Functions:
// ******************************

function handleCommand (in_args, in_params, in_serviceConfig) {
    let command = in_params.length ? in_params.shift().toLowerCase() : '';

    switch(command)
    {
    case '':
    case 'all':
        showAllWizard(in_serviceConfig);
        break;
    default:
        return false;
    }
    return true;
}

// ******************************

function getBaseCommands () {
    return ['configure', 'config'];
}

// ******************************

function getCommands () {
    return [
        { params: ['', 'all'], description: 'Configure service' }
    ];
}

// ******************************

function getTitle () {
    return 'Configure';
}

// ******************************
// Exports:
// ******************************

module.exports['handleCommand'] = handleCommand;
module.exports['getBaseCommands'] = getBaseCommands;
module.exports['getCommands'] = getCommands;
module.exports['getTitle'] = getTitle;

// ******************************
