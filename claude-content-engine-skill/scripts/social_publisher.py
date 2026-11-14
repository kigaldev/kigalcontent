"""
Motor de Publicacion Inteligente y Copycrafting Algoritmico
Autonomous Content Engine - Claude Code Skill v2
"""

import os
import json
import time
from typing import Dict, Any, List, Optional

CREATOR_PROFILE_PATH = "./config/creator_profile.json"

class SocialCopyGenerator:
    """Generador de descripciones y metadatos optimizados algoritmicamente por plataforma."""

    def __init__(self, creator_profile_path: str = CREATOR_PROFILE_PATH):
        self.profile = self._load_profile(creator_profile_path)

    def _load_profile(self, path: str) -> Dict[str, Any]:
        if os.path.exists(path):
            with open(path, "r", encoding="utf-8") as f:
                return json.load(f)
        return {
            "name": "Creador",
            "active_conversion_goal": "EMAIL_LEAD_CAPTURE",
            "conversion_goals_catalog": {}
        }

    def get_cta_for_goal(self, goal_key: Optional[str] = None) -> str:
        goal = goal_key or self.profile.get("active_conversion_goal", "EMAIL_LEAD_CAPTURE")
        catalog = self.profile.get("conversion_goals_catalog", {})
        goal_data = catalog.get(goal, {})
        style = goal_data.get("preferred_cta_style", "Sigueme para mas contenido.")
        trigger = goal_data.get("trigger_word", "")
        return style.replace("[TRIGGER_WORD]", trigger)

    def generate_youtube_metadata(self, title: str, summary: str, chapters: List[Dict[str, str]], goal_key: Optional[str] = None) -> Dict[str, Any]:
        """
        Optimizacion YouTube:
        - Titulo conciso (<60 caracteres para visualizacion movil).
        - Primeras 2 lineas (<150 caracteres) con palabras clave para busqueda.
        - Capitulos / Marcas de tiempo obligatorias (retencion).
        - CTA hacia canal o lista propia al final.
        """
        clean_title = title[:60].strip()
        cta_text = self.get_cta_for_goal(goal_key)
        
        description_lines = [
            summary[:150].strip(),
            "",
            "MARCAS DE TIEMPO / CAPITULOS:"
        ]
        for ch in chapters:
            description_lines.append(f"{ch.get('time', '00:00')} - {ch.get('title', 'Capitulo')}")
            
        description_lines.extend([
            "",
            "RECURSO DESTACADO:",
            cta_text,
            "",
            "Suscribete para analisis semanales sobre sistemas y creacion de contenido.",
            "#Productividad #Sistemas #Negocios"
        ])

        return {
            "platform": "YouTube",
            "title": clean_title,
            "description": "\n".join(description_lines),
            "tags": ["sistemas", "productividad", "automatizacion", "negocios", "creadores"],
            "privacy_status": "unlisted",
            "notify_subscribers": True
        }

    def generate_instagram_caption(self, hook_first_line: str, core_value: str, goal_key: Optional[str] = None) -> Dict[str, Any]:
        """
        Optimizacion Instagram Reels:
        - Hook en 1a linea (<125 caracteres) antes de la etiqueta mas (despertar curiosidad).
        - Micro-copy con valor estructurado y espacios limpios.
        - Llamada a accion dual: Trigger palabra clave + Sends per Reach.
        - 3 a 5 hashtags especificos de nicho.
        """
        hook_truncated = hook_first_line[:120].strip()
        cta_text = self.get_cta_for_goal(goal_key)
        
        caption_lines = [
            hook_truncated,
            "",
            core_value.strip(),
            "",
            "COMO APLICARLO:",
            f"1. {cta_text}",
            "2. Enviale este video a ese colega que necesita entender este principio.",
            "",
            "Guarda este reel para cuando vayas a estructurar tu proximo proyecto.",
            "",
            "#SistemasDeNegocio #Solopreneur #AutomatizacionIA #ProductividadDigital #EcosistemaDeContenido"
        ]

        caption = "\n".join(caption_lines)
        return {
            "platform": "Instagram_Reels",
            "caption": caption,
            "first_line_chars": len(hook_truncated),
            "share_to_feed": True,
            "target_metric": "Sends per Reach (>2.0%)"
        }

    def generate_tiktok_caption(self, seo_title: str, debate_question: str, goal_key: Optional[str] = None) -> Dict[str, Any]:
        """
        Optimizacion TikTok:
        - Texto indexable para TikTok Search (intencion de busqueda).
        - Pregunta polarizante para estimular comentarios en los primeros 30 minutos.
        - Hashtags categorizados.
        - Longitud controlada (150 a 300 caracteres).
        """
        cta_text = self.get_cta_for_goal(goal_key)
        caption = f"{seo_title}. {debate_question} {cta_text} #AprendeEnTikTok #NegociosOnline #Automatizacion #Productividad"
        return {
            "platform": "TikTok",
            "caption": caption[:300].strip(),
            "allow_comments": True,
            "allow_duet": True,
            "allow_stitch": True,
            "target_metric": "Completion Rate (>60%)"
        }

    def generate_linkedin_post(self, headline: str, thesis_points: List[str], goal_key: Optional[str] = None) -> Dict[str, Any]:
        """
        Optimizacion LinkedIn (Algoritmo y Dwell Time):
        - 2 primeras lineas atractivas antes del corte (<140 caracteres).
        - Formato de espaciado limpio para lectura ejecutiva movil.
        - CERO enlaces en el cuerpo principal (evita penalizacion de alcance).
        - Pregunta abierta de alto debate profesional al final.
        - Enlace en primer comentario.
        """
        first_lines = headline[:135].strip()
        cta_text = self.get_cta_for_goal(goal_key)
        
        post_body = [
            first_lines,
            "",
            "La mayoria de los directivos confunden apalancamiento con acumular empleados y reuniones.",
            "",
            "Aqui esta la diferencia que los mejores operadores aplican en 2026:",
            ""
        ]
        
        for pt in thesis_points:
            post_body.append(f"• {pt}")
            
        post_body.extend([
            "",
            "La tecnologia debe absorber el trabajo repetitivo para que recuperes tu libertad mental.",
            "",
            "Cual es tu mayor cuello de botella operativo actualmente? Te leo en los comentarios.",
            "",
            "#Productividad #Automatizacion #Liderazgo #Sistemas"
        ])

        first_comment = f"Si quieres profundizar en el marco completo: {cta_text}"

        return {
            "platform": "LinkedIn",
            "body": "\n".join(post_body),
            "first_comment": first_comment,
            "has_link_in_body": False,
            "target_metric": "Dwell Time & Qualified Comments"
        }

