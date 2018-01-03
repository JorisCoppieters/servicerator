'use strict'; // JS: ES6

// ******************************
// Requires:
// ******************************

let fs = require('../utils/filesystem');
let env = require('../utils/env');

// ******************************
// Functions:
// ******************************

function installAllFiles (in_overwrite) {
    installZshCompletionFile(in_overwrite);
    installBashCompletionFile(in_overwrite);
}

// ******************************

function installZshCompletionFile (in_overwrite) {
    let path = require('path');

    let plugins = env.getPlugins();

    let shellHome = env.getShellHome();

    let zshCompletionFolder = path.resolve(shellHome, '.oh-my-zsh/completions');
    fs.setupFolder('zsh completions folder', zshCompletionFolder);

    let appName = 'svr';
    if (env.isDevelopment()) {
        appName = 'dsvr';
    }

    let zshCompletionFile = path.resolve(zshCompletionFolder, '_servicerator_' + appName);
    let zshCompletionFileLines = [];

    zshCompletionFileLines = zshCompletionFileLines.concat([
        `#compdef ${appName}`,
        `_${appName}() {`,
        '    local curcontext="$curcontext" state line',
        '    typeset -A opt_args',

        '    _arguments -C \\',
        '        \'1: :->command\' \\',
        '        \'2: :->subcommand\' \\',
        '        \'3: :->args\' \\',
        '    && ret=0',

        '    case $state in',
        '    command)',
        '        local commands; commands=('
    ]);

    let topLevelCommands = [
        '\'--help:Show this menu\'',
        '\'--version:Print the version\''
    ];

    plugins.forEach(p => {
        if (!p.getBaseCommands) {
            return;
        }
        topLevelCommands.push('\'' + p.getBaseCommands()[0] + ':' + p.getTitle() + ' Commands\'');
    });

    zshCompletionFileLines = zshCompletionFileLines.concat(topLevelCommands
        .map(command => `            ${command}`));

    zshCompletionFileLines = zshCompletionFileLines.concat([
        '        )',
        '        _describe -t commands \'command\' commands && ret=0',
        '    ;;',
        '    subcommand)',
        '        case $words[2] in'
    ]);

    let subCommandBlocks = [];

    plugins.forEach(p => {
        if (!p.getBaseCommands || !p.getCommands) {
            return;
        }

        let baseCommand = p.getBaseCommands()[0];

        let subCommandBlock = [
            `${baseCommand})`,
            '    local subcommands; subcommands=('
        ];

        let subCommands = [];

        p.getCommands().forEach(command => {
            let params = command.params;
            let firstParam = params[0];
            if (firstParam === '') {
                if (!params[1]) {
                    return;
                }
                firstParam = params[1];
            }

            subCommands.push(firstParam + ':' + command.description);
        });

        subCommands.push('help:Print help menu');

        subCommandBlock = subCommandBlock.concat(subCommands
            .map(command => `        '${command}'`));

        subCommandBlock = subCommandBlock.concat([
            '    )',
            '    _describe -t subcommands \'subcommand\' subcommands && ret=0'
        ]);

        subCommandBlocks.push(subCommandBlock);
    });

    let subCommandBlocksContents = subCommandBlocks
        .map(block => block
            .map(blockLine => `        ${blockLine}`)
            .join('\n'))
        .join('\n        ;;\n');

    zshCompletionFileLines = zshCompletionFileLines.concat([subCommandBlocksContents]);

    zshCompletionFileLines = zshCompletionFileLines.concat([
        '        esac',
        '    ;;',
        '    args)',
        '        case $words[2]"-"$words[3] in'
    ]);

    let subCommandArgumentsBlocks = [];

    plugins.forEach(p => {
        if (!p.getBaseCommands || !p.getCommands) {
            return;
        }

        let baseCommand = p.getBaseCommands()[0];

        p.getCommands().forEach(command => {
            if (!command.options) {
                return;
            }

            let params = command.params;
            let firstParam = params[0];
            if (firstParam === '') {
                if (!params[1]) {
                    return;
                }
                firstParam = params[1];
            }

            let subCommandArgument = baseCommand + '-' + firstParam;
            let subCommandArguments = [];

            command.options
                .forEach(option => {
                    let optionParam = option.param;
                    let optionParamPrefix = (optionParam.length > 1 ? '--' : '-');
                    if (optionParam.match(/^\+.*/)) {
                        optionParamPrefix = '';
                    }

                    optionParam = optionParamPrefix + optionParam;

                    let optionDescription = option.description;

                    subCommandArguments.push(optionParam + ':' + optionDescription);
                });

            if (!subCommandArguments.length) {
                return;
            }

            let subCommandArgumentsBlock = [
                `${subCommandArgument})`,
                '    local arguments; arguments=('
            ];

            subCommandArgumentsBlock = subCommandArgumentsBlock.concat(subCommandArguments
                .map(argument => `        "${argument}"`));

            subCommandArgumentsBlock = subCommandArgumentsBlock.concat([
                '    )',
                '    _describe -t arguments \'argument\' arguments && ret=0'
            ]);

            subCommandArgumentsBlocks.push(subCommandArgumentsBlock);
        });
    });

    let subCommandArgumentsBlocksContents = subCommandArgumentsBlocks
        .map(block => block
            .map(blockLine => `        ${blockLine}`)
            .join('\n'))
        .join('\n        ;;\n');

    zshCompletionFileLines = zshCompletionFileLines.concat([subCommandArgumentsBlocksContents]);

    zshCompletionFileLines = zshCompletionFileLines.concat([
        '        esac',
        '    esac',
        '}',
        `_${appName} "$@"`
    ]);

    let zshCompletionFileContents = zshCompletionFileLines.join('\n');
    fs.setupFile('zsh completion file', zshCompletionFile, zshCompletionFileContents, {
        overwrite: in_overwrite
    });
}

