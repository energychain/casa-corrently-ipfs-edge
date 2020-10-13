module.exports = function(config) {
  const { Worker } = require('worker_threads');
  const fs = require('fs');
  let ipfs_service = null;

  let msgcids = {};

  const _ipfs_init = async function(config) {
    const fileExists = async path => !!(await fs.promises.stat(path).catch(e => false));

    let workerFile = __dirname + '/node_modules/casa-corrently-ipfs-edge/ipfs_service.js';
    if(!await fileExists(workerFile)) workerFile = __dirname + '/./ipfs_service.js';
    if(!await fileExists(workerFile)) workerFile = './ipfs_service.js';

    ipfs_service = new Worker(workerFile,{workerData:config});
    ipfs_service.on('message', function(_data) {
      if(typeof _data.msgcids !== 'undefined') {
        msgcids = _data.msgcids;
      }
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
     return;
  };

  return {
      info: async function(req) {
        if(ipfs_service == null) await _ipfs_init(config);
        if(typeof req.method == 'undefined') req.method = 'ls';

        if(req.method == 'ls') {
          return msgcids;
        } else
        if(req.method == 'self') {
          //return await ipfs.id();
          return {};
        } else
        if(req.method == 'msg') {
          let cid = req.peer;
          if(typeof msgcids[cid] == 'undefined') return {}; else {
              content = JSON.parse(msgcids[cid].content);
              return content;
          }
        } else return {};
      },
      statics:async function() {
          if(ipfs_service == null) await _ipfs_init(config);
      },
      publish: async function(msg,alias) {
          if(ipfs_service == null) await _ipfs_init(config);
          ipfs_service.postMessage({"msg":msg,"alias":alias});
      }
    }
};
