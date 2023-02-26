#!/bin/bash

INSTALL_ROOT="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
NETWORK_NAME=$(cat $INSTALL_ROOT/config.json | jq -r '.networkName')


if [[ `pwd` != "$INSTALL_ROOT" ]]; then
  echo "Please run this script from $INSTALL_ROOT"
  exit 1
fi

yarn run build
PM2_NAME="$NETWORK_NAME-nft-scraper"

echo "Starting $PM2_NAME..."
pm2 start --only "$PM2_NAME" --update-env
