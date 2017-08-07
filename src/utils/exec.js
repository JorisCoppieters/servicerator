'use strict'; // JS: ES6

// ******************************
// Requires:
// ******************************

let child_process = require('child_process');
let cprint = require('color-print');

let str = require('./string');
let print = require('./print');

let knownErrors = [
    new RegExp(/WARNING: Error loading config file:.* - open .*: The process cannot access the file because it is being used by another process./),
    new RegExp(/Error response from daemon: conflict: unable to delete .* \(cannot be forced\) - image has dependent child images/),
    new RegExp(/Error response from daemon: manifest for .* not found/),
    'Error response from daemon: invalid reference format'
];

// ******************************
// Functions:
// ******************************

function execCmdSync (in_cmd, in_args, in_indent, in_printCmd, in_errToOut, in_knownErrors) {
    in_printCmd = (typeof(in_printCmd) !== 'undefined' ? in_printCmd : true);
    if (in_printCmd) {
        cprint.white('  EXEC-SYNC: ' + in_cmd + ' ' + _flatArgs(in_args));
    }
    let execResult = child_process.spawnSync(in_cmd, in_args);
    let errorResult = (execResult.stderr || false).toString();
    let cmdResult = (execResult.stdout || false).toString();
    let rows = cmdResult.trim().split(/(?:\n|(?:\r\n?))+/);

    if (in_errToOut) {
        cmdResult += errorResult;
        errorResult = '';
    }

    let cmdResultObj = {};
    try {
        cmdResultObj = JSON.parse(cmdResult);
    } catch (e) {}

    return {
        error: errorResult,
        result: cmdResult,
        resultObj: cmdResultObj,
        printError: (in_indent) => cprint.red(str.indentContents(errorResult, in_indent)),
        printResult: (in_indent) => _printLogLines(cmdResult, in_indent, in_knownErrors),
        rows: rows,
        hasError: !!errorResult.trim(),
        toString: () => errorResult.trim() ? errorResult : cmdResult
    };
}

// ******************************

function execCmd (in_cmd, in_args, in_indent, in_printCmd, in_knownErrors, in_doneCb) {
    in_printCmd = (typeof(in_printCmd) !== 'undefined' ? in_printCmd : true);
    if (in_printCmd) {
        cprint.white('  EXEC: ' + in_cmd + ' ' + _flatArgs(in_args));
    }
    let indent = in_indent || '  ';
    let child = child_process.spawn(in_cmd, in_args);

    child.stdout.on('data', chunk => {
        _printLogLine(chunk, indent, in_knownErrors);
    });

    child.stderr.on('data', chunk => {
        _printLogLine(chunk, indent, in_knownErrors);
    });

    child.on('error', error => {
        _printLogLine(error, indent, in_knownErrors);
    });

    child.on('close', close => {
        if (in_doneCb) {
            in_doneCb();
        }
    });
}

// ******************************
// Helper Functions:
// ******************************

function _flatArgs (in_args) {
    let args = [];
    in_args.forEach(a => {
        if (typeof(a) !== 'string') {
            return a;
        }
        if (a.match(/[\s]/)) {
            args.push('\'' + a
                .replace(/([\t])/g, '\\t')
                .replace(/([\n])/g, '\\n')
                .replace(/([\r])/g, '\\r')
                + '\'');
            return;
        }
        if (a.match(/[\\"']/)) {
            args.push('\'' + a + '\'');
            return;
        }
        args.push(a);
    });
    return args.join(' ');
}

// ******************************

function _printLogLines (in_lines, in_indent, in_knownErrors) {
    in_lines
        .split(/(?:\n|(?:\r\n?))+/)
        .forEach(l => _printLogLine(l, in_indent, in_knownErrors));
}

// ******************************

function _printLogLine (in_line, in_indent, in_knownErrors) {
    let line = in_line.toString();
    let indent = in_indent || '';

    if (!line.trim()) {
        return;
    }

    let knownErrorMatch = (in_knownErrors || []).find(e => line.match(e));
    if (knownErrorMatch) {
        return;
    }

    if (line.match(/error[:=-]? /i)) {
        print.out(cprint.toRed(str.indentContents(line, indent) + '\n'));
    } else if (line.match(/error:[0-9]/i)) {
        print.out(cprint.toRed(str.indentContents(line, indent) + '\n'));
    } else if (line.match(/unable to/i)) {
        print.out(cprint.toYellow(str.indentContents(line, indent) + '\n'));
    } else if (line.match(/no such/i)) {
        print.out(cprint.toYellow(str.indentContents(line, indent) + '\n'));
    } else if (line.match(/does not exist/i)) {
        print.out(cprint.toYellow(str.indentContents(line, indent) + '\n'));
    } else if (line.match(/doesn't exist/i)) {
        print.out(cprint.toYellow(str.indentContents(line, indent) + '\n'));
    } else if (line.match(/couldn't/i)) {
        print.out(cprint.toYellow(str.indentContents(line, indent) + '\n'));
    } else if (line.match(/could not/i)) {
        print.out(cprint.toYellow(str.indentContents(line, indent) + '\n'));
    } else if (line.match(/can't/i)) {
        print.out(cprint.toYellow(str.indentContents(line, indent) + '\n'));
    } else if (line.match(/can ?not/i)) {
        print.out(cprint.toYellow(str.indentContents(line, indent) + '\n'));
    } else if (line.match(/warning[:=-]? /i)) {
        print.out(cprint.toYellow(str.indentContents(line, indent) + '\n'));
    } else if (line.match(/warning:[0-9]/i)) {
        print.out(cprint.toYellow(str.indentContents(line, indent) + '\n'));
    } else if (line.match(/success[:=-]? /i)) {
        print.out(cprint.toGreen(str.indentContents(line, indent) + '\n'));
    } else if (line.match(/success:[0-9]/i)) {
        print.out(cprint.toGreen(str.indentContents(line, indent) + '\n'));
    } else if (line.match(/ OK/i) || line.match(/OK /i)) {
        print.out(cprint.toGreen(str.indentContents(line, indent) + '\n'));
    } else {
        print.out(cprint.toLightBlue(str.indentContents(line, indent) + '\n'));
    }
}

// ******************************
// Exports:
// ******************************

module.exports['cmdSync'] = execCmdSync;
module.exports['cmd'] = execCmd;

// ******************************
