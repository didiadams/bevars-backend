module.exports = {
  apps: [
    {
      name: 'bevars-backend',
      script: 'dist/main.js',
      cwd: '/home/bevars/bevars-exporters/backend',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
      },
      error_file: '/home/bevars/logs/backend-error.log',
      out_file: '/home/bevars/logs/backend-out.log',
      log_file: '/home/bevars/logs/backend-combined.log',
      time: true,
    },
    {
      name: 'bevars-frontend',
      script: 'npm',
      args: 'start',
      cwd: '/home/bevars/bevars-exporters/frontend',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      error_file: '/home/bevars/logs/frontend-error.log',
      out_file: '/home/bevars/logs/frontend-out.log',
      log_file: '/home/bevars/logs/frontend-combined.log',
      time: true,
    },
  ],
};