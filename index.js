const IPFS = require("ipfs");
const axios = require("axios");
const glob = require("glob");
const fs = require("fs");
const fileExists = async path => !!(await fs.promises.stat(path).catch(e => false));
const multiaddr = require("multiaddr");
const topic = 'casa-corrently-beta';
let ipfs = null;

const _publishMsg = async function(msg) {
    await ipfs.files.rm('/msg');
    await ipfs.files.write('/msg',
      JSON.stringify(msg),
      {create:true,parents:true});
    const stats = await ipfs.files.stat('/');
    const addr = '' + stats.cid.toString()+'';
    const res = await ipfs.name.publish(addr);
    const resolve = await ipfs.name.resolve('/ipns/'+res.name,{recursive:true});
    await ipfs.pubsub.publish(topic,JSON.stringify({at:addr}));
    return;
}

module.exports = function() {
    return {
      publish: async function(msg) {
          if(ipfs == null) {
            ipfs = await IPFS.create();
            try {
              ipfs.swarm.connect("/ip4/108.61.210.201/tcp/4001/p2p/QmZW7WWzGB4EPKBE4B4V8zT1tY54xmTvPZsCK8PyTNWT7i").catch(function(e) { console.log(e); });
              const receiveMsg = (msg) => {
                let json = JSON.parse(msg.data.toString());
                ipfs.files.rm('/community/'+msg.from+'/msg');
                ipfs.files.cp('/ipfs/'+json.at,'/community/'+msg.from,{create:true,parents:true});
                console.log('Received: /community/'+msg.from);
              };
              await ipfs.pubsub.subscribe(topic, receiveMsg)
            } catch(e) {}
          }
          await _publishMsg(msg);
      },
      retrieve: async function(cid) {
        let fcid = '';
        for await (const file of ipfs.files.ls('/community/'+cid+'/')) {
            if(file.name == 'msg') {
              fcid = file.cid;
            }
        }
        let content = '';
        try {
          for await (const chunk of ipfs.cat('/ipfs/'+fcid)) {
                console.info(chunk);
                content +=chunk;
          }
        } catch(e) {

        }
        return content;
      }
    }
};
