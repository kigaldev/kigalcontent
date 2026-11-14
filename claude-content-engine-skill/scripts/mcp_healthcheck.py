#!/usr/bin/env python3
"""
Módulo de Verificación de Salud e Integración MCP
Autonomous Content Engine - Claude Code Skill
"""

import os
import shutil
import json

def check_mcp_environment():
    report = {
        "local_tools": {},
        "mcp_config_present": False,
        "env_variables": {},
        "missing_items": [],
        "setup_instructions": []
    }
    
    # 1. Herramientas CLI locales requeridas
    for tool in ["ffmpeg", "ffprobe", "python3", "node", "npx"]:
        path = shutil.which(tool)
        report["local_tools"][tool] = {"available": bool(path), "path": path}
        if not path:
            report["missing_items"].append(f"CLI Tool: {tool}")
            
    # 2. Configuración MCP
    config_path = "./config/mcp_servers.json"
    if os.path.exists(config_path):
        report["mcp_config_present"] = True
        with open(config_path, "r") as f:
            servers = json.load(f).get("mcpServers", {})
            report["configured_servers"] = list(servers.keys())
    else:
        report["missing_items"].append("Archivo config/mcp_servers.json")

    # 3. Variables de Entorno Clave
    keys = [
        "BRAVE_API_KEY",
        "YOUTUBE_CLIENT_SECRET_FILE",
        "INSTAGRAM_ACCESS_TOKEN",
        "TIKTOK_ACCESS_TOKEN",
        "LINKEDIN_ACCESS_TOKEN"
    ]
    for key in keys:
        val = os.environ.get(key)
        report["env_variables"][key] = "Configurada" if val else "Ausente"
        if not val:
            report["setup_instructions"].append(f"Exportar variable de entorno: export {key}='tu_token_aqui'")
            
    return report

if __name__ == "__main__":
    rep = check_mcp_environment()
    print("=== REPORTE DE SALUD MCP Y DEPENDENCIAS ===")
    print(f"Herramientas locales: {json.dumps(rep['local_tools'], indent=2)}")
    print(f"Configuración MCP: {'Presente' if rep['mcp_config_present'] else 'Falta'}")
    print(f"Servidores configurados: {rep.get('configured_servers', [])}")
    print(f"Variables de entorno: {json.dumps(rep['env_variables'], indent=2)}")
    if rep["setup_instructions"]:
        print("\n=== GUÍA DE CONFIGURACIÓN PASO A PASO ===")
        for inst in rep["setup_instructions"]:
            print(f"- {inst}")
