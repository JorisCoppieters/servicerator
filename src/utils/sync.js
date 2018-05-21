'use strict'; // JS: ES6

// ******************************
// Requires:
// ******************************

let cprint = require('color-print');

// ******************************
// Functions:
// ******************************

function runGenerator (generatorFunction) {
    let next = function (err, arg) {
        if (err) return it.throw(err);

        let result = it.next(arg);
        if (result.done) return;

        if (result.value && result.value.then) {
            result.value
                .then((resolveResult) => {
                    next(null, resolveResult);
                })
                .catch((rejectResult) => {
                    next(rejectResult, null);
                });
        } else {
            next(null, result.value);
        }
    };

    let it = generatorFunction();
    return next();
}


// ******************************

function runTasks(tasks) {
    if (!tasks || !tasks.length) {
        return false;
    }

    let taskIdx = 0;

    let onTaskSuccess = () => {
        runNextTask();
    };
    let onTaskError = e => {
        cprint.red('Failed to run task' + (e ? ': ' + e : ''));
    };

    let runNextTask = () => {
        let task = tasks[taskIdx++];
        if (!task) {
            return;
        }
        task(onTaskSuccess, onTaskError);
    };

    runNextTask();
    return true;
}

// ******************************
// Exports:
// ******************************

module.exports['runGenerator'] = runGenerator;
module.exports['runTasks'] = runTasks;

// ******************************
