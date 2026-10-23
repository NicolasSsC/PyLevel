"""
Módulo de Inteligencia Artificial y Tutor Pedagógico para PyLevel (Facade Principal)
Arquitectura modular y limpia que delega responsabilidades a submódulos especializados:
- provider.py: Conectividad HTTP REST a Google Gemini con fallback de modelos
- chat.py: Chat interactivo con PyBot y base de conocimientos pedagógica
- diagnostics.py: Diagnóstico heurístico de errores y explicaciones con IA
- challenges.py: Generación, pistas socráticas y resolución de retos algorítmicos
- projects.py: Generación de proyectos multi-archivo, test runners y resolución guiada
- exams.py: Generación de exámenes de certificación y bancos de preguntas
"""

import sys
import os
from typing import Dict, Any, Optional, List

# Garantizar que el directorio actual de src/ai esté en el sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from provider import GeminiProvider
from chat import ChatManager
from diagnostics import DiagnosticsManager
from challenges import ChallengesManager
from projects import ProjectsManager
from exams import ExamsManager

class AITutor:
    """Tutor pedagógico inteligente con arquitectura modular y soporte híbrido (Gemini + Local)"""

    def __init__(self, api_key: Optional[str] = None):
        self.provider = GeminiProvider(api_key=api_key)
        self.chat_mgr = ChatManager(self.provider)
        self.diag_mgr = DiagnosticsManager(self.provider)
        self.challenges_mgr = ChallengesManager(self.provider)
        self.projects_mgr = ProjectsManager(self.provider)
        self.exams_mgr = ExamsManager(self.provider)

    # Propiedades de compatibilidad con código existente
    @property
    def api_key(self) -> Optional[str]:
        return self.provider.api_key

    @api_key.setter
    def api_key(self, value: Optional[str]):
        self.provider.configurar_api_key(value or '')

    @property
    def modelo(self) -> str:
        return self.provider.modelo

    @modelo.setter
    def modelo(self, value: str):
        self.provider.modelo = value

    @property
    def modelos_candidatos(self) -> List[str]:
        return self.provider.modelos_candidatos

    @property
    def timeout(self) -> float:
        return self.provider.timeout

    @timeout.setter
    def timeout(self, val: float):
        self.provider.timeout = val

    # =========================================================================
    # CONFIGURACIÓN Y CONSULTA DIRECTA
    # =========================================================================

    def configurar_api_key(self, key: str):
        """Actualiza la clave en tiempo de ejecución"""
        self.provider.configurar_api_key(key)

    def tiene_api_key(self) -> bool:
        """Indica si existe una clave de Gemini válida"""
        return self.provider.tiene_api_key()

    def consultar_gemini(self, prompt: str, system_instruction: str = "", max_tokens: int = 800, temperature: float = 0.4, timeout: Optional[float] = None) -> Optional[str]:
        """Consulta directa a la API REST de Google Gemini"""
        return self.provider.consultar(prompt, system_instruction, max_tokens, temperature, timeout)

    # =========================================================================
    # DIAGNÓSTICO Y EXPLICACIÓN DE ERRORES
    # =========================================================================

    def explicar_error(self, datos: Dict[str, Any]) -> Dict[str, Any]:
        """Genera una explicación pedagógica basada en el error, código y casos de prueba"""
        return self.diag_mgr.explicar_error(datos)

    # =========================================================================
    # CHAT INTERACTIVO CON PYBOT
    # =========================================================================

    def responder_chat(self, mensaje: str, historial: Optional[List[Dict]] = None, contexto: Optional[Dict] = None) -> Dict[str, Any]:
        """Responde preguntas libres sobre Python hechas por el estudiante"""
        return self.chat_mgr.responder(mensaje, historial, contexto)

    # =========================================================================
    # RETOS DE CÓDIGO
    # =========================================================================

    def generar_reto(self, tema: str = 'General', dificultad: str = 'media', retos_existentes: Optional[List[str]] = None) -> Dict[str, Any]:
        """Genera un nuevo reto algorítmico en Python con Gemini o generador local"""
        return self.challenges_mgr.generar_reto(tema, dificultad, retos_existentes)

    def generar_pista_reto(self, datos: Dict[str, Any]) -> Dict[str, Any]:
        """Genera una pista socrática para el reto de código"""
        return self.challenges_mgr.generar_pista_reto(datos)

    def generar_pista_pregunta_duo(self, datos: Dict[str, Any]) -> Dict[str, Any]:
        """Genera una pista pedagógica para preguntas de mundos de aprendizaje"""
        return self.challenges_mgr.generar_pista_pregunta_duo(datos)

    def resolver_reto(self, datos: Dict[str, Any]) -> Dict[str, Any]:
        """Resuelve el reto con explicación paso a paso y análisis de complejidad"""
        return self.challenges_mgr.resolver_reto(datos)

    # =========================================================================
    # PROYECTOS MULTI-ARCHIVO
    # =========================================================================

    def generar_proyecto(self, tema: str = 'General', dificultad: str = 'media', proyectos_existentes: Optional[List[str]] = None) -> Dict[str, Any]:
        """Genera un proyecto práctico modular en Python con Gemini o generador local"""
        return self.projects_mgr.generar_proyecto(tema, dificultad, proyectos_existentes)

    def generar_pista_proyecto(self, datos: Dict[str, Any]) -> Dict[str, Any]:
        """Genera una pista guiada para el archivo activo del proyecto"""
        return self.projects_mgr.generar_pista_proyecto(datos)

    def resolver_proyecto(self, datos: Dict[str, Any]) -> Dict[str, Any]:
        """Resuelve el archivo activo del proyecto con retroalimentación detallada"""
        return self.projects_mgr.resolver_proyecto(datos)

    # =========================================================================
    # EXÁMENES DE CERTIFICACIÓN Y BANCOS DE PREGUNTAS
    # =========================================================================

    def generar_examen_certificacion(self, num_preguntas: int = 25) -> Dict[str, Any]:
        """Genera un examen completo de certificación con preguntas de alta dificultad"""
        return self.exams_mgr.generar_examen_certificacion(num_preguntas)

    def generar_pregunta_banco(self, area: str = 'sintaxis', dificultad: str = 'media', tema: str = '') -> Dict[str, Any]:
        """Genera una pregunta individual para el banco administrativo"""
        return self.exams_mgr.generar_pregunta_banco(area, dificultad, tema)

    def generar_banco_completo(self, num_preguntas: int = 20, perfil_dificultad: str = 'balanceado') -> Dict[str, Any]:
        """Genera un banco de preguntas balanceado según la dificultad deseada"""
        return self.exams_mgr.generar_banco_completo(num_preguntas, perfil_dificultad)

# Instancia global para importación directa
ai_tutor = AITutor()
