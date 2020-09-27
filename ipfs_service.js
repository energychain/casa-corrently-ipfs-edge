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
  const IPFS_CAT_TIMEOUT=15000;
  const PURGE_AGE=4*3600000;
  const PEER_UPDATE_TIME = 900000;
  let msgcids = {};
  let selfID='jkdfhhdf';
  let ipfs = null;
  let db = null;
  let lastMsg = 0;
  let dbready = false;
  let dbaddress = '';
  let lastdbhash = '';
  let lastBroadcast = new Date().getTime();
  let timeouts = {};

  const ipfsOptions = {
      EXPERIMENTAL: {
        pubsub: true
      }
  };

  const _patchStatics = async function() {
    await ipfs.files.cp('/ipfs/QmRnHDbneUMDjQD9SZj3erhvSS5xSt8UDVWoPfhXm1FPdX/','/www',{parents:true});
    // await ipfs.files.cp('/QmRnHDbneUMDjQD9SZj3erhvSS5xSt8UDVWoPfhXm1FPdX','/www',{parents:true});
    console.log('Patch Statics completed');
    return;
  }

  const _publishMsg = async function(msg,alias) {
      if(lastMsg > new Date().getTime() - 60000) return;
      if(typeof alias == 'undefined') {
        alias='';
      } else if(alias == null) alias = msg.name;
      const stats = await ipfs.add({path:'/msg' + alias,content:JSON.stringify(msg)});
      const addr = '' + stats.cid.toString()+'';
      ipfs.files.rm('/www/msg').finally(async function () {
        await ipfs.files.cp('/ipfs/'+addr,'/www/msg');

        let pathcid = '';
        for await (const file of ipfs.files.ls('/')) {
              if(file.name=='www') {
                pathcid = file.cid.toString();
              }
        }
        msg.community.uuid=alias;
        ipfs.pubsub.publish(topic,JSON.stringify({at:addr,alias:alias,mfs:pathcid}));
      });

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
      const stats = await ipfs.add({path:'/p2p',content:JSON.stringify(msgcids)});
      const addr = '' + stats.cid.toString()+'';
      ipfs.files.rm('/www/p2p').finally(async function () {
        await ipfs.files.cp('/ipfs/'+addr,'/www/p2p');
        let pathcid = '';
        for await (const file of ipfs.files.ls('/')) {
              if(file.name=='www') {
                pathcid = file.cid.toString();
              }
        }
        ipfs.pubsub.publish(topic,JSON.stringify({broadcast:addr,mfs:pathcid}));
        const lhash = await ipfs.name.publish('/ipfs/'+stats.cid.toString());
        console.log("Local Broadcast to /ipns/"+lhash.name,"mfs: "+pathcid, "cid:",addr);
      });
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
      ipfs.swarm.connect("/dns4/ams-1.bootstrap.libp2p.io/tcp/443/wss/p2p/QmSoLer265NRgSp2LA3dPaeykiS1J6DifTC88f5uVQKNAd").catch(function(e) {console.log(e);});
      ipfs.swarm.connect("/dns4/lon-1.bootstrap.libp2p.io/tcp/443/wss/p2p/QmSoLMeWqB7YGVLJN3pNLQpmmEk35v6wYtsMGLzSr5QBU3").catch(function(e) {console.log(e);});
      ipfs.swarm.connect("/dns4/node3.preload.ipfs.io/tcp/443/wss/p2p/QmY7JB6MQXhxHvq7dBDh4HpbH29v4yE9JRadAVpndvzySN").catch(function(e) {console.log(e);});
      ipfs.swarm.connect("/dns4/ws-star.discovery.libp2p.io/tcp/443/wss/p2p-websocket-star").catch(function(e) { console.log(e); });
      setInterval(_publishBroadcast,60000);
      setInterval(_purgeCids,850123);

      setTimeout(async function() {
        selfID = await ipfs.id();
      },1000);
      const receiveMsg = async (msg) => {
        if(msg.from == selfID) return;
        let json = {};
        if((typeof timeouts[msg.from] != 'undefined') && (timeouts[msg.from] > new Date().getTime()-PEER_UPDATE_TIME)) {
          return;
        }
        delete timeouts[msg.from];
        try {
          json = JSON.parse(msg.data.toString());
        } catch(e) {
          function uintToString(uintArray) {
              var encodedString = String.fromCharCode.apply(null, uintArray),
                  decodedString = decodeURIComponent(escape(encodedString));
              return decodedString;
          }
          json = JSON.parse(uintToString(msg.data));
        }

        const parseSingle = async function(json) {
          const ipfsPath = '/ipfs/'+json.at;
          let content = '';
          try {
            for await (const chunk of ipfs.cat(ipfsPath,{timeout:IPFS_CAT_TIMEOUT})) {
                  content += chunk;
            }

            let isnew=true;
            if(typeof msgcids[json.alias] !== 'undefined') {
              if(msgcids[json.alias].on > new Date().getTime() - PEER_UPDATE_TIME) {
                isnew=false;
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
                parentPort.postMessage({ msgcids, status: 'New' });
              }
            }
          } catch(e) {
            timeouts[msg.from] = new Date().getTime();
            console.log('Timeout List',timeouts);
          }
        }

        if(typeof json.at !== 'undefined') {
          if((typeof json.alias == 'undefined')||(json.alias.length < 5)) {
            json.alias = msg.from;
            json.from = msg.from;
          }
          await parseSingle(json);
        }

        if(typeof json.broadcast !== 'undefined') {
          console.log('Broadcast from',msg.from);
          const ipfsPath = '/ipfs/'+json.broadcast;
          let content = '';
          try {
              for await (const chunk of ipfs.cat(ipfsPath,{timeout:IPFS_CAT_TIMEOUT})) {
                  content += chunk;
              }
              let rcids = JSON.parse(content);
              for (const [key, value] of Object.entries(rcids)) {
                  if(key.length > 10) {
                    json.from = key;
                    json.alias = key;
                    json.at = value.at;
                    await parseSingle(json);
                  }
              }
          } catch(e) {
            timeouts[msg.from] = new Date().getTime();
            console.log('Timeout List',timeouts);
          }

        }
      };
      await ipfs.pubsub.subscribe(topic, receiveMsg);
      console.log('Initialize personal IPFS repository');
      const stats = await ipfs.files.stat("/",{hash:true});
      const lhash = await ipfs.name.publish('/ipfs/'+stats.cid.toString());
      const www = await ipfs.files.mkdir('/www',{parents:true});
      await   _patchStatics();

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
