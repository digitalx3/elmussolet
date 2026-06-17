module.exports = {
  apps: [
    {
      name: 'elmussolet-api',
      script: 'src/server.js',
      cwd: '/var/www/elmussolet/vps-backend',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '300M',
      env: { NODE_ENV: 'production' },
    },
  ],
};
