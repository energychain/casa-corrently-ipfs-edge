Error.stackTraceLimit = 200;
const IPFS = require("ipfs");
const axios = require("axios");
const glob = require("glob");
const fs = require("fs");
const fileExists = async path => !!(await fs.promises.stat(path).catch(e => false));
const multiaddr = require("multiaddr");
const topic = 'casa-corrently-2020';

const boot = async function() {
  const ipfs = await IPFS.create();

  const publishDynamics = async function() {
      let responds = await axios.get("https://casa-corrently-demo.herokuapp.com/msg");
      await ipfs.files.write('/msg',
        JSON.stringify(responds.data),
        {create:true,parents:true});
        console.log('Wrote MSG');
        const stats = await ipfs.files.stat('/');
        const addr = '' + stats.cid.toString()+'';
        const res = await ipfs.name.publish(addr);
        const resolve = await ipfs.name.resolve('/ipns/'+res.name,{recursive:true});
        console.log('I am at',addr);
        await ipfs.pubsub.publish(topic,JSON.stringify({at:addr}));
        console.log('published');
  }
  const publishStatics = async function() {
    var getDirectories = function (src, callback) {
      glob(src + '/**/*', callback);
    };
    getDirectories('node_modules/casa-corrently/public', async function (err, res) {
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
    console.log("Published Statics");
  }
  const connectSwarm = async function() {
    try {
      ipfs.swarm.connect(multiaddr("/ip4/108.61.210.201/tcp/4001/ipfs/QmZW7WWzGB4EPKBE4B4V8zT1tY54xmTvPZsCK8PyTNWT7i")).catch(function(e) { console.log(e); });
    } catch(e) {}
  }
  const retrieve = async function() {
        const receiveMsg = (msg) => {

          let json = JSON.parse(msg.data.toString());
          ipfs.files.cp('/ipfs/'+json.at,'/community/'+msg.from,{create:true,parents:true});
          console.log('/community/'+msg.from);
        };
        await ipfs.pubsub.subscribe(topic, receiveMsg)
        console.log(`subscribed to ${topic}`)
  }
  connectSwarm();
  publishStatics();
  publishDynamics();
  retrieve();
  console.log(await ipfs.id());
  setInterval(publishDynamics,30000);
}
boot();
