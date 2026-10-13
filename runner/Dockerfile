ARG PYTHON_BASE=python:3.12-slim@sha256:a6e34c598f2467ed0e9a8d349809fcd8b5c603269512df273a0bb1784edc11b1
FROM ${PYTHON_BASE}
COPY --chmod=0444 bootstrap.py /opt/pylevel/bootstrap.py
RUN chmod 0755 /opt/pylevel
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
USER 65534:65534
WORKDIR /workspace
ENTRYPOINT ["python", "-I", "/opt/pylevel/bootstrap.py"]
