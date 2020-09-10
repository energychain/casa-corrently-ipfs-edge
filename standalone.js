Error.stackTraceLimit = 200;

const CasaCorrently = require("casa-corrently");
const fs = require("fs");
const publisher = new require("./index.js")();

const boot = async function() {
      const storage = {
        memstorage:{},
        get:function(key) {
          return this.memstorage[key];
        },
        set:function(key,value) {
          this.memstorage[key] = value;
        }
      };
      let msg = {
        payload: {},
        topic: 'statistics'
      };
      const main = await CasaCorrently();
      const meterLib = main.meterLib;
      const config = JSON.parse(fs.readFileSync("sample_config.json"));
      delete msg.payload.latest;
      await publisher.publish(await meterLib(msg,config,storage));
      setInterval(async function() {
        await publisher.publish(await meterLib(msg,config,storage));
      },60000);
      setInterval(async function() {
        console.log(await publisher.retrieve('QmRXzciq9PgA5E2mVD8osxU9u4tim7hLNxi3gaZwfYhxGJ'));
      },10000);
      console.log("done");
};
boot();
