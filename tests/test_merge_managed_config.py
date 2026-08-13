import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "module" / "scripts"))

import merge_managed_config  # noqa: E402


def run_merge(monkeypatch, managed, live, document_format, tmp_path):
    managed_path = tmp_path / f"managed.{document_format}"
    live_path = tmp_path / f"live.{document_format}"
    merge_managed_config.write_document(managed_path, managed, document_format)
    if live is not None:
        merge_managed_config.write_document(live_path, live, document_format)
    monkeypatch.setenv(merge_managed_config.MANAGED_SOURCE_VARIABLE, str(managed_path))
    monkeypatch.setenv(merge_managed_config.LIVE_TARGET_VARIABLE, str(live_path))
    monkeypatch.setenv(merge_managed_config.FORMAT_VARIABLE, document_format)
    merge_managed_config.main()
    return merge_managed_config.read_document(live_path, document_format)


def test_a_declared_key_wins_and_a_harness_owned_key_survives(monkeypatch, tmp_path):
    result = run_merge(
        monkeypatch,
        managed={"model": "declared", "hooks": {"PreToolUse": []}},
        live={"model": "stale", "hasCompletedOnboarding": True},
        document_format="json",
        tmp_path=tmp_path,
    )

    assert result["model"] == "declared"
    assert result["hasCompletedOnboarding"] is True


def test_nested_tables_merge_rather_than_replace(monkeypatch, tmp_path):
    result = run_merge(
        monkeypatch,
        managed={"features": {"hooks": True}},
        live={"features": {"experimental": True}, "model": "gpt"},
        document_format="toml",
        tmp_path=tmp_path,
    )

    assert result["features"] == {"experimental": True, "hooks": True}
    assert result["model"] == "gpt"


def test_a_missing_live_file_is_created_from_the_declaration(monkeypatch, tmp_path):
    result = run_merge(
        monkeypatch,
        managed={"model": "declared"},
        live=None,
        document_format="json",
        tmp_path=tmp_path,
    )

    assert result == {"model": "declared"}


def test_a_corrupt_live_file_is_replaced_rather_than_inherited(monkeypatch, tmp_path):
    live_path = tmp_path / "live.json"
    live_path.write_text("{not json", encoding="utf-8")
    managed_path = tmp_path / "managed.json"
    managed_path.write_text(json.dumps({"model": "declared"}), encoding="utf-8")
    monkeypatch.setenv(merge_managed_config.MANAGED_SOURCE_VARIABLE, str(managed_path))
    monkeypatch.setenv(merge_managed_config.LIVE_TARGET_VARIABLE, str(live_path))
    monkeypatch.setenv(merge_managed_config.FORMAT_VARIABLE, "json")

    merge_managed_config.main()

    assert json.loads(live_path.read_text(encoding="utf-8")) == {"model": "declared"}
