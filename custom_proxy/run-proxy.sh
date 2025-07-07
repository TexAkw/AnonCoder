echo "Run proxy"
echo "#############################################################"
echo "  use the --reinit flag to remove all data in the databases"
echo "#############################################################"

if [ "$1" == "--reinit" ]; then
    echo "Reinit databases & broker"
    docker compose -f ./custom_proxy/docker-compose-proxy.yml down
    echo "Remove volumes:"
    docker volume rm custom_proxy_proxy-postgresdb-data
    echo "Reinit done"
fi


docker compose -f ./custom_proxy/docker-compose-proxy.yml down
docker compose -f ./custom_proxy/docker-compose-proxy.yml up -d