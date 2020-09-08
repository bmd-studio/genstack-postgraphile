ARG DOCKER_IMAGE
FROM $DOCKER_IMAGE

WORKDIR /usr/src/app/
COPY ./ ./
ARG DOCKER_CONTAINER_PLUGINS_PATH
ARG GS_ENV
RUN /bin/bash setup.sh

COPY docker-healthcheck.js /usr/local/lib/
HEALTHCHECK --interval=5s --timeout=10s CMD node /usr/local/lib/docker-healthcheck.js

USER node

#CMD tail -f /dev/null
CMD ["/bin/bash", "exec.sh"]
