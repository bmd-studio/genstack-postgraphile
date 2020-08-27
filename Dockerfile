ARG DOCKER_IMAGE
ARG GS_ENV

FROM $DOCKER_IMAGE AS build_shared 
ARG GS_ENV
ARG DOCKER_CONTAINER_PLUGINS_PATH

COPY ./ /usr/src/app
WORKDIR /usr/src/app/

RUN /bin/bash setup.sh

FROM build_shared AS build_development
RUN echo "Building development image..."

FROM build_shared AS build_staging
RUN echo "Building staging image..."

FROM build_shared AS build_production
RUN echo "Building production image..."

FROM build_${GS_ENV}

RUN echo "Running ${GS_ENV} image..."
WORKDIR /usr/src/app/

COPY docker-healthcheck.js /usr/local/lib/
HEALTHCHECK --interval=5s --timeout=10s CMD node /usr/local/lib/docker-healthcheck.js

USER node

#CMD tail -f /dev/null
CMD ["/bin/bash", "exec.sh"]
