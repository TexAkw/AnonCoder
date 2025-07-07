FROM debian:bullseye-slim
RUN apt update && apt install -y wget && apt autoclean
# Install conda
RUN wget https://repo.anaconda.com/miniconda/Miniconda3-py310_23.11.0-2-Linux-$(uname -m).sh && \
    bash Miniconda3-py310_23.11.0-2-Linux-$(uname -m).sh -b -p /miniconda && \
    rm Miniconda3-py310_23.11.0-2-Linux-$(uname -m).sh
# Add Miniconda to PATH
ENV PATH=/miniconda/bin:${PATH}
WORKDIR /opt/custom_proxy
COPY ["./requirements.yml", "./pyproject.toml", "/opt/custom_proxy/"]
RUN conda env create -f requirements.yml && \
    conda clean -afy && \
    rm -rf /root/.cache/pip
RUN conda init bash && \
    echo "conda activate boslai_proxy" >> ~/.bashrc
SHELL ["conda", "run", "-n", "boslai_proxy", "/bin/bash", "-c"]
RUN poetry install --only main

COPY ["./generation/", "/opt/custom_proxy/generation/"]
COPY ["./services/", "/opt/custom_proxy/services/"]
COPY ["./schemas/", "/opt/custom_proxy/schemas/"]
COPY ["./data_manager/", "/opt/custom_proxy/data_manager/"]
COPY ["./proxy.py", "/opt/custom_proxy/proxy.py"]

ENV PATH=/miniconda/envs/boslai_proxy/bin:${PATH}