"""Hardware inspector contract. No model download."""

from __future__ import annotations

import subprocess
from dataclasses import FrozenInstanceError

import pytest
import torch
from backend.hardware_inspector import (
    HardwareProfile,
    _cpu_brand,
    _cpu_brand_from_proc_cpuinfo,
    _cpu_cores,
    get_hardware_profile,
)


def test_get_hardware_profile_contract() -> None:
    profile = get_hardware_profile()

    assert isinstance(profile, HardwareProfile)
    assert isinstance(profile.platform_name, str) and profile.platform_name.strip()
    assert isinstance(profile.cpu_brand, str) and profile.cpu_brand.strip()
    assert type(profile.cpu_cores) is int and profile.cpu_cores >= 1
    assert type(profile.total_ram_bytes) is int and profile.total_ram_bytes > 0
    assert type(profile.available_ram_bytes) is int and profile.available_ram_bytes > 0
    assert profile.available_ram_bytes <= profile.total_ram_bytes
    assert profile.accelerator in {"mps", "cuda", "cpu"}
    assert isinstance(profile.accelerator_device_name, str)
    assert profile.accelerator_device_name.strip()
    assert profile.is_accelerated is (profile.accelerator in {"mps", "cuda"})

    if profile.platform_name == "Darwin":
        brand = subprocess.check_output(
            ["sysctl", "-n", "machdep.cpu.brand_string"], text=True
        ).strip()
        memsize = int(
            subprocess.check_output(["sysctl", "-n", "hw.memsize"], text=True)
        )
        ncpu = int(subprocess.check_output(["sysctl", "-n", "hw.ncpu"], text=True))
        assert profile.cpu_brand == brand
        assert profile.cpu_brand != "arm"
        assert profile.total_ram_bytes == memsize
        assert profile.cpu_cores == ncpu


def test_accelerator_matches_torch_priority() -> None:
    """mps (available and built) wins over cuda; cpu is the only fallback."""
    profile = get_hardware_profile()
    mps_backend = getattr(torch.backends, "mps", None)
    mps_ready = bool(
        mps_backend is not None
        and mps_backend.is_available()
        and mps_backend.is_built()
    )
    cuda_ready = bool(torch.cuda.is_available())

    if mps_ready:
        assert profile.accelerator == "mps"
        assert profile.accelerator_device_name == "Apple Metal (MPS)"
        assert profile.is_accelerated is True
    elif cuda_ready:
        assert profile.accelerator == "cuda"
        assert profile.accelerator_device_name == torch.cuda.get_device_name(0)
        assert profile.is_accelerated is True
    else:
        assert profile.accelerator == "cpu"
        assert profile.accelerator_device_name == "Host CPU"
        assert profile.is_accelerated is False


def test_hardware_profile_is_frozen_and_slotted() -> None:
    profile = get_hardware_profile()
    assert not hasattr(profile, "__dict__")
    with pytest.raises(FrozenInstanceError):
        profile.cpu_cores = profile.cpu_cores  # type: ignore[misc]


def test_hardware_profile_rejects_inconsistent_values() -> None:
    ok = {
        "platform_name": "Darwin",
        "cpu_brand": "Apple M4",
        "cpu_cores": 10,
        "total_ram_bytes": 17179869184,
        "available_ram_bytes": 1024,
        "accelerator": "mps",
        "accelerator_device_name": "Apple Metal (MPS)",
        "is_accelerated": True,
    }
    HardwareProfile(**ok)

    with pytest.raises(ValueError, match="cpu_cores"):
        HardwareProfile(**{**ok, "cpu_cores": 0})
    with pytest.raises(ValueError, match="total_ram_bytes"):
        HardwareProfile(**{**ok, "total_ram_bytes": 0})
    with pytest.raises(ValueError, match="available_ram_bytes"):
        HardwareProfile(**{**ok, "available_ram_bytes": 0})
    with pytest.raises(ValueError, match="available_ram_bytes"):
        HardwareProfile(**{**ok, "available_ram_bytes": ok["total_ram_bytes"] + 1})
    with pytest.raises(ValueError, match="accelerator"):
        HardwareProfile(**{**ok, "accelerator": "metal"})
    with pytest.raises(ValueError, match="is_accelerated"):
        HardwareProfile(**{**ok, "is_accelerated": False})
    with pytest.raises(ValueError, match="cpu_brand"):
        HardwareProfile(**{**ok, "cpu_brand": "  "})


