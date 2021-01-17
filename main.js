#! /usr/bin/env node

require('dotenv').config()
const tmi = require('tmi.js')
const YeeDevice = require('yeelight-platform').Device

/*
 * Utils
 **/

function forcerange(value, min, max) {
  return value < min ? min : value > max ? max : value;
}

function rgbtosingle(r, g, b) {
  return r*256*256 + g*256 + b;
}

/*
 * Yeelight methods
 * */
const toggle = (yeecb) => {
  yeecb("toggle")
}

const power = (yeecb, params, usagecb) => {
  const sendusage = usagecb("(on, off)");
  if (params.length !== 1) {
    sendusage();
    return -1;
  }
  const val = params[0];
  if (! (val === "on" || val === "off")) {
    sendusage();
    return -1;
  }
  yeecb("set_power", [val]);
}

const rgb = (yeecb, params, clientcb) => {
  const sendusage = clientcb("<r> <g> <b>");
  if (params.length !== 3) {
    sendusage();
    return -1
  }
  vals = params.map(e => parseInt(e))
  if (vals.some(isNaN)) {
    sendusage();
    return -1
  }
  vals = vals.map(v => forcerange(v, 0, 255));
  const value = rgbtosingle(vals[0], vals[1], vals[2]);
  yeecb("set_rgb", [value]);
}

const brightness = (yeecb, params, clientcb) => {
  const sendusage = clientcb("<brightness>")
  if (params.length !== 1) {
    sendusage();
    return -1
  }
  let val = parseInt(params[0])
  if (isNaN(val)) {
    sendusage();
    return -1
  }
  val = forcerange(val, 1, 100);
  yeecb("set_bright", [val]);
}

const temperature = (yeecb, params, clientcb) => {
  const sendusage = clientcb("<temperature>");
  if (params.length !== 1) {
    sendusage();
    return -1;
  }
  let val = parseInt(params[0])
  if (isNaN(val)) {
    sendusage();
    return -1
  }
  val = forcerange(val, 1700, 6500);
  yeecb("set_ct_abx", [val, "smooth", 500])
}


/*
 * Outgoing functions 
 * */
function setlight(comm, params=[]) {
  console.log(comm, params);
  device.sendCommand({
    id: 410,
    method: comm,
    params: params
  })
}

function clientsend(client, text) {
  client.say(process.env.CHANNEL, text);
}

/*
 * Command parsing
 * */
function twitchyee(device, message, client) {
  const words = message.split(' ');
  if (words[0] !== "!light")
    return 0

  const command = words[1]
  const params = words.slice(2)
  let ycommand = ""
  let yparam = []


  const usage = (paramstr) => () => {
    clientsend(client, `usage: !light ${command} ${paramstr}`)
  }

  let method;

  switch(command) {
    case "toggle":
      method = toggle;
      break

    case "power":
      method = power;
      break;

    case "rgb":
      method = rgb;
      break;

    case "bright":
    case "brightness":
      method = brightness;
      break;

    case "temp":
    case "temperature":
      method = temperature;
      break;

    default:
      clientsend(client, `usage: !light (toggle, power, rgb, temp, bright)`)
      return -1
  }
  method(setlight, params, usage);
}

/*
 * Setup
 * */

const device = new YeeDevice({host: process.env.YEEIP, port: process.env.YEEPORT})
const client = new tmi.Client({
  connection: { reconnect: true },
  channels: [ process.env.CHANNEL ],
  identity: {
    username: process.env.USERNAME,
    password: process.env.AUTHTOKEN,
  }
})

// connect twitch client and yeelight
client.connect();
const resp = device.connect();

// connect twitch client to command parsing
device.on('connected', () => {
  client.on('message', (channel, tags, message, self) => {
    twitchyee(device, message, client)
  })
})

// enable logging
device.on('deviceUpdate', (props) => {
  console.log(props)
})
