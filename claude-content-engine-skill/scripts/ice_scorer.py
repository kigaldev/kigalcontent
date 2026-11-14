#!/usr/bin/env python3
"""
Módulo de Cálculo y Calibración Algorítmica ICE (Impact, Confidence, Ease)
Autonomous Content Engine - Claude Code Skill
"""

import sys
import json

def calculate_ice(impact: float, confidence: float, ease: float) -> dict:
    for name, val in [("Impact", impact), ("Confidence", confidence), ("Ease", ease)]:
        if not (1.0 <= val <= 10.0):
            raise ValueError(f"El valor de {name} ({val}) debe estar en el rango [1.0, 10.0].")
    
    ice_average = round((impact + confidence + ease) / 3.0, 2)
    ice_multiplicative = round(impact * confidence * ease, 2)
    
    # Criterio estándar del manual: Promedio >= 7.0 califica como prioritario
    status = "APROBADO_PRIORITARIO" if ice_average >= 7.0 else ("EN_ESPERA" if ice_average >= 4.0 else "DESCARTADO")
    
    return {
        "impact": impact,
        "confidence": confidence,
        "ease": ease,
        "ice_score": ice_average,
        "ice_multiplicative": ice_multiplicative,
        "status": status,
        "threshold_met": ice_average >= 7.0
    }

if __name__ == "__main__":
    if len(sys.argv) == 4:
        i, c, e = float(sys.argv[1]), float(sys.argv[2]), float(sys.argv[3])
        res = calculate_ice(i, c, e)
        print(json.dumps(res, indent=2))
    else:
        # Test unitario básico
        test_res = calculate_ice(8.5, 7.0, 8.0)
        print(f"Test ICE (8.5, 7.0, 8.0) -> Score: {test_res['ice_score']}, Status: {test_res['status']}")
