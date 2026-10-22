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

def procesar_accion(payload: dict) -> dict:
    action = payload.get("action")
    data = payload.get("data", {})

    if action == "generate_challenge":
        tema = data.get("tema", "Algoritmos y Lógica")
        dificultad = data.get("dificultad", "media")
        existentes = data.get("existentes", [])
        return ai_tutor.generar_reto(tema=tema, dificultad=dificultad, retos_existentes=existentes)

    elif action == "generate_project":
        tema = data.get("tema", "Arquitectura y POO")
        dificultad = data.get("dificultad", "media")
        existentes = data.get("existentes", [])
        return ai_tutor.generar_proyecto(tema=tema, dificultad=dificultad, proyectos_existentes=existentes)

    elif action == "hint_challenge":
        return ai_tutor.generar_pista_reto(data)

    elif action == "hint_project":
        return ai_tutor.generar_pista_proyecto(data)

    elif action == "explain_error":
        return ai_tutor.explicar_error(data)

    elif action == "chat":
        mensaje = data.get("mensaje", "")
        historial = data.get("historial", [])
        contexto = data.get("contexto", {})
        return ai_tutor.responder_chat(mensaje=mensaje, historial=historial, contexto=contexto)

    elif action == "solve_challenge":
        return ai_tutor.resolver_reto(data)

    elif action == "solve_project":
        return ai_tutor.resolver_proyecto(data)

    elif action == "generate_exam":
        num_preguntas = data.get("num_preguntas", 25)
        return ai_tutor.generar_examen_certificacion(num_preguntas=num_preguntas)

    elif action == "generate_question":
        area = data.get("area", "sintaxis")
        dificultad = data.get("dificultad", "media")
        tema = data.get("tema", "")
        return ai_tutor.generar_pregunta_banco(area=area, dificultad=dificultad, tema=tema)

    elif action == "generate_bank":
        num_preguntas = data.get("num_preguntas", 20)
        perfil = data.get("perfil_dificultad", "balanceado")
        return ai_tutor.generar_banco_completo(num_preguntas=num_preguntas, perfil_dificultad=perfil)

    else:
        return {"success": False, "error": f"Acción desconocida: {action}"}

def ejecutar_daemon():
    """Modo worker persistente: lee línea por línea (NDJSON) manteniendo el intérprete caliente en memoria"""
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        if line == "PING":
            print(json.dumps({"pong": True}))
            sys.stdout.flush()
            continue
        try:
            payload = json.loads(line)
            req_id = payload.get("id")
            resultado = procesar_accion(payload)
            if req_id is not None:
                resultado["id"] = req_id
            print(json.dumps(resultado, ensure_ascii=False))
        except Exception as e:
            print(json.dumps({"success": False, "error": str(e)}))
        sys.stdout.flush()

def main():
    if "--daemon" in sys.argv:
        ejecutar_daemon()
        return

    try:
        raw_input = sys.stdin.read()
        if not raw_input.strip():
            print(json.dumps({"success": False, "error": "No input data provided"}))
            return

        payload = json.loads(raw_input)
        resultado = procesar_accion(payload)
        print(json.dumps(resultado, ensure_ascii=False))

    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))

if __name__ == "__main__":
    main()
