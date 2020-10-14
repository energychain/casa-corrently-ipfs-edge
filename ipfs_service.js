(async () => {
  const { workerData, parentPort } = require('worker_threads');
  const config = workerData;
  const IPFS = require("ipfs");
  const CLIENT = require("ipfs-http-client");
  const hypercore = require('hypercore');
  const axios = require("axios");
  const glob = require("glob");
  const fs = require("fs");
  const fileExists = async path => !!(await fs.promises.stat(path).catch(e => false));
  const multiaddr = require("multiaddr");
  const topic = 'casa-corrently-beta';
  const IPFS_CAT_TIMEOUT=15000;

  let PURGE_AGE=4*3600000;
  const PEER_UPDATE_TIME = 900000;
  let msgcids = {};
  let selfID='jkdfhhdf';
  let ipfs = null;
  let lastMsg = 0;
  let dbready = false;
  let dbaddress = '';
  let lastdbhash = '';
  let lastBroadcast = new Date().getTime();
  let timeouts = {};
  let historydb = null;

  const ipfsOptions = {
      EXPERIMENTAL: {
        pubsub: true
      }
  };

  const _patchStatics = async function() {
    await ipfs.files.cp('/ipfs/QmRnHDbneUMDjQD9SZj3erhvSS5xSt8UDVWoPfhXm1FPdX/','/www',{parents:true});
    // await ipfs.files.cp('/QmRnHDbneUMDjQD9SZj3erhvSS5xSt8UDVWoPfhXm1FPdX','/www',{parents:true});
    return;
  }

  const _getDBItems = async function() {
    return new Promise(async function (resolve, reject)  {
          try {
            historydb.head({wait:true,valueEncoding:'json'},function(err,data) {
              console.log('_getDBItems',err,data.length);
              resolve(data);
            });
          } catch(e) {
            console.log('_getDBItems',e);
            resolve([]);
          }
    });
  }

  const _storeDB = async function(msg) {
    if(historydb == null) return;
    if(typeof msg == 'undefined') return;
    if(typeof msg.community == 'undefined') return;
    if(! historydb.writable)  return;
    try {

        let historyItem = {
          time:msg.time,
          uuid:msg.community.uuid,
          stats:{}
        };
        for (const [key, value] of Object.entries(msg.stats)) {
              historyItem.stats[key] = value.energyPrice_kwh;
        }
        historydb.append(historyItem);
        console.log('_storeDB');
        return '';
    } catch(e) {
      console.log('_storeDB',e);
      return;
    }
  }

  const _publishMsg = async function(msg,alias) {
      if(typeof alias == 'undefined') {
        alias='local';
      } else if(alias == null) alias = msg.name;
      if(typeof msg.community !== 'undefined') {
        alias = msg.community.uuid;
      }
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

        ipfs.pubsub.publish(topic,JSON.stringify({at:addr,alias:alias,mfs:pathcid}));
      });
      let history = await _storeDB(msg);

      lastMsg = new Date().getTime();
      msgcids[alias] = {
        on:lastMsg,
        at:addr,
        history:history,
        content:JSON.stringify(msg)
      }
      parentPort.postMessage({ 'msgcids':msgcids,'history':await _getDBItems(), status: 'New' });
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
      let remotecids = {};
      for (const [key, value] of Object.entries(msgcids)) {
            remotecids[key] = value;
            delete remotecids[key].localHistory;
      }
      const stats = await ipfs.add({path:'/p2p',content:JSON.stringify(remotecids)});
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
      });
      return;
  }

  const _ipfs_init = async function(config) {
    try {
      if(typeof config.ipfs_api_gw !== 'undefined') {
        try {
        ipfs = CLIENT(config.ipfs_api_gw);
        await ipfs.id();
        } catch(e) {
          ipfs = null;
        }
      }

      if(ipfs == null) ipfs = await IPFS.create();
      const Gateway = require('ipfs/src/http');
      const gateway = new Gateway(ipfs);
      gateway.start();
    } catch(e) {
        // in case this fails we try to connect to a local
        try {
          if(ipfs == null) ipfs = CLIENT('http://localhost:5001');
          await ipfs.id();
        } catch(e) {
          try {
            if(ipfs == null) ipfs = CLIENT('http://localhost:4001');
            await ipfs.id();
          } catch(e) {
            if(ipfs == null) ipfs = CLIENT('http://localhost:4002');
            await ipfs.id();
          }
        }
    }
    try {
      // TODO: Add more peers to swarm to have a brilliant uptime
      // ipfs.swarm.connect("/ip4/108.61.210.201/tcp/4001/p2p/QmZW7WWzGB4EPKBE4B4V8zT1tY54xmTvPZsCK8PyTNWT7i").catch(function(e) { console.log(e); });
      ipfs.swarm.connect("/ip4/217.163.30.7/tcp/4001/p2p/Qmanvqjcisx3LP4z8gYaBP8Lyk15mSHdotNMEdXS8zP15B").catch(function(e) { console.log(e); });
      ipfs.swarm.connect("/ip4/62.75.168.184/tcp/4001/p2p/QmeW92PaNQHJzFM1fJ97JmojmWvGCkyzp1VFj4RURcGZkv").catch(function(e) { console.log(e); });
      ipfs.swarm.connect("/ip4/95.179.164.124/tcp/4001/p2p/QmesnMndaKtpmsTNVS1D54qdf7n6zjBCciT21ESMtaxBNh").catch(function(e) { console.log(e); });
      ipfs.swarm.connect("/dns4/ams-1.bootstrap.libp2p.io/tcp/443/wss/p2p/QmSoLer265NRgSp2LA3dPaeykiS1J6DifTC88f5uVQKNAd").catch(function(e) {console.log(e);});
      ipfs.swarm.connect("/dns4/lon-1.bootstrap.libp2p.io/tcp/443/wss/p2p/QmSoLMeWqB7YGVLJN3pNLQpmmEk35v6wYtsMGLzSr5QBU3").catch(function(e) {console.log(e);});
      ipfs.swarm.connect("/dns4/node3.preload.ipfs.io/tcp/443/wss/p2p/QmY7JB6MQXhxHvq7dBDh4HpbH29v4yE9JRadAVpndvzySN").catch(function(e) {console.log(e);});
      ipfs.swarm.connect("/ip6/2604:a880:1:20::1d9:6001/tcp/4001/p2p/QmSoLju6m7xTh3DuokvT3886QRYqxAzb1kShaanJgW36yx").catch(function(e) { console.log(e); });
      ipfs.swarm.connect("/ip4/108.61.210.201/tcp/4012/p2p/QmU14oFSdrfRmJb4U7ygeb6Q5fbGi9rRb89bmWxPm74bhV").catch(function(e) { console.log(e); });
      ipfs.swarm.connect("/ip4/136.244.111.239/tcp/4001/p2p/QmSt3Tz2HTfHqEpAZLRbzgXWUBxEq8kRLQM6PMmGvonirT").catch(function(e) { console.log(e); });

      setInterval(_publishBroadcast,900000);
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
                if(typeof _content.community !== 'undefined') {
                  json.alias = _content.community.uuid;
                }
                msgcids[json.alias] = {
                  "at":json.at,
                  "on":new Date().getTime(),
                  "content":content
                }
                try {

              } catch(e) {
                console.log('Error in _getDBItems',e);
              }
                parentPort.postMessage({ 'msgcids':msgcids,'history':await _getDBItems(), status: 'New' });
                // TODO Add Memory Cleanup again delete msgcids[json.alias].localHistory;
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
            console.log('Timeout List',timeouts,e);
          }

        }
      };
      if(typeof config.nosub !== 'undefined') {
        await ipfs.pubsub.subscribe(topic, function() { return; });
      } else {
        await ipfs.pubsub.subscribe(topic, receiveMsg);
      }
      if(typeof config.purgeage !== 'undefined') {
        PURGE_AGE = config.purgeage;
      }
      console.log('Initialize personal IPFS repository');
      const stats = await ipfs.files.stat("/",{hash:true});
      const lhash = await ipfs.name.publish('/ipfs/'+stats.cid.toString());
      const www = await ipfs.files.mkdir('/www',{parents:true});
      historydb = await hypercore('./history', {valueEncoding: 'json'});

      await _getDBItems();
      await _patchStatics();
      console.log('Init finished');
    } catch(e) {
      console.log(e);
    }
    return;
  }

  // bootstrap
  console.log('Bootstrap IPFS for Casa Corrently');
  await _ipfs_init(config);
  parentPort.on('message',async function(data) {
    // eventuell muss hier eine Publish Que aufgebaut werden.
    await _publishMsg(data.msg,data.alias);
    return;
  });
})();
