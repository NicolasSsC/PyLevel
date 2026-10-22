import sys
import json
import os
import io

# Force UTF-8 on Windows
if sys.platform == "win32":
    try:
        sys.stdin = io.TextIOWrapper(sys.stdin.buffer, encoding="utf-8", errors="replace")
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
        sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")
    except Exception:
        pass

# Ensure the module directory is in sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from ai_tutor import ai_tutor

def main():
    try:
        raw_input = sys.stdin.read()
        if not raw_input.strip():
            print(json.dumps({"success": False, "error": "No input data provided"}))
            return

        payload = json.loads(raw_input)
        action = payload.get("action")
        data = payload.get("data", {})

        if action == "generate_challenge":
            tema = data.get("tema", "Algoritmos y Lógica")
            dificultad = data.get("dificultad", "media")
            existentes = data.get("existentes", [])
            resultado = ai_tutor.generar_reto(tema=tema, dificultad=dificultad, retos_existentes=existentes)
            print(json.dumps(resultado, ensure_ascii=False))

        elif action == "generate_project":
            tema = data.get("tema", "Arquitectura y POO")
            dificultad = data.get("dificultad", "media")
            existentes = data.get("existentes", [])
            resultado = ai_tutor.generar_proyecto(tema=tema, dificultad=dificultad, proyectos_existentes=existentes)
            print(json.dumps(resultado, ensure_ascii=False))

        elif action == "hint_challenge":
            resultado = ai_tutor.generar_pista_reto(data)
            print(json.dumps(resultado, ensure_ascii=False))

        elif action == "hint_project":
            resultado = ai_tutor.generar_pista_proyecto(data)
            print(json.dumps(resultado, ensure_ascii=False))

        elif action == "explain_error":
            resultado = ai_tutor.explicar_error(data)
            print(json.dumps(resultado, ensure_ascii=False))

        elif action == "chat":
            mensaje = data.get("mensaje", "")
            historial = data.get("historial", [])
            contexto = data.get("contexto", {})
            resultado = ai_tutor.responder_chat(mensaje=mensaje, historial=historial, contexto=contexto)
            print(json.dumps(resultado, ensure_ascii=False))

        elif action == "solve_challenge":
            resultado = ai_tutor.resolver_reto(data)
            print(json.dumps(resultado, ensure_ascii=False))

        elif action == "solve_project":
            resultado = ai_tutor.resolver_proyecto(data)
            print(json.dumps(resultado, ensure_ascii=False))

        else:
            print(json.dumps({"success": False, "error": f"Acción desconocida: {action}"}))

    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))

if __name__ == "__main__":
    main()
