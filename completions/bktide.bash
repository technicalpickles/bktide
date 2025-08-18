#!/bin/bash
# Bash completions for bktide CLI
# Install by adding to ~/.bashrc: source <(bktide completions bash)
# Or copy to /etc/bash_completion.d/bktide

_bktide() {
    local cur prev words cword
    _init_completion || return

    local commands="viewer orgs pipelines builds token annotations completions boom"
    local global_opts="--log-level --debug --no-cache --cache-ttl --clear-cache --token --save-token --format --color --quiet --tips --no-tips --ascii --help --version"
    
    # First argument - complete with commands
    if [[ $cword -eq 1 ]]; then
        COMPREPLY=( $(compgen -W "$commands" -- "$cur") )
        return 0
    fi

    local cmd="${words[1]}"
    
    # Handle global options
    case "$prev" in
        --log-level)
            COMPREPLY=( $(compgen -W "trace debug info warn error fatal" -- "$cur") )
            return 0
            ;;
        --format|-f)
            COMPREPLY=( $(compgen -W "plain json alfred" -- "$cur") )
            return 0
            ;;
        --color)
            COMPREPLY=( $(compgen -W "auto always never" -- "$cur") )
            return 0
            ;;
    esac

    # Command-specific completions
    case "$cmd" in
        pipelines)
            local opts="--org --count --filter $global_opts"
            if [[ "$prev" == "--org" || "$prev" == "-o" ]]; then
                # Dynamic org completion (if bktide is working)
                local orgs=$(bktide orgs --format json --quiet 2>/dev/null | jq -r '.[].slug' 2>/dev/null)
                if [[ -n "$orgs" ]]; then
                    COMPREPLY=( $(compgen -W "$orgs" -- "$cur") )
                    return 0
                fi
            fi
            COMPREPLY=( $(compgen -W "$opts" -- "$cur") )
            ;;
            
        builds)
            local opts="--org --pipeline --branch --state --count --page --filter $global_opts"
            case "$prev" in
                --org|-o)
                    # Dynamic org completion
                    local orgs=$(bktide orgs --format json --quiet 2>/dev/null | jq -r '.[].slug' 2>/dev/null)
                    if [[ -n "$orgs" ]]; then
                        COMPREPLY=( $(compgen -W "$orgs" -- "$cur") )
                        return 0
                    fi
                    ;;
                --pipeline|-p)
                    # Dynamic pipeline completion
                    local pipelines=$(bktide pipelines --format json --quiet 2>/dev/null | jq -r '.[].slug' 2>/dev/null)
                    if [[ -n "$pipelines" ]]; then
                        COMPREPLY=( $(compgen -W "$pipelines" -- "$cur") )
                        return 0
                    fi
                    ;;
                --branch|-b)
                    # Git branches if in a repo
                    local branches="main master develop staging production"
                    if git rev-parse --git-dir &>/dev/null; then
                        branches="$branches $(git branch -r 2>/dev/null | sed 's/.*origin\///' | grep -v HEAD)"
                    fi
                    COMPREPLY=( $(compgen -W "$branches" -- "$cur") )
                    return 0
                    ;;
                --state|-s)
                    COMPREPLY=( $(compgen -W "running scheduled passed failing failed canceled blocked canceling skipped not_run" -- "$cur") )
                    return 0
                    ;;
            esac
            COMPREPLY=( $(compgen -W "$opts" -- "$cur") )
            ;;
            
        token)
            local opts="--check --store --reset $global_opts"
            COMPREPLY=( $(compgen -W "$opts" -- "$cur") )
            ;;
            
        annotations)
            local opts="--context $global_opts"
            COMPREPLY=( $(compgen -W "$opts" -- "$cur") )
            ;;
            
        completions)
            if [[ $cword -eq 2 ]]; then
                COMPREPLY=( $(compgen -W "fish bash zsh" -- "$cur") )
            else
                COMPREPLY=( $(compgen -W "$global_opts" -- "$cur") )
            fi
            ;;
            
        boom)
            local opts="--type $global_opts"
            if [[ "$prev" == "--type" ]]; then
                COMPREPLY=( $(compgen -W "basic api object" -- "$cur") )
                return 0
            fi
            COMPREPLY=( $(compgen -W "$opts" -- "$cur") )
            ;;
            
        *)
            COMPREPLY=( $(compgen -W "$global_opts" -- "$cur") )
            ;;
    esac
}

# Register completions for both bktide and bin/bktide
complete -F _bktide bktide
complete -F _bktide bin/bktide

