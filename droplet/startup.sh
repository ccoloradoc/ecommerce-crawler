#!/bin/bash
GW=$(ip r | grep default | grep -o '[0-9]\{1,3\}\.[0-9]\{1,3\}\.[0-9]\{1,3\}\.[0-9]\{1,3\}')
IP=$(curl -s https://raw.githubusercontent.com/ccoloradoc/ecommerce-crawler/master/droplet/ip)
echo "route add -host $IP gw $GW"
