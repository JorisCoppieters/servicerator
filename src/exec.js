'use strict'; // JS: ES5

// ******************************
// Requries:
// ******************************

let child_process = require('child_process');
let cprint = require('color-print');

let u = require('./utils');
let print = require('./print');

// ******************************
// Functions:
// ******************************

function execCmdSync (in_cmd, in_args, in_indent, in_printCmd) {
    if (in_printCmd) {
        cprint.white('EXEC-SYNC: ' + in_cmd + ' ' + JSON.stringify(in_args));
    }
    let execResult = child_process.spawnSync(in_cmd, in_args);
    let errorResult = execResult.stderr.toString();
    let cmdResult = execResult.stdout.toString();
    let rows = cmdResult.trim().split(/(?:\n|(?:\r\n?))+/);

    return {
        error: errorResult,
        result: cmdResult,
        printError: (in_indent) => cprint.red(u.indentContents(errorResult, in_indent)),
        printResult: (in_indent) => cprint.lightBlue(u.indentContents(cmdResult, in_indent)),
        rows: rows,
        hasError: !!errorResult.trim(),
        toString: () => errorResult.trim() ? errorResult : cmdResult
    };
}

// ******************************

function execCmd (in_cmd, in_args, in_indent, in_printCmd) {
    if (in_printCmd) {
        cprint.white('EXEC: ' + in_cmd + ' ' + JSON.stringify(in_args));
    }
    let indent = in_indent || '  ';
    let child = child_process.spawn(in_cmd, in_args);
    let seenError = false;

    child.stdout.on('data', chunk => {
        if (seenError) {
            return;
        }

        let line = chunk.toString();

        if (line.match(/error/i)) {
            print.out(cprint.toRed(u.indentContents(line, indent) + '\n'));
        } else if (line.match(/warning/i)) {
            print.out(cprint.toYellow(u.indentContents(line, indent) + '\n'));
        } else if (line.match(/success/i)) {
            print.out(cprint.toGreen(u.indentContents(line, indent) + '\n'));
        } else {
            print.out(cprint.toLightBlue(u.indentContents(line, indent) + '\n'));
        }
    });

    child.stderr.on('data', chunk => {
        print.out(cprint.toRed(u.indentContents(chunk, indent) + '\n'));
        seenError = true;
    });

    child.on('error', error => {
        print.out(cprint.toRed(u.indentContents(error, indent) + '\n'));
        seenError = true;
    });
}

// ******************************
// Exports:
// ******************************

module.exports['cmdSync'] = execCmdSync;
module.exports['cmd'] = execCmd;

// ******************************
