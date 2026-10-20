#!/usr/bin/env bash
set -u

if (( $# > 1 )); then
    printf 'Usage: %s [code-repos.txt]\n' "$0" >&2
    exit 1
fi

input=${1:-code-repos.txt}
if [[ ! -f "$input" || ! -r "$input" ]]; then
    printf 'Cannot read file: %s\n' "$input" >&2
    exit 1
fi

command -v git >/dev/null 2>&1 || { printf 'git is required.\n' >&2; exit 1; }

status=0
while IFS= read -r line || [[ -n "$line" ]]; do
    line=${line#"${line%%[![:space:]]*}"}
    line=${line%"${line##*[![:space:]]}"}
    [[ -z "$line" || "$line" == \#* ]] && continue

    url=${line%%=*}
    url=${url%"${url##*[![:space:]]}"}
    if [[ "$url" != ssh://* && "$url" != *@*:* ]] || [[ "$url" == -* || "$url" == *[[:space:]]* ]]; then
        printf 'Invalid SSH repository URL: %s\n' "$line" >&2
        status=1
        continue
    fi

    name=
    if [[ "$line" == *=* ]]; then
        name=${line#*=}
        name=${name#"${name%%[![:space:]]*}"}
    fi
    if [[ -z "$name" ]]; then
        name=${url##*/}
        name=${name##*:}
        name=${name%.git}
    fi
    if [[ -z "$name" || "$name" == . || "$name" == .. ]]; then
        printf 'Invalid repository directory name: %s\n' "$line" >&2
        status=1
        continue
    fi
    target=$name
    [[ "$target" == /* ]] || target="./$target"

    if [[ -e "$target" || -L "$target" ]]; then
        if [[ ! -d "$target" || ! -e "$target/.git" ]]; then
            printf 'Skipping existing path that is not a Git checkout: %s\n' "$target" >&2
            status=1
            continue
        fi
        if ! origin=$(git -C "$target" config --get-all remote.origin.url </dev/null) || [[ "${origin%%$'\n'*}" != "$url" ]]; then
            printf 'Skipping checkout with a different origin: %s\n' "$target" >&2
            status=1
            continue
        fi
        printf 'Pulling %s\n' "$target"
        git -C "$target" pull --ff-only </dev/null || status=1
    else
        printf 'Cloning %s into %s\n' "$url" "$target"
        git clone -- "$url" "$target" </dev/null || status=1
    fi
done < "$input"

exit "$status"