// ******************************

function installBashCompletionFile (in_overwrite) {
    let path = require('path');

    let plugins = env.getPlugins();

    let shellHome = env.getShellHome();

    let bashCompletionFolder = path.resolve(shellHome, '.bash-completions');
    fs.setupFolder('bash completions folder', bashCompletionFolder);

    let appName = 'svr';
    if (env.isDevelopment()) {
        appName = 'dsvr';
    }

    let bashCompletionFile = path.resolve(bashCompletionFolder, 'servicerator-' + appName);
    let bashCompletionFileLines = [];

    bashCompletionFileLines = bashCompletionFileLines.concat([
        '# Check for bash',
        '[ -z "$BASH_VERSION" ] && return',
        '',
        '####################################################################################################',
        '',
        '__app() {',
        '  case "${COMP_CWORD}" in',
        '    1)'
    ]);

    let topLevelCommands = [
        '--help',
        '--version'
    ];

    plugins.forEach(p => {
        if (!p.getBaseCommands) {
            return;
        }
        topLevelCommands.push(p.getBaseCommands()[0]);
    });

    let topLevelCommandsRow = topLevelCommands.join(' ');

    bashCompletionFileLines = bashCompletionFileLines.concat([
        `      COMPREPLY=($(compgen -W "${topLevelCommandsRow}" -- "\${COMP_WORDS[1]}"))`,
        '      return 0',
        '      ;;',
        '',
        '    2)',
        '      case "${COMP_WORDS[1]}" in'
    ]);

    plugins.forEach(p => {
        if (!p.getBaseCommands || !p.getCommands) {
            return;
        }

        let baseCommand = p.getBaseCommands()[0];

        let subCommands = [];

        p.getCommands().forEach(command => {
            let params = command.params;
            let firstParam = params[0];
            if (firstParam === '') {
                if (!params[1]) {
                    return;
                }
                firstParam = params[1];
            }

            subCommands.push(firstParam);
        });

        subCommands.push('help');

        let subCommandsRow = subCommands.join(' ');

        bashCompletionFileLines = bashCompletionFileLines.concat([
            `        ${baseCommand})`,
            `          COMPREPLY=($(compgen -W "${subCommandsRow}" -- "\${COMP_WORDS[2]}"))`,
            '          return 0',
            '          ;;',
            ''
        ]);
    });

    bashCompletionFileLines = bashCompletionFileLines.concat([
        '        *)',
        '          COMPREPLY=()',
        '          return 0',
        '          ;;',
        '      esac',
        '      ;;',
        '',
        '    3)',
        '      case "${COMP_WORDS[1]}-${COMP_WORDS[2]}" in'
    ]);


    plugins.forEach(p => {
        if (!p.getBaseCommands || !p.getCommands) {
            return;
        }

        let baseCommand = p.getBaseCommands()[0];

        p.getCommands().forEach(command => {
            if (!command.options) {
                return;
            }

            let params = command.params;
            let firstParam = params[0];
            if (firstParam === '') {
                if (!params[1]) {
                    return;
                }
                firstParam = params[1];
            }

            let subCommandArgument = baseCommand + '-' + firstParam;
            let subCommandArguments = [];

            command.options
                .forEach(option => {
                    let optionParam = option.param;
                    let optionParamPrefix = (optionParam.length > 1 ? '--' : '-');
                    if (optionParam.match(/^\+.*/)) {
                        optionParamPrefix = '';
                    }

                    optionParam = optionParamPrefix + optionParam;

                    subCommandArguments.push(optionParam);
                });

            if (!subCommandArguments.length) {
                return;
            }

            let subCommandArgumentsRow = subCommandArguments.join(' ');

            bashCompletionFileLines = bashCompletionFileLines.concat([
                `        ${subCommandArgument})`,
                `          COMPREPLY=($(compgen -W "${subCommandArgumentsRow}" -- "\${COMP_WORDS[3]}"))`,
                '          return 0',
                '          ;;'
            ]);
        });
    });

    bashCompletionFileLines = bashCompletionFileLines.concat([
        '',
        '        *)',
        '          COMPREPLY=()',
        '          return 0',
        '          ;;',
        '      esac',
        '      ;;',
        '',
        '  esac',
        '}',
        '',
        '####################################################################################################',
        '',
        `complete -F __app ${appName}`
    ]);

    let bashCompletionFileContents = bashCompletionFileLines.join('\n');
    fs.setupFile('bash completion file', bashCompletionFile, bashCompletionFileContents, {
        overwrite: in_overwrite
    });
}

