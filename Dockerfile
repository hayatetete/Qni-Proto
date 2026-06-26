# Note:
# The default command starts the Vite server using `yarn dev`.
# You can override this default command using `docker run` with a different command.
#
# Examples:
# 1. Build the Docker image:
#    docker build -f Dockerfile . -t qni-gl
#    - This command builds the Docker image using the Dockerfile in the current directory and tags it as `qni-gl`.
#
# 2. Start an interactive bash session inside the container:
#    docker run --gpus all -p 8000:8000 --rm -it qni-gl /bin/bash
#    - This will start a bash session instead of the Vite server.
#    - Useful for debugging or running other commands manually.
#
# 3. Start the Vite server with the source code mounted from the host:
#    docker run --gpus all -p 8000:8000 --rm -it -v $(pwd):/qni-gl qni-gl
#    - The `-v $(pwd):/qni-gl` option mounts the current directory from the host to the container.
#    - This allows you to edit files on your host and see changes immediately in the container.
#
# 4. Run a different command inside the container:
#    docker run --gpus all -p 8000:8000 --rm -it qni-gl /bin/bash -c "yarn build"
#    - This will execute `yarn build` inside the container instead of the default `yarn dev`.
#
# 5. Run the container without mounting the source code:
#    docker run --gpus all -p 8000:8000 --rm -it qni-gl
#    - This will start the Vite server using the code copied into the container during the build.

FROM nvidia/cuda:12.6.1-devel-ubuntu22.04

ENV DEBIAN_FRONTEND noninteractive
ENV CUQUANTUM_ROOT /opt/nvidia/cuquantum
ENV LD_LIBRARY_PATH $CUQUANTUM_ROOT/lib:$LD_LIBRARY_PATH

RUN apt update && \
  apt install -y git wget curl

# Install Node.js
RUN curl -fsSL https://deb.nodesource.com/setup_lts.x | bash - && \
  apt install -y --no-install-recommends nodejs

# Install npm
RUN curl -qL https://www.npmjs.com/install.sh | sh

# Install yarn
RUN npm install -g yarn

# Install cuquantum and cutensor
RUN wget https://developer.download.nvidia.com/compute/cuquantum/24.08.0/local_installers/cuquantum-local-repo-ubuntu2204-24.08.0_24.08.0-1_amd64.deb && \
  dpkg -i cuquantum-local-repo-ubuntu2204-24.08.0_24.08.0-1_amd64.deb && \
  cp /var/cuquantum-local-repo-ubuntu2204-24.08.0/cuquantum-*-keyring.gpg /usr/share/keyrings/ && \
  wget https://developer.download.nvidia.com/compute/cutensor/2.0.2.1/local_installers/cutensor-local-repo-ubuntu2204-2.0.2_1.0-1_amd64.deb && \
  dpkg -i cutensor-local-repo-ubuntu2204-2.0.2_1.0-1_amd64.deb && \
  cp /var/cutensor-local-repo-ubuntu2204-2.0.2/cutensor-*-keyring.gpg /usr/share/keyrings/ && \
  apt update && \
  apt -y install cuquantum-cuda-12 libcutensor1 libcutensor2 libcutensor-dev libcutensor-doc

# Setup Python
RUN apt install -y software-properties-common && \
  add-apt-repository ppa:deadsnakes/ppa && \
  apt -y update && \    
  apt install -y python3.10-dev python3-pip && \
  update-alternatives --install /usr/bin/python python /usr/bin/python3 1 && \
  update-alternatives --install /usr/bin/pip pip /usr/bin/pip3 1

# Install nginx and other dependencies
RUN apt install -y --no-install-recommends nginx apache2-utils python3-flask

# Install necessary dependencies
RUN apt install -y cmake python3-skbuild libopenblas-dev && \
  pip install hatch gunicorn flask-cors && \
  pip install pybind11 pluginbase patch-ng node-semver bottle PyJWT fasteners distro colorama "conan<2.0" && \
  pip install "qiskit[all]" && \
  pip uninstall -y qiskit-aer

# Install qiskit-aer
RUN git clone -b stable/0.15 https://github.com/Qiskit/qiskit-aer/ && \
  cd qiskit-aer && \
  python ./setup.py bdist_wheel -- -DAER_THRUST_BACKEND=CUDA -DAER_PYTHON_CUDA_ROOT=qiskit-aer-venv && \
  pip install dist/qiskit_aer-0.15.1-cp**-cp**-linux_x86_64.whl && \
  cd .. && \
  rm -rf qiskit_aer

# Clean up
RUN rm -rf /var/lib/apt/lists/* /var/cache/apt/archives  

# Prepare nginx configuration
COPY backend/merged.conf /etc/nginx/conf.d/
RUN htpasswd -bc /etc/nginx/.htpasswd userA passA

# Copy the source code
RUN mkdir /qni-gl
COPY . /qni-gl

# Copy the entrypoint script and set permissions
COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh
ENTRYPOINT ["docker-entrypoint.sh"]

# Install dependencies
WORKDIR /qni-gl/frontend
RUN yarn

CMD ["/bin/bash"]
