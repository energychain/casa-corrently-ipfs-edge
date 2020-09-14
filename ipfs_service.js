(async () => {
  const { workerData, parentPort } = require('worker_threads');
  const config = workerData;
  const IPFS = require("ipfs");
  const axios = require("axios");
  const glob = require("glob");
  const fs = require("fs");
  const fileExists = async path => !!(await fs.promises.stat(path).catch(e => false));
  const multiaddr = require("multiaddr");
  const topic = 'casa-corrently-beta';
  const IPFS_CAT_TIMEOUT=5000;
  const PURGE_AGE=4*3600000;
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
      ipfs.pubsub.publish(topic,JSON.stringify({at:addr,alias:alias}));
      lastMsg = new Date().getTime();
      return;
  }

  const _purgeCids = async function() {
      let _cids = {};
      let didpurge = false;
      for (const [key, value] of Object.entries(msgcids)) {
          let _content = JSON.parse(value.content);
          if(_content.time > new Date().getTime() - PURGE_AGE) {
            _cids[key] = value;
          } else {
            didpurge = true;
          }
      }
      if(didpurge) {
        msgcids=_cids;
      }
  }
  const _publishBroadcast = async function() {
      const stats = await ipfs.add({path:'/broadcast',content:JSON.stringify(msgcids)});
      const addr = '' + stats.cid.toString()+'';
      ipfs.pubsub.publish(topic,JSON.stringify({broadcast:addr}));
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
      setInterval(_purgeCids,850123);

      setTimeout(async function() {
        selfID = await ipfs.id();
      },1000)
      const receiveMsg = async (msg) => {
        if(msg.from == selfID) return;

        let json = JSON.parse(msg.data.toString());
        console.log("Incomming Message",json,msg.from);

        const parseSingle = async function(json) {
          const ipfsPath = '/ipfs/'+json.at;
          let content = '';
          for await (const chunk of ipfs.cat(ipfsPath,{timeout:IPFS_CAT_TIMEOUT})) {
              content += chunk;
          }
          let isnew=true;
          if(typeof msgcids[json.alias] !== 'undefined') {
            if(typeof json.on !== 'undefined') {
              if(json.on < msgcids[json.alias].on) {
                isnew=false;
              }
            }
          }

          if(isnew) {
            let _content = JSON.parse(content);
            if(_content.time > new Date().getTime() - PURGE_AGE) {
              msgcids[json.alias] = {
                "at":json.at,
                "on":new Date().getTime(),
                "content":content
              }
              console.log("Received New",json.alias);
              parentPort.postMessage({ msgcids, status: 'New' });
            }
          } else {
            console.log("Received Old",json.alias);
          }
        }

        if(typeof json.at !== 'undefined') {
          if((typeof json.alias == 'undefined')||(json.alias.length < 10)) {
            json.alias = msg.from;
            json.from = msg.from;
          }
          await parseSingle(json);
        }

        if(typeof json.broadcast !== 'undefined') {
          const ipfsPath = '/ipfs/'+json.broadcast;
          let content = '';
          for await (const chunk of ipfs.cat(ipfsPath,{timeout:IPFS_CAT_TIMEOUT})) {
              content += chunk;
          }

          let rcids = JSON.parse(content);
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
    return;
  }


  // bootstrap
  console.log('Bootstrap IPFS for Casa Corrently');
  await _ipfs_init(config);
  parentPort.on('message',function(data) {
    _publishMsg(data.msg,data.alias);
  });
})();