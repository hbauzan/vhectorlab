"""Live host probe: CPU brand, RAM, and the torch accelerator.

`platform.processor()` on Darwin returns ``arm``, not the chip name.
The brand string comes from ``sysctl machdep.cpu.brand_string``.
"""

from __future__ import annotations

import os
import platform
import subprocess
from dataclasses import dataclass

import psutil

_ACCELERATORS = frozenset({"mps", "cuda", "cpu"})


@dataclass(frozen=True, slots=True)
class HardwareProfile:
    platform_name: str
    cpu_brand: str
    cpu_cores: int
    total_ram_bytes: int
    available_ram_bytes: int
    accelerator: str
    accelerator_device_name: str
    is_accelerated: bool

    def __post_init__(self) -> None:
        if type(self.cpu_cores) is not int or self.cpu_cores < 1:
            raise ValueError(f"cpu_cores must be an int >= 1, got {self.cpu_cores!r}")
        if type(self.total_ram_bytes) is not int or self.total_ram_bytes <= 0:
            raise ValueError(
                f"total_ram_bytes must be an int > 0, got {self.total_ram_bytes!r}"
            )
        if type(self.available_ram_bytes) is not int or self.available_ram_bytes <= 0:
            raise ValueError(
                "available_ram_bytes must be an int > 0, "
                f"got {self.available_ram_bytes!r}"
            )
        if self.available_ram_bytes > self.total_ram_bytes:
            raise ValueError(
                "available_ram_bytes exceeds total_ram_bytes: "
                f"{self.available_ram_bytes} > {self.total_ram_bytes}"
            )
        if self.accelerator not in _ACCELERATORS:
            raise ValueError(
                f"accelerator must be one of {sorted(_ACCELERATORS)}, "
                f"got {self.accelerator!r}"
            )
        accelerated = self.accelerator in {"mps", "cuda"}
        if self.is_accelerated is not accelerated:
            raise ValueError(
                "is_accelerated disagrees with accelerator: "
                f"{self.is_accelerated!r} vs {self.accelerator!r}"
            )
        if not self.platform_name.strip():
            raise ValueError("platform_name must be non-empty")
        if not self.cpu_brand.strip():
            raise ValueError("cpu_brand must be non-empty")
        if not self.accelerator_device_name.strip():
            raise ValueError("accelerator_device_name must be non-empty")


def get_hardware_profile() -> HardwareProfile:
    """Measure the host once. RAM figures are the live psutil sample."""
    system = platform.system()
    memory = psutil.virtual_memory()
    accelerator, device_name = _detect_accelerator()
    return HardwareProfile(
        platform_name=system,
        cpu_brand=_cpu_brand(system),
        cpu_cores=_cpu_cores(),
        total_ram_bytes=int(memory.total),
        available_ram_bytes=int(memory.available),
        accelerator=accelerator,
        accelerator_device_name=device_name,
        is_accelerated=accelerator in {"mps", "cuda"},
    )


def _cpu_cores() -> int:
    count = os.cpu_count()
    if count is None or count < 1:
        count = psutil.cpu_count(logical=True)
    if count is None or count < 1:
        raise RuntimeError("cpu core count unavailable")
    return int(count)


def _cpu_brand(system: str) -> str:
    if system == "Darwin":
        brand = _sysctl("machdep.cpu.brand_string")
        if brand:
            return brand
    elif system == "Linux":
        brand = _cpu_brand_from_proc_cpuinfo(_read_proc_cpuinfo())
        if brand:
            return brand
    elif system == "Windows":
        brand = os.environ.get("PROCESSOR_IDENTIFIER", "").strip()
        if brand:
            return brand
    processor = platform.processor().strip()
    if processor:
        return processor
    machine = platform.machine().strip()
    if machine:
        return machine
    raise RuntimeError("cpu brand unavailable")


def _cpu_brand_from_proc_cpuinfo(text: str) -> str:
    """First meaningful CPU identity line in ``/proc/cpuinfo`` text."""
    wanted = ("model name", "Hardware", "Model")
    found: dict[str, str] = {}
    for line in text.splitlines():
        if ":" not in line:
            continue
        key, _, value = line.partition(":")
        key = key.strip()
        value = value.strip()
        if key in wanted and value and key not in found:
            found[key] = value
    for key in wanted:
        if key in found:
            return found[key]
    return ""


def _read_proc_cpuinfo() -> str:
    try:
        with open("/proc/cpuinfo", encoding="utf-8", errors="replace") as handle:
            return handle.read()
    except OSError:
        return ""


def _sysctl(key: str) -> str:
    try:
        completed = subprocess.run(
            ["sysctl", "-n", key],
            check=False,
            capture_output=True,
            text=True,
            timeout=2,
        )
    except (OSError, subprocess.TimeoutExpired):
        return ""
    if completed.returncode != 0:
        return ""
    return completed.stdout.strip()


def _detect_accelerator() -> tuple[str, str]:
    import torch

    mps_backend = getattr(torch.backends, "mps", None)
    if (
        mps_backend is not None
        and mps_backend.is_available()
        and mps_backend.is_built()
    ):
        return "mps", "Apple Metal (MPS)"
    cuda = getattr(torch, "cuda", None)
    if cuda is not None and cuda.is_available():
        return "cuda", str(cuda.get_device_name(0))
    return "cpu", "Host CPU"
