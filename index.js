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
    const stats = await ipfs.add({path:'/msg',content:JSON.stringify(msg)});
    const addr = '' + stats.cid.toString()+'';
    const res = await ipfs.name.publish(addr);
    const resolve = await ipfs.name.resolve('/ipns/'+res.name,{recursive:true});
    await ipfs.pubsub.publish(topic,JSON.stringify({at:addr}));
    return;
}
const _ipfs_init = async function(config) {
  ipfs = await IPFS.create();
  try {
    // TODO: Add more peers to swarm to have a brilliant uptime
    ipfs.swarm.connect("/ip4/108.61.210.201/tcp/4001/p2p/QmZW7WWzGB4EPKBE4B4V8zT1tY54xmTvPZsCK8PyTNWT7i").catch(function(e) { console.log(e); });
    ipfs.swarm.connect("/ip4/217.163.30.7/tcp/4001/p2p/Qmanvqjcisx3LP4z8gYaBP8Lyk15mSHdotNMEdXS8zP15B").catch(function(e) { console.log(e); });
    ipfs.swarm.connect("/ip4/62.75.168.184/tcp/4001/p2p/QmeW92PaNQHJzFM1fJ97JmojmWvGCkyzp1VFj4RURcGZkv").catch(function(e) { console.log(e); });
    ipfs.swarm.connect("/ip4/95.179.164.124/tcp/4001/p2p/QmesnMndaKtpmsTNVS1D54qdf7n6zjBCciT21ESMtaxBNh").catch(function(e) { console.log(e); });

    const receiveMsg = async (msg) => {
      let json = JSON.parse(msg.data.toString());
      const ipfsPath = '/ipfs/'+json.at;
      let content = '';
      for await (const chunk of ipfs.cat(ipfsPath)) {
          content += chunk;
      }
      msgcids[msg.from] = {
        "at":json.at,
        "on":new Date().getTime(),
        "content":content
      }
    };
    await ipfs.pubsub.subscribe(topic, receiveMsg)
  } catch(e) {
    console.log(e);
  }
  if((config !== null) && (typeof config.staticFiles !== 'undefined')) {
    await _ipfs_statics(config.staticFiles);
  }
  return;
}

const _ipfs_statics =  async function(path) {
    var getDirectories = function (src, callback) {
      glob(src + '/**/*', callback);
    };
    getDirectories(path, async function (err, res) {
      let files = [];
      for(let i=0;i<res.length;i++) {
        if(fileExists(res[i])) {
          if(!fs.lstatSync(res[i]).isDirectory() ) {
              try {
                  await ipfs.files.write('/'+res[i].substr(('node_modules/casa-corrently/public/').length),
                    fs.readFileSync(res[i]),
                    {create:true,parents:true});
              } catch(e) {
              }
          }
        }
      }
    });
    return;
}

module.exports = function(config) {
    return {
      info: async function(req) {
        if(ipfs == null) await _ipfs_init(config);
        if(typeof req.method == 'undefined') req.method = 'ls';

        if(req.method == 'ls') {
          return msgcids;
        } else
        if(req.method == 'self') {
          return await ipfs.id();
        } else
        if(req.method == 'msg') {
          let cid = req.peer;
          if(typeof msgcids[cid] == 'undefined') return {}; else {
              content = JSON.parse(msgcids[cid].content);
              return content;
          }
        }else return {};
      },
      statics:async function() {
          if(ipfs == null) await _ipfs_init(config);
      },
      publish: async function(msg) {
          if(ipfs == null) await _ipfs_init(config);
          await _publishMsg(msg);
      },
      retrieve: async function(cid) {
        if(ipfs == null) await _ipfs_init(config);
        if(typeof msgcids[cid] == 'undefined') return {}; else {
            let fcid = '';
            let content = '';
            try {
              for await (const chunk of ipfs.cat('/ipfs/'+msgcids[cid].at)) {
                    content +=chunk;
              }
              content = JSON.parse(content);
            } catch(e) {
              content = {};
            }
            return content;
        }
      }
    }
};
