module.exports = {
  apps: [{
    name: 'casa-corrently-ipfs-edge',
    script: 'standalone.js',
    max_memory_restart: '320M',
    restart_delay: 3000
  }],
  "deploy" : {
     "production" : {
       "user" : "corrently",
       "host" : ["l2.stromdao.de","node.corrently.io"],
       "ref"  : "origin/master",
       "repo" : "https://github.com/energychain/casa-corrently-ipfs-edge.git",
       "path" : "/opt/casa-corrently/ipfs-edge",
       "post-deploy" : "npm install; npm ci; pm2 startOrRestart ecosystem.json --env production",
      },
   }
}
