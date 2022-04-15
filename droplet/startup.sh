#!/bin/bash
GW=$(ip r | grep default | grep -o '[0-9]\{1,3\}\.[0-9]\{1,3\}\.[0-9]\{1,3\}\.[0-9]\{1,3\}')
IP=$(curl -s https://raw.githubusercontent.com/ccoloradoc/ecommerce-crawler/feature/digital-ocean/droplet/ip)
echo "route add -host $IP gw $GW"

route add -host $IP gw $GW

#sudo route del -net $IP gw $GW netmask 255.255.255.255 dev eth0
