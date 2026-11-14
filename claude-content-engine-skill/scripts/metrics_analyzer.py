#!/usr/bin/env python3
"""
Módulo de Diagnóstico Multivariable, Análisis de Outliers y RMT-A
Autonomous Content Engine - Claude Code Skill
"""

import json
from typing import Dict, Any, List

def analyze_watch_time_share(variant_a: Dict[str, float], variant_b: Dict[str, float]) -> Dict[str, Any]:
    """
    Calcula el ganador según el Watch Time Share oficial de YouTube Test & Compare.
    variant: {"impressions": float, "ctr_pct": float, "avd_seconds": float}
    """
    clicks_a = variant_a["impressions"] * (variant_a["ctr_pct"] / 100.0)
    total_watch_a = clicks_a * variant_a["avd_seconds"]
    
    clicks_b = variant_b["impressions"] * (variant_b["ctr_pct"] / 100.0)
    total_watch_b = clicks_b * variant_b["avd_seconds"]
    
    total_watch = total_watch_a + total_watch_b
    share_a = round((total_watch_a / total_watch * 100.0) if total_watch > 0 else 50.0, 2)
    share_b = round((total_watch_b / total_watch * 100.0) if total_watch > 0 else 50.0, 2)
    
    winner = "A" if share_a > share_b else ("B" if share_b > share_a else "TIE")
    delta_pct = round(abs(share_a - share_b), 2)
    
    return {
        "variant_a_watch_time_seconds": round(total_watch_a, 1),
        "variant_b_watch_time_seconds": round(total_watch_b, 1),
        "share_a_pct": share_a,
        "share_b_pct": share_b,
        "winner": winner,
        "delta_pct": delta_pct
    }

def diagnose_performance(metrics: Dict[str, Any], baseline_views: float) -> Dict[str, Any]:
    """
    Aisla la causa raíz en 4 capas y clasifica RMT-A.
    """
    views_factor = metrics["views_7d"] / baseline_views if baseline_views > 0 else 1.0
    is_outlier_pos = views_factor >= 3.0
    is_outlier_neg = views_factor <= 0.5
    
    ctr_or_hold = metrics.get("hold_rate_3s", metrics.get("ctr_pct", 0.0))
    retention_or_avd = metrics.get("completion_rate", metrics.get("avd_pct", 0.0))
    sends_per_reach = metrics.get("sends_per_reach", 0.0)
    
    # Diagnóstico de 4 capas
    if ctr_or_hold >= 60.0 and retention_or_avd >= 50.0:
        rmta = "REPETIR_FRANQUICIAR"
        layer = "EXITO_ESTRUCTURAL"
        action = "Convertir formato en franquicia recurrente (Paddy Galloway Playbook)."
    elif ctr_or_hold < 50.0 and retention_or_avd >= 50.0:
        rmta = "MEJORAR"
        layer = "EMPAQUE_DEFICIENTE"
        action = "Retención sólida pero bajo clic/freno. Rediseñar miniatura, portada y primeras 3 palabras del gancho."
    elif ctr_or_hold >= 60.0 and retention_or_avd < 35.0:
        rmta = "MEJORAR"
        layer = "EJECUCION_DISPAR_CLICKBAIT"
        action = "Alto freno pero abandono inmediato. Reestructurar primeros 15s y alinear promesa con entrega."
    else:
        rmta = "PROBAR_O_ABANDONAR"
        layer = "FALLO_PREMISA_O_TAM"
        action = "Bajo empaque y baja retención. Si se repite en 3 piezas continuas, abandonar formato."
        
    return {
        "views_factor_vs_baseline": round(views_factor, 2),
        "is_outlier_positive": is_outlier_pos,
        "is_outlier_negative": is_outlier_neg,
        "diagnosis_layer": layer,
        "rmta_classification": rmta,
        "recommended_action": action,
        "sends_social_value_sufficient": sends_per_reach >= 2.0
    }

if __name__ == "__main__":
    # Prueba del algoritmo
    var_a = {"impressions": 10000, "ctr_pct": 7.5, "avd_seconds": 120} # 750 clicks * 120s = 90,000s
    var_b = {"impressions": 10000, "ctr_pct": 5.2, "avd_seconds": 240} # 520 clicks * 240s = 124,800s
    ab_res = analyze_watch_time_share(var_a, var_b)
    print(f"Resultado A/B Watch Time Share: Ganador Variante {ab_res['winner']} con {ab_res['share_b_pct']}% vs {ab_res['share_a_pct']}%")
    
    mock_metrics = {"views_7d": 45000, "hold_rate_3s": 68.5, "completion_rate": 55.0, "sends_per_reach": 2.8}
    diag = diagnose_performance(mock_metrics, baseline_views=15000)
    print(f"Diagnóstico Rendimiento: {diag['rmta_classification']} | Capa: {diag['diagnosis_layer']} | Factor: {diag['views_factor_vs_baseline']}x")
