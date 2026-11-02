"""Rastreador de ejecución de código Python para PyLevel."""

import os
import sys

MAX_STEPS = 200
MAX_VARIABLES = 20
MAX_VALUE_LENGTH = 120


def safe_value(value):
    """Representa valores sin ejecutar código personalizado del estudiante."""
    if value is None or type(value) in (bool, int, float):
        return value

    if type(value) is str:
        return value[:MAX_VALUE_LENGTH]

    if type(value) in (list, tuple):
        return [safe_value(item) for item in value[:10]]

    if type(value) is dict:
        result = {}
        for key, item in list(value.items())[:10]:
            if type(key) in (str, int, float, bool):
                result[str(key)[:40]] = safe_value(item)
        return result

    return f"<{type(value).__name__}>"


def trace_file(filename, max_steps=MAX_STEPS):
    """Ejecuta un archivo y captura sus líneas y variables."""
    workspace = os.path.realpath("/workspace")
    filename = os.path.realpath(filename)

    if not filename.startswith(workspace + os.sep):
        raise ValueError("El archivo debe estar dentro del espacio de trabajo.")

    if not os.path.isfile(filename):
        raise ValueError("No se encontró el archivo.")

    if type(max_steps) is not int or not 1 <= max_steps <= MAX_STEPS:
        raise ValueError("Límite de pasos inválido.")

    steps = []
    stopped = False

    def tracer(frame, event, arg):
        nonlocal stopped

        if event != "line":
            return tracer

        current_file = os.path.realpath(frame.f_code.co_filename)

        if not current_file.startswith(workspace + os.sep):
            return tracer

        if len(steps) >= max_steps:
            stopped = True
            raise RuntimeError("TRACE_STEP_LIMIT")

        variables = {}

        for name, value in list(frame.f_locals.items())[:MAX_VARIABLES]:
            if not name.startswith("__"):
                variables[name] = safe_value(value)

        steps.append({
            "step": len(steps) + 1,
            "file": os.path.relpath(current_file, workspace),
            "line": frame.f_lineno,
            "function": frame.f_code.co_name,
            "variables": variables,
        })

        return tracer

    previous_trace = sys.gettrace()

    try:
        with open(filename, "rb") as source:
            code = compile(source.read(), filename, "exec")

        namespace = {
            "__name__": "__main__",
            "__file__": filename,
        }

        sys.settrace(tracer)

        try:
            exec(code, namespace)
        except RuntimeError as error:
            if str(error) != "TRACE_STEP_LIMIT":
                raise
    finally:
        sys.settrace(previous_trace)

    return {
        "steps": steps,
        "total_steps": len(steps),
        "truncated": stopped,
    }