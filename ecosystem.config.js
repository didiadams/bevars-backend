module.exports = {
  apps: [
    {
      name: 'bevars-backend',
      script: 'dist/main.js',
      cwd: '/home/bevars/bevars-exporters/backend',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 3001
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3001
      },
      log_file: '/home/bevars/logs/bevars-backend.log',
      error_file: '/home/bevars/logs/bevars-backend-error.log',
      out_file: '/home/bevars/logs/bevars-backend-out.log',
      pid_file: '/home/bevars/logs/bevars-backend.pid',
      restart_delay: 4000,
      max_restarts: 5,
      min_uptime: '10s',
      watch: false,
      ignore_watch: ['node_modules', 'logs'],
      max_memory_restart: '1G'
    },
  {
  name: 'bevars-frontend',
  script: 'node_modules/next/dist/bin/next',
  args: 'start -p 3000',
  cwd: '/home/bevars/bevars-exporters/frontend',
  instances: 1,
  exec_mode: 'fork',
  env: {
    NODE_ENV: 'production',
    PORT: 3000
  },
  env_production: {
    NODE_ENV: 'production',
    PORT: 3000
  },
  log_file: '/home/bevars/logs/bevars-frontend.log',
  error_file: '/home/bevars/logs/bevars-frontend-error.log',
  out_file: '/home/bevars/logs/bevars-frontend-out.log',
  pid_file: '/home/bevars/logs/bevars-frontend.pid',
  restart_delay: 4000,
  max_restarts: 5,
  min_uptime: '10s',
  watch: false,
  ignore_watch: ['node_modules', 'logs', '.next'],
  max_memory_restart: '1G'
}

  ]
};
