"""Local & Tunneled Z-Image-Turbo (stable-diffusion.cpp Vulkan) image generation service."""

from __future__ import annotations

import asyncio
import base64
import os
import time
from datetime import datetime
from pathlib import Path
from typing import Any

import httpx

ZIMAGE_DIR = Path(os.environ.get("ZIMAGE_DIR", r"C:\ai\stable-diffusion"))
ZIMAGE_CLI = ZIMAGE_DIR / "bin" / "sd-cli.exe"
ZIMAGE_MODELS_DIR = ZIMAGE_DIR / "models"
ZIMAGE_DIFFUSION = ZIMAGE_MODELS_DIR / "z_image_turbo-Q8_0.gguf"
ZIMAGE_VAE = ZIMAGE_MODELS_DIR / "ae.safetensors"
ZIMAGE_LLM = ZIMAGE_MODELS_DIR / "Qwen3-4B-Instruct-2507-Q8_0.gguf"
ZIMAGE_OUTPUT_DIR = ZIMAGE_DIR / "salidas"

_LOCAL_ZIMAGE_LOCK = asyncio.Lock()


def _local_zimage_files_status() -> tuple[bool, list[str]]:
    missing: list[str] = []
    for label, path in (
        ("sd-cli.exe", ZIMAGE_CLI),
        ("z_image_turbo-Q8_0.gguf", ZIMAGE_DIFFUSION),
        ("ae.safetensors", ZIMAGE_VAE),
        ("Qwen3-4B-Instruct-2507-Q8_0.gguf", ZIMAGE_LLM),
    ):
        if not path.is_file():
            missing.append(label)
    return len(missing) == 0, missing


async def _unload_local_ollama(ollama_base_url: str) -> None:
    base = (ollama_base_url or "http://127.0.0.1:11434").rstrip("/")
    try:
        async with httpx.AsyncClient(timeout=4.0) as client:
            ps_resp = await client.get(f"{base}/api/ps")
            if ps_resp.status_code != 200:
                return
            for item in ps_resp.json().get("models", []):
                name = item.get("name") or item.get("model")
                if name:
                    try:
                        await client.post(
                            f"{base}/api/generate",
                            json={"model": name, "prompt": "", "keep_alive": 0},
                            timeout=8.0,
                        )
                    except Exception:
                        pass
    except Exception:
        pass


async def get_zimage_status(
    ollama_base_url: str = "",
    ollama_api_key: str = "",
) -> dict[str, Any]:
    local_ok, missing = _local_zimage_files_status()
    if local_ok:
        recent: list[str] = []
        if ZIMAGE_OUTPUT_DIR.is_dir():
            pngs = sorted(ZIMAGE_OUTPUT_DIR.glob("*.png"), key=lambda p: p.stat().st_mtime, reverse=True)
            recent = [p.name for p in pngs[:5]]
        return {
            "available": True,
            "mode": "local_gpu",
            "engine": "stable-diffusion.cpp (Vulkan Radeon 780M)",
            "model": ZIMAGE_DIFFUSION.name,
            "text_encoder": ZIMAGE_LLM.name,
            "vae": ZIMAGE_VAE.name,
            "output_dir": str(ZIMAGE_OUTPUT_DIR),
            "recent_outputs": recent,
            "message": "Z-Image-Turbo listo en tu GPU local del MiniPC (0,00 €).",
        }

    # If running in the cloud (e.g. Railway), probe the authenticated MiniPC tunnel proxy
    base = (ollama_base_url or "").strip().rstrip("/")
    if base and not any(h in base for h in ("127.0.0.1", "localhost")):
        headers = {"Accept": "application/json"}
        if ollama_api_key:
            headers["Authorization"] = f"Bearer {ollama_api_key}"
        try:
            async with httpx.AsyncClient(timeout=6.0) as client:
                resp = await client.get(f"{base}/zimage/status", headers=headers)
                if resp.status_code == 200:
                    data = resp.json()
                    if data.get("available"):
                        return {
                            "available": True,
                            "mode": "tunnel_gpu",
                            "engine": data.get("engine") or "stable-diffusion.cpp (Vulkan MiniPC)",
                            "model": data.get("model") or ZIMAGE_DIFFUSION.name,
                            "text_encoder": data.get("text_encoder") or ZIMAGE_LLM.name,
                            "vae": data.get("vae") or ZIMAGE_VAE.name,
                            "output_dir": data.get("output_dir") or str(ZIMAGE_OUTPUT_DIR),
                            "recent_outputs": data.get("recent_outputs") or [],
                            "message": "Z-Image-Turbo conectado vía túnel seguro con la GPU de tu MiniPC (0,00 €).",
                        }
        except Exception:
            pass

    return {
        "available": False,
        "mode": "unavailable",
        "engine": "stable-diffusion.cpp (Vulkan)",
        "model": ZIMAGE_DIFFUSION.name,
        "text_encoder": ZIMAGE_LLM.name,
        "vae": ZIMAGE_VAE.name,
        "output_dir": str(ZIMAGE_OUTPUT_DIR),
        "missing_files": missing,
        "recent_outputs": [],
        "message": "Z-Image-Turbo no detectado en este servidor ni en el túnel del MiniPC.",
    }