def test_linux_cpuinfo_brand_parser() -> None:
    ryzen = "processor\t: 0\nmodel name\t: AMD Ryzen 9 7950X\n"
    assert _cpu_brand_from_proc_cpuinfo(ryzen) == "AMD Ryzen 9 7950X"
    arm = "processor\t: 0\nHardware\t: BCM2711\n"
    assert _cpu_brand_from_proc_cpuinfo(arm) == "BCM2711"
    assert _cpu_brand_from_proc_cpuinfo("") == ""
    assert _cpu_brand_from_proc_cpuinfo("processor\t: 0\n") == ""


def test_windows_brand_prefers_processor_identifier(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("PROCESSOR_IDENTIFIER", "Intel64 Family 6 Model 154")
    assert _cpu_brand("Windows") == "Intel64 Family 6 Model 154"


def test_windows_brand_falls_back_to_platform_processor(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.delenv("PROCESSOR_IDENTIFIER", raising=False)
    monkeypatch.setattr(
        "backend.hardware_inspector.platform.processor", lambda: "AMD64 Family 25"
    )
    assert _cpu_brand("Windows") == "AMD64 Family 25"


def test_cpu_brand_raises_when_unmeasurable(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("backend.hardware_inspector._read_proc_cpuinfo", lambda: "")
    monkeypatch.setattr("backend.hardware_inspector.platform.processor", lambda: "  ")
    monkeypatch.setattr("backend.hardware_inspector.platform.machine", lambda: "")
    with pytest.raises(RuntimeError, match="cpu brand"):
        _cpu_brand("Linux")


def test_cpu_cores_uses_psutil_when_os_count_is_missing(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr("backend.hardware_inspector.os.cpu_count", lambda: None)
    monkeypatch.setattr(
        "backend.hardware_inspector.psutil.cpu_count", lambda logical=True: 4
    )
    assert _cpu_cores() == 4


def test_cpu_cores_raises_when_unmeasurable(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("backend.hardware_inspector.os.cpu_count", lambda: 0)
    monkeypatch.setattr(
        "backend.hardware_inspector.psutil.cpu_count", lambda logical=True: None
    )
    with pytest.raises(RuntimeError, match="cpu core"):
        _cpu_cores()


def test_accelerator_falls_back_to_cpu_when_mps_and_cuda_are_off(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(torch.backends.mps, "is_available", lambda: False)
    monkeypatch.setattr(torch.backends.mps, "is_built", lambda: False)
    monkeypatch.setattr(torch.cuda, "is_available", lambda: False)
    profile = get_hardware_profile()
    assert profile.accelerator == "cpu"
    assert profile.accelerator_device_name == "Host CPU"
    assert profile.is_accelerated is False


def test_mps_requires_both_available_and_built(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(torch.backends.mps, "is_available", lambda: True)
    monkeypatch.setattr(torch.backends.mps, "is_built", lambda: False)
    monkeypatch.setattr(torch.cuda, "is_available", lambda: False)
    profile = get_hardware_profile()
    assert profile.accelerator == "cpu"


def test_cuda_used_when_mps_is_off(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(torch.backends.mps, "is_available", lambda: False)
    monkeypatch.setattr(torch.backends.mps, "is_built", lambda: False)
    monkeypatch.setattr(torch.cuda, "is_available", lambda: True)
    monkeypatch.setattr(torch.cuda, "get_device_name", lambda index: "NVIDIA Test GPU")
    profile = get_hardware_profile()
    assert profile.accelerator == "cuda"
    assert profile.accelerator_device_name == "NVIDIA Test GPU"
    assert profile.is_accelerated is True
