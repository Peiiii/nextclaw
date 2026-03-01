FROM ubuntu:24.04

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates curl xz-utils tar bash \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /work
COPY smoke-node-bootstrap.sh /work/smoke-node-bootstrap.sh

ENTRYPOINT ["/bin/bash", "/work/smoke-node-bootstrap.sh"]
