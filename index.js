const IPFS = require("ipfs");
const axios = require("axios");
const glob = require("glob");
const fs = require("fs");
const fileExists = async path => !!(await fs.promises.stat(path).catch(e => false));
const multiaddr = require("multiaddr");
const topic = 'casa-corrently-beta';
let msgcids = {};

let ipfs = null;

const _publishMsg = async function(msg) {
    const stats = await ipfs.files.add(JSON.stringify(msg));
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
              const receiveMsg = async (msg) => {
                let json = JSON.parse(msg.data.toString());
                msgcids[msg.from] = json.at;
                await ipfs.cat('/ipfs/'+json.at);
                console.log('pub from ',msg.from);
              };
              await ipfs.pubsub.subscribe(topic, receiveMsg)
            } catch(e) {
              console.log(e);
            }
          }
          await _publishMsg(msg);
      },
      retrieve: async function(cid) {
        console.log(msgcids);
        if(typeof msgcids[cid] == 'undefined') return; else {
            let fcid = '';
            let content = '';
            try {
              for await (const chunk of ipfs.cat('/ipfs/'+msgcids[cid])) {
                    console.log('/ipfs/'+msgcids[cid],chunk.toString());
                    content +=chunk;
              }
            } catch(e) {

            }
            return content;
        }
      }
    }
};
