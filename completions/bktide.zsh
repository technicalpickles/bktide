#compdef bktide
# Zsh completions for bktide CLI
# Install by adding to ~/.zshrc: source <(bktide completions zsh)
# Or copy to a directory in your $fpath

_bktide() {
    local -a commands global_opts
    
    commands=(
        'viewer:Show logged in user information'
        'orgs:List organizations'
        'pipelines:List pipelines for an organization'
        'builds:List builds for the current user'
        'token:Manage API tokens'
        'annotations:Show annotations for a build'
        'completions:Generate shell completions'
        'boom:Test error handling'
    )
    
    global_opts=(
        '--log-level[Set logging level]:level:(trace debug info warn error fatal)'
        {-d,--debug}'[Show debug information for errors]'
        '--no-cache[Disable caching of API responses]'
        '--cache-ttl[Set cache TTL in milliseconds]:milliseconds:'
        '--clear-cache[Clear all cached data before executing]'
        {-t,--token}'[Buildkite API token]:token:'
        '--save-token[Save the token to system keychain]'
        {-f,--format}'[Output format]:format:(plain json alfred)'
        '--color[Color output mode]:mode:(auto always never)'
        {-q,--quiet}'[Suppress non-error output]'
        '--tips[Show helpful tips and suggestions]'
        '--no-tips[Hide helpful tips and suggestions]'
        '--ascii[Use ASCII symbols instead of Unicode]'
        {-h,--help}'[Show help]'
        {-V,--version}'[Show version]'
    )
    
    # Main command completion
    if (( CURRENT == 2 )); then
        _describe -t commands 'bktide commands' commands
        return
    fi
    
    local cmd="${words[2]}"
    
    # Command-specific completions
    case "$cmd" in
        pipelines)
            _arguments \
                {-o,--org}'[Organization slug]:org:->orgs' \
                {-n,--count}'[Limit to specified number]:count:' \
                '--filter[Filter pipelines by name]:filter:' \
                $global_opts
            
            case "$state" in
                orgs)
                    # Dynamic org completion
                    local -a orgs
                    orgs=(${(f)"$(bktide orgs --format json --quiet 2>/dev/null | jq -r '.[].slug' 2>/dev/null)"})
                    _describe -t orgs 'organizations' orgs
                    ;;
            esac
            ;;
            
        builds)
            _arguments \
                {-o,--org}'[Organization slug]:org:->orgs' \
                {-p,--pipeline}'[Filter by pipeline slug]:pipeline:->pipelines' \
                {-b,--branch}'[Filter by branch name]:branch:->branches' \
                {-s,--state}'[Filter by build state]:state:(running scheduled passed failing failed canceled blocked canceling skipped not_run)' \
                {-n,--count}'[Number of builds per page]:count:' \
                '--page[Page number]:page:' \
                '--filter[Fuzzy filter builds]:filter:' \
                $global_opts
            
            case "$state" in
                orgs)
                    local -a orgs
                    orgs=(${(f)"$(bktide orgs --format json --quiet 2>/dev/null | jq -r '.[].slug' 2>/dev/null)"})
                    _describe -t orgs 'organizations' orgs
                    ;;
                pipelines)
                    local -a pipelines
                    pipelines=(${(f)"$(bktide pipelines --format json --quiet 2>/dev/null | jq -r '.[].slug' 2>/dev/null)"})
                    _describe -t pipelines 'pipelines' pipelines
                    ;;
                branches)
                    local -a branches
                    branches=(main master develop staging production)
                    if git rev-parse --git-dir &>/dev/null; then
                        branches+=(${(f)"$(git branch -r 2>/dev/null | sed 's/.*origin\///' | grep -v HEAD)"})
                    fi
                    _describe -t branches 'branches' branches
                    ;;
            esac
            ;;
            
        token)
            _arguments \
                '--check[Check if a token is stored]' \
                '--store[Store a token in the system keychain]' \
                '--reset[Delete the stored token]' \
                $global_opts
            ;;
            
        annotations)
            _arguments \
                ':build reference:(org/pipeline/123)' \
                '--context[Filter annotations by context]:context:' \
                $global_opts
            ;;
            
        completions)
            if (( CURRENT == 3 )); then
                local -a shells
                shells=(fish bash zsh)
                _describe -t shells 'shell type' shells
            else
                _arguments $global_opts
            fi
            ;;
            
        boom)
            _arguments \
                '--type[Type of error to throw]:type:(basic api object)' \
                $global_opts
            ;;
            
        *)
            _arguments $global_opts
            ;;
    esac
}

# Also support bin/bktide
compdef _bktide bin/bktide

_bktide "$@"

