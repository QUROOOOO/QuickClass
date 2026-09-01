"""Credential storage: masking, no raw-key exposure, format-check-only test_connection."""
from app.services.credentials import CredentialService, LocalObfuscatedCredentialStore, mask_key
from app.domain.usage import Provider
import tempfile, os


def test_mask_key_never_reveals_full_secret():
    raw = "sk-abcdefghijklmnopqrstuvwxyz"
    masked = mask_key(raw)
    assert raw not in masked
    assert masked.endswith(raw[-4:])


def test_save_never_returns_raw_key():
    svc = CredentialService(LocalObfuscatedCredentialStore(tempfile.mktemp()))
    cred = svc.save(Provider.OPENAI, "sk-abcdefghijklmnop1234", label="prod")
    dumped = cred.model_dump()
    assert "sk-abcdefghijklmnop1234" not in str(dumped)
    assert cred.masked_key != "sk-abcdefghijklmnop1234"


def test_list_only_exposes_masked_records():
    svc = CredentialService(LocalObfuscatedCredentialStore(tempfile.mktemp()))
    svc.save(Provider.ANTHROPIC, "sk-ant-abcdefghijklmnop1234")
    for c in svc.list():
        assert "sk-ant-abcdefghijklmnop1234" not in c.masked_key


def test_remove_deletes_raw_key():
    path = tempfile.mktemp()
    raw_store = LocalObfuscatedCredentialStore(path)
    svc = CredentialService(raw_store)
    cred = svc.save(Provider.GEMINI, "AIzaSyABCDEFGHIJKLMNOPQRSTUVWXYZ12345")
    assert raw_store.get_raw(cred.id) is not None
    assert svc.remove(cred.id) is True
    assert raw_store.get_raw(cred.id) is None
    assert svc.get(cred.id) is None


def test_format_check_flags_malformed_key():
    svc = CredentialService(LocalObfuscatedCredentialStore(tempfile.mktemp()))
    bad = svc.save(Provider.OPENAI, "not-a-valid-key")
    result = svc.test_connection(bad.id)
    assert result.status == "invalid"

    good = svc.save(Provider.OPENAI, "sk-abcdefghijklmnopqrstuvwx")
    result2 = svc.test_connection(good.id)
    assert result2.status == "verified"