async def generate_image_with_zimage(
    prompt: str,
    width: int = 768,
    height: int = 768,
    steps: int = 8,
    seed: int = -1,
    ollama_base_url: str = "",
    ollama_api_key: str = "",
) -> dict[str, Any]:
    clean_prompt = prompt.strip()
    if not clean_prompt:
        raise ValueError("El prompt no puede estar vacío.")

    width = max(512, min(1280, (int(width) // 64) * 64))
    height = max(512, min(1280, (int(height) // 64) * 64))
    steps = max(4, min(20, int(steps)))

    local_ok, _ = _local_zimage_files_status()
    if local_ok:
        ZIMAGE_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        out_path = ZIMAGE_OUTPUT_DIR / f"zimage_kc_{ts}.png"

        async with _LOCAL_ZIMAGE_LOCK:
            await _unload_local_ollama(ollama_base_url or "http://127.0.0.1:11434")
            t0 = time.perf_counter()
            proc = await asyncio.create_subprocess_exec(
                str(ZIMAGE_CLI),
                "--diffusion-model",
                str(ZIMAGE_DIFFUSION),
                "--vae",
                str(ZIMAGE_VAE),
                "--llm",
                str(ZIMAGE_LLM),
                "-p",
                clean_prompt,
                "--cfg-scale",
                "1.0",
                "--steps",
                str(steps),
                "-W",
                str(width),
                "-H",
                str(height),
                "--seed",
                str(int(seed)),
                "-o",
                str(out_path),
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            try:
                stdout_b, stderr_b = await asyncio.wait_for(proc.communicate(), timeout=360.0)
            except asyncio.TimeoutError as exc:
                proc.kill()
                raise RuntimeError("Z-Image agotó el tiempo máximo de generación (360s).") from exc

            elapsed = round(time.perf_counter() - t0, 1)
            if not out_path.is_file():
                err_txt = (stderr_b or stdout_b or b"").decode("utf-8", errors="ignore").strip()[-400:]
                raise RuntimeError(f"sd-cli.exe no generó la imagen (exit {proc.returncode}): {err_txt}")

            b64 = base64.b64encode(out_path.read_bytes()).decode("ascii")
            return {
                "ok": True,
                "mode": "local_gpu",
                "image_url": f"data:image/png;base64,{b64}",
                "output_path": str(out_path),
                "elapsed_seconds": elapsed,
                "width": width,
                "height": height,
                "steps": steps,
                "model": ZIMAGE_DIFFUSION.name,
            }

    # Tunnel fallback (when backend runs on Railway)
    base = (ollama_base_url or "").strip().rstrip("/")
    if base and not any(h in base for h in ("127.0.0.1", "localhost")):
        headers = {"Content-Type": "application/json", "Accept": "application/json"}
        if ollama_api_key:
            headers["Authorization"] = f"Bearer {ollama_api_key}"
        async with httpx.AsyncClient(timeout=360.0) as client:
            resp = await client.post(
                f"{base}/zimage/generate",
                headers=headers,
                json={
                    "prompt": clean_prompt,
                    "width": width,
                    "height": height,
                    "steps": steps,
                    "seed": seed,
                },
            )
            if resp.status_code == 200:
                data = resp.json()
                if data.get("ok") and data.get("image_b64"):
                    mime = data.get("mime_type") or "image/png"
                    return {
                        "ok": True,
                        "mode": "tunnel_gpu",
                        "image_url": f"data:{mime};base64,{data['image_b64']}",
                        "output_path": data.get("output_path"),
                        "elapsed_seconds": data.get("elapsed_seconds"),
                        "width": data.get("width", width),
                        "height": data.get("height", height),
                        "steps": data.get("steps", steps),
                        "model": data.get("model", ZIMAGE_DIFFUSION.name),
                    }
            raise RuntimeError(f"Error del túnel Z-Image (HTTP {resp.status_code}): {resp.text[:250]}")

    raise RuntimeError(
        "Z-Image-Turbo no está disponible en este entorno. Asegúrate de tener el MiniPC encendido y el túnel activo."
    )
