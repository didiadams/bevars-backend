#!/bin/bash

# Bevars  - Quick Setup Script for Digital Ocean
# This script automates most of the server setup process

set -e

echo "🚀 Bevars  - Quick Server Setup"
echo "======================================="

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo "❌ Please run this script as root (or with sudo)"
    exit 1
fi

echo "📦 Step 1: Updating system..."
apt update && apt upgrade -y

echo "👤 Step 2: Creating bevars user..."
adduser bevars --disabled-password --gecos ""
usermod -aG sudo bevars

echo "🔐 Step 3: Setting up SSH..."
mkdir -p /home/bevars/.ssh
cp /root/.ssh/authorized_keys /home/bevars/.ssh/
chown -R bevars:bevars /home/bevars/.ssh
chmod 700 /home/bevars/.ssh
chmod 600 /home/bevars/.ssh/authorized_keys

echo "🔥 Step 4: Configuring firewall..."
ufw --force enable
ufw allow ssh
ufw allow 80
ufw allow 443

echo "📦 Step 5: Installing Node.js..."
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt-get install -y nodejs

echo "📦 Step 6: Installing additional packages..."
npm install -g yarn pm2
apt install postgresql postgresql-contrib nginx git -y

echo "🗄️ Step 7: Setting up PostgreSQL..."
systemctl start postgresql
systemctl enable postgresql

echo "🌐 Step 8: Setting up Nginx..."
systemctl start nginx
systemctl enable nginx

echo "✅ Server setup completed!"
echo ""
echo "Next steps:"
echo "1. Switch to bevars user: su - bevars"
echo "2. Clone your repository"
echo "3. Follow the deployment guide"
echo ""
echo "🎉 Your server is ready for Bevars Exporters deployment!"
