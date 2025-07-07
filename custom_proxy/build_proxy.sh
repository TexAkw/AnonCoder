#!/bin/bash
echo "Build proxy"
docker compose -f ./custom_proxy/docker-compose-proxy.yml down
docker compose -f ./custom_proxy/docker-compose-proxy.yml build