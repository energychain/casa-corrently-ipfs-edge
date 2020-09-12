const IPFS = require("ipfs");
const axios = require("axios");
const glob = require("glob");
const fs = require("fs");
const fileExists = async path => !!(await fs.promises.stat(path).catch(e => false));
const multiaddr = require("multiaddr");
const topic = 'casa-corrently-beta';
let msgcids = {};
let selfID='jkdfhhdf';
let ipfs = null;
let lastMsg = 0;
let lastBroadcast = new Date().getTime();

const _publishMsg = async function(msg,alias) {
    if(lastMsg > new Date().getTime() - 60000) return;

    if(alias == null) alias = '';
    const stats = await ipfs.add({path:'/msg' + alias,content:JSON.stringify(msg)});
    const addr = '' + stats.cid.toString()+'';
    const res = await ipfs.name.publish(addr);
    const resolve = await ipfs.name.resolve('/ipns/'+res.name,{recursive:true});
    await ipfs.pubsub.publish(topic,JSON.stringify({at:addr,alias:alias}));
    lastMsg = new Date().getTime();
    return;
}

const _publishBroadcast = async function() {
    const stats = await ipfs.add({path:'/broadcast',content:JSON.stringify(msgcids)});
    const addr = '' + stats.cid.toString()+'';
    await ipfs.pubsub.publish(topic,JSON.stringify({broadcast:addr}));
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
    setInterval(_publishBroadcast,60000);
    setTimeout(async function() {
      selfID = await ipfs.id();
    },1000)
    const receiveMsg = async (msg) => {
      if(msg.from == selfID) return;
      let json = JSON.parse(msg.data.toString());
      console.log("Incomming Message",json);
      const parseSingle = async function(json) {
        const ipfsPath = '/ipfs/'+json.at;
        let content = '';
        for await (const chunk of ipfs.cat(ipfsPath)) {
            content += chunk;
        }
        if(typeof json.alias !== 'undefined') {
          msg.from = json.alias;
        }
        let isnew=true;
        if(typeof msgcids[msg.from] !== 'undefined') {
          if(typeof json.on !== 'undefined') {
            if(json.on < msgcids[msg.from].on) {
              isnew=false;
            }
          }
        }
        if(isnew) {
          msgcids[msg.from] = {
            "at":json.at,
            "on":new Date().getTime(),
            "content":content
          }
          console.log("Received New",msg.from);
        } else {
          console.log("Has newer",msg.from);
        }
      }

      if(typeof json.at !== 'undefined') {
        await parseSingle(json);
      }
      if(typeof json.broadcast !== 'undefined') {
        const ipfsPath = '/ipfs/'+json.broadcast;
        let content = '';
        for await (const chunk of ipfs.cat(ipfsPath)) {
            content += chunk;
        }

        let rcids = JSON.parse(content);
        console.log('Processing Broadcast',rcids);
        for (const [key, value] of Object.entries(rcids)) {
            if(key.length > 10) {
              json.alias = key;
              json.at = value.at;
              await parseSingle(json);
            }
        }
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
      publish: async function(msg,alias) {
          if(ipfs == null) await _ipfs_init(config);
          await _publishMsg(msg,alias);
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