class SocialPublisherClient:
    """Cliente para coordinar la publicacion directa mediante servidores MCP."""

    def __init__(self, copy_generator: Optional[SocialCopyGenerator] = None):
        self.generator = copy_generator or SocialCopyGenerator()

    def validate_preflight(self, platform: str, payload: Dict[str, Any]) -> List[str]:
        errors = []
        if platform == "LinkedIn":
            body = payload.get("body", "")
            if "http://" in body or "https://" in body:
                errors.append("Alerta: Enlace web detectado en el cuerpo del post de LinkedIn. Recomendado mover al primer comentario.")
        elif platform == "Instagram":
            first_line_len = payload.get("first_line_chars", 0)
            if first_line_len > 125:
                errors.append(f"Alerta: La primera linea supera 125 caracteres ({first_line_len}), se truncara antes del pliegue.")
        elif platform == "YouTube":
            title = payload.get("title", "")
            if len(title) > 65:
                errors.append(f"Alerta: El titulo supera 65 caracteres ({len(title)}), se truncara en moviles.")
        return errors

    def execute_publish(self, platform: str, payload: Dict[str, Any], auth_token: str) -> Dict[str, Any]:
        if not auth_token or not auth_token.startswith("HITL_AUTH_CREATOR_OK"):
            raise PermissionError(
                f"ACCESO DENEGADO [Tier 3 HITL]: Se requiere la firma del creador para publicar en {platform}."
            )
            
        preflight_warnings = self.validate_preflight(platform, payload)
        simulated_id = f"PUB_{platform.upper()}_{int(time.time())}"
        
        return {
            "status": "SUCCESS",
            "platform": platform,
            "publication_id": simulated_id,
            "canonical_reference": f"urn:{platform.lower()}:{simulated_id}",
            "preflight_warnings": preflight_warnings,
            "auth_verified": True
        }
