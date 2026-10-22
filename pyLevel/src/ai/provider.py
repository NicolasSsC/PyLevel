"""
Módulo proveedor de conexión a la API REST de Google Gemini
Gestiona autenticación, lista de modelos compatibles, timeouts y fallback automático.
"""

import os
import json
import urllib.request
import urllib.error
from typing import Optional, Dict, Any, List

class GeminiProvider:
    """Proveedor de conexión HTTP a la API REST de Google Gemini"""

    def __init__(self, api_key: Optional[str] = None, timeout: float = 20.0):
        self.api_key = api_key or os.environ.get('GEMINI_API_KEY') or self._cargar_key_archivo()
        self.modelos_candidatos = [
            "gemini-flash-lite-latest",
            "gemini-3.5-flash-lite",
            "gemini-3-flash-preview",
            "gemini-3.5-flash",
            "gemini-3.8-flash",
            "gemini-flash-latest"
        ]
        self.modelo = self.modelos_candidatos[0]
        self.timeout = timeout

    def _cargar_key_archivo(self) -> Optional[str]:
        """Carga la clave desde .gemini_key o .env si existe en el entorno o rutas padre"""
        base_dir = os.path.dirname(os.path.abspath(__file__))
        rutas = [
            '.gemini_key',
            '.env',
            os.path.join(base_dir, '.env'),
            os.path.join(base_dir, '.gemini_key'),
            os.path.join(base_dir, '..', '..', '.env'),
            os.path.join(base_dir, '..', '..', '.gemini_key'),
            os.path.join(base_dir, '..', '..', '..', '.env'),
            os.path.join(base_dir, '..', '..', '..', '.gemini_key'),
        ]
        for ruta in rutas:
            if os.path.exists(ruta):
                try:
                    with open(ruta, 'r', encoding='utf-8') as f:
                        for linea in f:
                            linea = linea.strip()
                            if linea.startswith('GEMINI_API_KEY='):
                                return linea.split('=', 1)[1].strip().strip('"').strip("'")
                            elif os.path.basename(ruta) == '.gemini_key' and linea and not linea.startswith('#'):
                                return linea
                except Exception:
                    pass
        return None

    def configurar_api_key(self, key: str):
        """Actualiza la clave en tiempo de ejecución"""
        self.api_key = key.strip() if key else None
        if self.api_key:
            os.environ['GEMINI_API_KEY'] = self.api_key
        else:
            os.environ.pop('GEMINI_API_KEY', None)

    def tiene_api_key(self) -> bool:
        """Comprueba si existe una API key válida cargada"""
        if not (self.api_key and len(self.api_key) > 10):
            clave = self._cargar_key_archivo() or os.environ.get('GEMINI_API_KEY')
            if clave and len(clave) > 10:
                self.api_key = clave
        return bool(self.api_key and len(self.api_key) > 10)

    def consultar(self, prompt: str, system_instruction: str = "", max_tokens: int = 800, temperature: float = 0.4, timeout: Optional[float] = None) -> Optional[str]:
        """Realiza una petición HTTP a la API REST de Gemini iterando modelos compatibles"""
        if not self.tiene_api_key():
            return None

        effective_timeout = timeout if timeout is not None else self.timeout

        payload: Dict[str, Any] = {
            "contents": [
                {
                    "parts": [{"text": prompt}]
                }
            ],
            "generationConfig": {
                "temperature": temperature,
                "maxOutputTokens": max_tokens
            }
        }
        if system_instruction:
            payload["systemInstruction"] = {
                "parts": [{"text": system_instruction}]
            }

        headers = {"Content-Type": "application/json"}
        payload_bytes = json.dumps(payload).encode('utf-8')

        for modelo_candidato in self.modelos_candidatos:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{modelo_candidato}:generateContent?key={self.api_key}"
            try:
                req = urllib.request.Request(url, data=payload_bytes, headers=headers, method='POST')
                with urllib.request.urlopen(req, timeout=effective_timeout) as resp:
                    if resp.status == 200:
                        data = json.loads(resp.read().decode('utf-8'))
                        candidates = data.get('candidates', [])
                        if candidates:
                            parts = candidates[0].get('content', {}).get('parts', [])
                            if parts:
                                self.modelo = modelo_candidato
                                return parts[0].get('text', '')
            except Exception:
                continue

        return None
