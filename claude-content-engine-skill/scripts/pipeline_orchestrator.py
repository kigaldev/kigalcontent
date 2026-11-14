#!/usr/bin/env python3
"""
Orquestador de Máquina de Estados Finita (FSM) y Gobernanza HITL
Autonomous Content Engine - Claude Code Skill
"""

import os
import json
import time
from typing import Dict, Any

STATE_FILE = "./.content_engine/state.json"
AUDIT_LOG = "./.content_engine/logs/audit_trail.log"

VALID_TRANSITIONS = {
    "INIT": ["CAPTURED"],
    "CAPTURED": ["RESEARCHED_TRIAGED"],
    "RESEARCHED_TRIAGED": ["SCRIPTED_PACKAGED", "ARCHIVED"],
    "SCRIPTED_PACKAGED": ["HITL_PENDING_PRODUCTION", "ARCHIVED"],
    "HITL_PENDING_PRODUCTION": ["PRODUCED_VALIDATED"],
    "PRODUCED_VALIDATED": ["HITL_PENDING_PUBLISH"],
    "HITL_PENDING_PUBLISH": ["PUBLISHED_LIVE", "REJECTED_REVISION"],
    "REJECTED_REVISION": ["PRODUCED_VALIDATED", "ARCHIVED"],
    "PUBLISHED_LIVE": ["AUDITED_CLOSED_LOOP"],
    "AUDITED_CLOSED_LOOP": ["CAPTURED"] # Bucle continuo
}

def init_environment():
    os.makedirs("./.content_engine/logs", exist_ok=True)
    os.makedirs("./.content_engine/memory", exist_ok=True)
    os.makedirs("./media_workspace/raw", exist_ok=True)
    os.makedirs("./media_workspace/processed", exist_ok=True)
    if not os.path.exists(STATE_FILE):
        with open(STATE_FILE, "w") as f:
            json.dump({"projects": {}, "active_project": None}, f, indent=2)

def log_audit(action: str, agent: str, tier: int, status: str, details: Dict[str, Any]):
    entry = {
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "action": action,
        "agent": agent,
        "permission_tier": tier,
        "status": status,
        "details": details
    }
    with open(AUDIT_LOG, "a") as f:
        f.write(json.dumps(entry) + "\n")

def transition_state(project_id: str, new_state: str, agent: str, tier: int = 1, auth_token: str = None) -> bool:
    init_environment()
    with open(STATE_FILE, "r") as f:
        data = json.load(f)
    
    project = data["projects"].get(project_id)
    if not project:
        raise ValueError(f"Proyecto {project_id} no encontrado.")
    
    current_state = project["current_state"]
    if new_state not in VALID_TRANSITIONS.get(current_state, []):
        raise ValueError(f"Transición inválida: de {current_state} a {new_state}.")
    
    # Verificación estricta de HITL para Tier 2 y Tier 3
    if tier in [2, 3]:
        if not auth_token or not auth_token.startswith("HITL_AUTH_"):
            log_audit(f"TRANSITION_TO_{new_state}", agent, tier, "BLOCKED_HITL_REQUIRED", {"project_id": project_id})
            print(f"⛔ ACCIÓN DETENIDA [TIER {tier}]: Se requiere aprobación humana explícita.")
            return False
            
    project["current_state"] = new_state
    project["history"].append({
        "from": current_state,
        "to": new_state,
        "timestamp": time.time(),
        "agent": agent,
        "auth_token": auth_token
    })
    
    with open(STATE_FILE, "w") as f:
        json.dump(data, f, indent=2)
        
    log_audit(f"TRANSITION_TO_{new_state}", agent, tier, "SUCCESS", {"project_id": project_id, "token": auth_token})
    print(f"✅ Transición de estado exitosa: [{project_id}] {current_state} -> {new_state}")
    return True

if __name__ == "__main__":
    init_environment()
    print("Orchestrator FSM Engine inicializado correctamente.")
