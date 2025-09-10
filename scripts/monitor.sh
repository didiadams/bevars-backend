#!/bin/bash

echo "📊 Bevars Exporters System Status"
echo "================================="

echo "💾 Memory Usage:"
free -h

echo "💿 Disk Usage:"
df -h /

echo "⚡ CPU Usage:"
top -bn1 | grep "Cpu(s)"

echo "🚀 Application Status:"
pm2 status

echo "🗄️ Database Status:"
sudo systemctl status postgresql --no-pager -l

echo "🌐 Nginx Status:"
sudo systemctl status nginx --no-pager -l

echo "🔍 Top Memory Consumers:"
ps aux --sort=-%mem | head -10

echo "✅ Monitoring complete!"