// ******************************
// Plugin Functions:
// ******************************

function handleCommand (in_args, in_params) {
    let command = in_params.length ? in_params.shift().toLowerCase() : '';
    let overwrite = in_args['overwrite'];
    switch(command)
    {
    case '':
    case 'all':
        installAllFiles(overwrite);
        break;
    case 'zsh-completion':
        installZshCompletionFile(overwrite);
        break;
    case 'bash-completion':
        installBashCompletionFile(overwrite);
        break;
    default:
        return false;
    }
    return true;
}

// ******************************

function getBaseCommands () {
    return ['install'];
}

// ******************************

function getCommands () {
    return [
        { params: ['', 'all'], description: 'Install all servicerator files', options: [
            {param:'overwrite', description:'Overwrite any files that exist'}
        ] },
        { params: ['zsh-completion', 'zsh'], description: 'Install zsh completion file', options: [
            {param:'overwrite', description:'Overwrite any files that exist'}
        ] },
        { params: ['bash-completion', 'bash'], description: 'Install bash completion file', options: [
            {param:'overwrite', description:'Overwrite any files that exist'}
        ] }
    ];
}

// ******************************

function getTitle () {
    return 'Install';
}

// ******************************
// Exports:
// ******************************

module.exports['handleCommand'] = handleCommand;
module.exports['getBaseCommands'] = getBaseCommands;
module.exports['getCommands'] = getCommands;
module.exports['getTitle'] = getTitle;
module.exports['noConfigRequired'] = true;

// ******************************
