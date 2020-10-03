Error.stackTraceLimit = 200;

const fs = require("fs");

const boot = async function() {
    const { Worker } = require('worker_threads');
    const fileExists = async path => !!(await fs.promises.stat(path).catch(e => false));

    let workerFile = __dirname + '/node_modules/casa-corrently-ipfs-edge/ipfs_service.js';
    if(!await fileExists(workerFile)) workerFile = __dirname + '/./ipfs_service.js';
    if(!await fileExists(workerFile)) workerFile = './ipfs_service.js';

    const ipfs_service = new Worker(workerFile,{workerData:{name:'ipfs_relay','uuid':'ipfs_relay'}});

    ipfs_service.on('message', function(_data) {
    });
    ipfs_service.on('error', function(e) {
      console.log('Error in Worker',e);
    });
    ipfs_service.on('exit', (code) => {
      console.log('Exit Worker');
      if (code !== 0)
        throw new Error(`Worker stopped with exit code ${code}`);
     });
     console.log('Ipfs Service started');
};
boot();
