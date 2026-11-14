#!/usr/bin/env python3
"""
Test Suite Integral para Autonomous Content Engine
Claude Code Skill v2 Validation
"""

import unittest
import os
import sys
import json

# Agregar scripts al path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../scripts")))

from ice_scorer import calculate_ice
from metrics_analyzer import analyze_watch_time_share, diagnose_performance
from pipeline_orchestrator import init_environment, transition_state, STATE_FILE
from mcp_healthcheck import check_mcp_environment
from social_publisher import SocialCopyGenerator, SocialPublisherClient

class TestContentEngineSkill(unittest.TestCase):
    
    def setUp(self):
        os.chdir(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
        init_environment()
        with open(STATE_FILE, "w") as f:
            json.dump({
                "projects": {
                    "TEST-001": {
                        "current_state": "INIT",
                        "history": []
                    }
                }
            }, f)

    def test_ice_calculation_approval(self):
        res = calculate_ice(8.0, 7.5, 7.0)
        self.assertEqual(res["ice_score"], 7.5)
        self.assertEqual(res["status"], "APROBADO_PRIORITARIO")
        self.assertTrue(res["threshold_met"])

    def test_ice_calculation_rejection(self):
        res = calculate_ice(4.0, 3.0, 4.0)
        self.assertEqual(res["ice_score"], 3.67)
        self.assertEqual(res["status"], "DESCARTADO")
        self.assertFalse(res["threshold_met"])

    def test_watch_time_share_youtube(self):
        var_a = {"impressions": 10000, "ctr_pct": 10.0, "avd_seconds": 60}
        var_b = {"impressions": 10000, "ctr_pct": 5.0, "avd_seconds": 240}
        res = analyze_watch_time_share(var_a, var_b)
        self.assertEqual(res["winner"], "B")
        self.assertAlmostEqual(res["share_b_pct"], 66.67, places=1)

    def test_diagnosis_and_rmta(self):
        metrics = {"views_7d": 30000, "hold_rate_3s": 72.0, "completion_rate": 65.0, "sends_per_reach": 3.5}
        diag = diagnose_performance(metrics, baseline_views=10000)
        self.assertEqual(diag["rmta_classification"], "REPETIR_FRANQUICIAR")
        self.assertEqual(diag["diagnosis_layer"], "EXITO_ESTRUCTURAL")
        self.assertTrue(diag["is_outlier_positive"])

    def test_fsm_tier_blocking_hitl(self):
        ok1 = transition_state("TEST-001", "CAPTURED", agent="Orchestrator", tier=1)
        self.assertTrue(ok1)
        
        ok2 = transition_state("TEST-001", "RESEARCHED_TRIAGED", agent="Researcher", tier=1)
        self.assertTrue(ok2)
        
        ok3 = transition_state("TEST-001", "SCRIPTED_PACKAGED", agent="Director", tier=1)
        self.assertTrue(ok3)

        # Tier 2 review: bloqueado sin token
        blocked = transition_state("TEST-001", "HITL_PENDING_PRODUCTION", agent="Director", tier=2, auth_token=None)
        self.assertFalse(blocked)
        
        # Con token HITL firmado
        allowed = transition_state("TEST-001", "HITL_PENDING_PRODUCTION", agent="Director", tier=2, auth_token="HITL_AUTH_CREATOR_OK_99")
        self.assertTrue(allowed)

    def test_creator_profile_and_cta_adaptation(self):
        generator = SocialCopyGenerator()
        # 1. Email lead capture
        cta_email = generator.get_cta_for_goal("EMAIL_LEAD_CAPTURE")
        self.assertIn("BLUEPRINT", cta_email)
        
        # 2. B2B Inbound
        cta_b2b = generator.get_cta_for_goal("B2B_INBOUND_CONVERSATION")
        self.assertIn("SISTEMAS", cta_b2b)

    def test_social_copy_generation_and_preflight(self):
        generator = SocialCopyGenerator()
        client = SocialPublisherClient(generator)

        # 1. Instagram Reel
        ig = generator.generate_instagram_caption(
            "El error que te cuesta el 80% del alcance",
            "La mayoria de los creadores se enfocan en likes en lugar de envios por DM."
        )
        self.assertLessEqual(ig["first_line_chars"], 125)
        self.assertIn("Sends per Reach", ig["target_metric"])
        ig_warnings = client.validate_preflight("Instagram", ig)
        self.assertEqual(len(ig_warnings), 0)

        # 2. LinkedIn Post
        li = generator.generate_linkedin_post(
            "La trampa de Silicon Valley y la falsa sensacion de apalancamiento",
            ["El volumen sin sistemas es prision", "Automatiza antes de escalar"]
        )
        self.assertFalse(li["has_link_in_body"])
        self.assertIn("BLUEPRINT", li["first_comment"])
        li_warnings = client.validate_preflight("LinkedIn", li)
        self.assertEqual(len(li_warnings), 0)

        # 3. YouTube Metadata
        yt = generator.generate_youtube_metadata(
            "El esclavo de 3 billones de dolares",
            "Analisis de la paradoja del CEO y la arquitectura solopreneur",
            [{"time": "00:00", "title": "Intro"}, {"time": "00:30", "title": "Sistemas"}]
        )
        self.assertLessEqual(len(yt["title"]), 60)
        self.assertIn("MARCAS DE TIEMPO", yt["description"])

    def test_social_publisher_client_hitl_security(self):
        client = SocialPublisherClient()
        payload = {"title": "Test Title", "body": "Test Body"}
        
        # Bloqueo estricto Tier 3 sin token
        with self.assertRaises(PermissionError):
            client.execute_publish("LinkedIn", payload, auth_token=None)
            
        with self.assertRaises(PermissionError):
            client.execute_publish("LinkedIn", payload, auth_token="UNAUTHORIZED_TOKEN")
            
        # Autorizado con token Tier 3
        res = client.execute_publish("LinkedIn", payload, auth_token="HITL_AUTH_CREATOR_OK_42")
        self.assertEqual(res["status"], "SUCCESS")
        self.assertTrue(res["auth_verified"])
        self.assertIn("canonical_reference", res)

    def test_mcp_healthcheck(self):
        rep = check_mcp_environment()
        self.assertIn("local_tools", rep)
        self.assertTrue(rep["mcp_config_present"])
        self.assertIn("research_engine", rep["configured_servers"])

if __name__ == "__main__":
    unittest.main()
