# NordVPN Installation

These are the instruction you have to follow to create a digital ocean droplet with open vpn that allow you to connect to nordvpn and keep ssh access to your personal IP address. 

## OpenVPN Installation

Current guide is based on this [post](https://support.nordvpn.com/Connectivity/Linux/1047409422/How-can-I-connect-to-NordVPN-using-Linux-Terminal.htm). And some other resources that complement Installation in digital ocean droplet.

### Installing software

```bash
sudo apt-get update &&
sudo apt-get install openvpn ca-certificates unzip net-tools -y

```

### NordVPN servers
We can download the configuration files in order to connect to each server available: 
```bash
cd /etc/openvpn &&
sudo wget https://downloads.nordcdn.com/configs/archives/servers/ovpn.zip &&
sudo unzip ovpn.zip

```

### OpenVPN configuration
We need to create a file holding the credentials from your nord account.
```bash
echo "<your-nord-user>" >> /etc/openvpn/credentials
echo "<your-nord-password>" >> /etc/openvpn/credentials
```

Once we pick the server we want to connect, we can copy the configuration file to openvpn folder under name *client.conf*
```bash
cp /etc/openvpn/ovpn_tcp/mx86.nordvpn.com.tcp.ovpn /etc/openvpn/client.conf
```

You have to edit the *client.conf* file and provide the reference to the *credentials* file:
```bash
sudo nano client.conf
client.conf
	auth-user-pass /etc/openvpn/credentials
```

### Fix SSH
You have to create a static route so your ip address can connect to the server once OpenVPN is up:
```bash
netstat -rn
# Using netstat identify the server gateway
route add -host <yout-pc-ip> gw <gateway>
```

### Fix SSH on Startup
Create a file */etc/rc/local* and modify the privilegues:
```bash
sudo nano /etc/rc.local
sudo chmod a+x /etc/rc.local
```

Next script will set a direct route from your IP to the default gateway bypassing the vpn
```bash
#!/bin/bash
GW=$(ip r | grep default | grep -o '[0-9]\{1,3\}\.[0-9]\{1,3\}\.[0-9]\{1,3\}\.[0-9]\{1,3\}')
IP=$(curl -s https://raw.githubusercontent.com/ccoloradoc/ecommerce-crawler/feature/digital-ocean/droplet/ip)
echo "route add -host $IP gw $GW"
route add -host $IP gw $GW

```
You can replace the IP in the github project and reboot the droplet

### Fix DNS
 You have to modify the DNS resolution service otherwise you will have troubles resolving address
 ```bash
nano /etc/systemd/resolved.conf
# Modify below entries
	DNS=8.8.8.8 1.1.1.1
	DNSSEC=no
	
sudo systemctl restart systemd-resolved.service
```

### Start OpenVPN
Start OpenVPN service and observe the logs:
```bash
sudo systemctl start openvpn@client && tail -f /var/log/syslog --lines=100
```

You can validate that your behind the vpn by using below service to track your location: 
```bash
curl https://api.myip.com
```
