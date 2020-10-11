const IPFS = require("ipfs");
const CLIENT = require("ipfs-http-client");
const OrbitDB = require('orbit-db');
let ipfs = null;

const boot = async function() {
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
  ipfs.swarm.connect("/ip4/217.163.30.7/tcp/4001/p2p/Qmanvqjcisx3LP4z8gYaBP8Lyk15mSHdotNMEdXS8zP15B").catch(function(e) { console.log(e); });
  ipfs.swarm.connect("/ip4/62.75.168.184/tcp/4001/p2p/QmeW92PaNQHJzFM1fJ97JmojmWvGCkyzp1VFj4RURcGZkv").catch(function(e) { console.log(e); });
  ipfs.swarm.connect("/ip4/95.179.164.124/tcp/4001/p2p/QmesnMndaKtpmsTNVS1D54qdf7n6zjBCciT21ESMtaxBNh").catch(function(e) { console.log(e); });
  ipfs.swarm.connect("/dns4/ams-1.bootstrap.libp2p.io/tcp/443/wss/p2p/QmSoLer265NRgSp2LA3dPaeykiS1J6DifTC88f5uVQKNAd").catch(function(e) {console.log(e);});
  ipfs.swarm.connect("/dns4/lon-1.bootstrap.libp2p.io/tcp/443/wss/p2p/QmSoLMeWqB7YGVLJN3pNLQpmmEk35v6wYtsMGLzSr5QBU3").catch(function(e) {console.log(e);});
  ipfs.swarm.connect("/dns4/node3.preload.ipfs.io/tcp/443/wss/p2p/QmY7JB6MQXhxHvq7dBDh4HpbH29v4yE9JRadAVpndvzySN").catch(function(e) {console.log(e);});
  ipfs.swarm.connect("/ip6/2604:a880:1:20::1d9:6001/tcp/4001/p2p/QmSoLju6m7xTh3DuokvT3886QRYqxAzb1kShaanJgW36yx").catch(function(e) { console.log(e); });
  ipfs.swarm.connect("/ip4/108.61.210.201/tcp/4012/p2p/QmU14oFSdrfRmJb4U7ygeb6Q5fbGi9rRb89bmWxPm74bhV").catch(function(e) { console.log(e); });
  ipfs.swarm.connect("/ip4/136.244.111.239/tcp/4001/p2p/QmSt3Tz2HTfHqEpAZLRbzgXWUBxEq8kRLQM6PMmGvonirT").catch(function(e) { console.log(e); });

  orbitdb = await OrbitDB.createInstance(ipfs);
  console.log("Create");
  const dbinstance1 = await orbitdb.eventlog("/orbitdb/zdpuAkfiCzLMtQTAwuVHJC1RXGq37DYwvpBRUV6LErQgSvgfT/openems_mf",{

  });
  dbinstance1.events.on('ready', () => {
    const items = log.iterator().collect().map(e => e.payload.value)
    items.forEach(e => console.log(e.name))
    // "hello world"
  })

  setTimeout(async function() {
    console.log('Insance2');
  const dbinstance2 = await orbitdb.eventlog("/orbitdb/zdpuAqTfsiSuqYMqD91fcFTw7zT7a5TD54736i88VzVCMwrBi/0xB8223C5aa7317B827A2dd3aEEb1a2d300E89A506");
  dbinstance2.events.on('ready', () => {
    const items = log.iterator().collect().map(e => e.payload.value)
    items.forEach(e => console.log(e.name))
    // "hello world"
  })
    },10000);
;  return;
}

boot();
