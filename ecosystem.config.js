module.exports = {
  apps : [{
    name   : "tbot",
    script : "./index.js",
    max_memory_restart:'1G',
    autorestart: true,
  }]
}
