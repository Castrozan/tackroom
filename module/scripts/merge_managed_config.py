"""Fold a nix-generated configuration into a file the harness also writes to.

A read-only symlink is the wrong shape for these files: every one of the three harnesses
writes its own state back into them, and a symlink into the nix store turns that into a
crash. Merging declared keys over the live file on every activation keeps the declaration
authoritative while leaving harness-owned keys untouched.
"""

import json
import os
import sys
import tomllib
from pathlib import Path

import tomli_w

MANAGED_SOURCE_VARIABLE = "TACKROOM_MANAGED_SOURCE"
LIVE_TARGET_VARIABLE = "TACKROOM_LIVE_TARGET"
FORMAT_VARIABLE = "TACKROOM_FORMAT"


def read_document(path, document_format):
    try:
        raw = Path(path).read_bytes()
    except OSError:
        return {}
    if not raw.strip():
        return {}
    try:
        return (
            tomllib.loads(raw.decode("utf-8"))
            if document_format == "toml"
            else json.loads(raw)
        )
    except (ValueError, UnicodeDecodeError):
        return {}


def write_document(path, document, document_format):
    target = Path(path)
    target.parent.mkdir(parents=True, exist_ok=True)
    rendered = (
        tomli_w.dumps(document)
        if document_format == "toml"
        else json.dumps(document, indent=2) + "\n"
    )
    temporary = target.with_suffix(target.suffix + ".tackroom-tmp")
    temporary.write_text(rendered, encoding="utf-8")
    os.replace(temporary, target)


def merged(declared, live):
    if not isinstance(declared, dict) or not isinstance(live, dict):
        return declared
    result = dict(live)
    for key, declared_value in declared.items():
        result[key] = merged(declared_value, live.get(key))
    return result


def main():
    managed_source = os.environ.get(MANAGED_SOURCE_VARIABLE, "")
    live_target = os.environ.get(LIVE_TARGET_VARIABLE, "")
    document_format = os.environ.get(FORMAT_VARIABLE, "json")
    if not managed_source or not live_target:
        sys.exit("merge_managed_config needs a managed source and a live target")
    declared = read_document(managed_source, document_format)
    live = read_document(live_target, document_format)
    write_document(live_target, merged(declared, live), document_format)


if __name__ == "__main__":
    main()
