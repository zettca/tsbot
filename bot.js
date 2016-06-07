"use strict";

var tsClient = require('node-teamspeak');
var express = require('express');
var crypto = require('crypto');
var apis = require('./apis.js');
//var config = require('./tsconfig.json');

const SERVER_ADDRESS = process.argv[2];
const SERVERQ_USERNAME = process.argv[3];
const SERVERQ_PASSWORD = process.argv[4];

const sec = 1000;
const min = 60*sec;
const hour = 60*min;

const TIME_CHECKUP_TICK = 10*sec;

const ADMINS = ["T/72UbiGFUaJgdarQcNElCmAn+g=", "/nevGFqaUM0LRHaHCwdlwN4Dq7A="];

/* ========== MAIN SETTINGS ========== */

if (process.argv.length != 5){
  log("Correct usage: node bot.js [SERVER-ADDRESS] [SQ-USERNAME] [SQ-PASSWORD]");
  process.exit(1);
}

process.title = "TSBot.js";
log(new Date().toUTCString());
log("Starting bot service on " + SERVER_ADDRESS + "...");

var apiKey = crypto.randomBytes(8).toString('hex');
var botCLID;
var userList = [];
var movesList = [];
var messageList = [];
var tsBot = new tsClient(SERVER_ADDRESS);  // request sender handler

/* ========== TSBOT AUX REQUESTS ========== */

function sendCmd(cmd, params, callback){
  if (!cmd) return;
  let ingoredCmds = ["clientinfo"];
  
  tsBot.send(cmd, params, function(error, response, rawResponse){
    if (error){
      log("Error running command " + cmd + ". Message: " + error.msg);
      return;
    }
    
    if (typeof callback === "function"){
      if (ingoredCmds.indexOf(cmd) === -1) log("Issuing command " + cmd + " with params: " + JSON.stringify(params).replace(/\n/, ""));
      callback(response);
    } else if (typeof params === "function"){
      if (ingoredCmds.indexOf(cmd) === -1) log("Issuing command " + cmd);
      params(response);
    }
  });
}

function sendPM(clid, msg){
  sendCmd("sendtextmessage", { targetmode: 1, target: clid, msg: msg });
}

function getClientBy(prop, value){
  for (let i=0; i<userList.length; i++)
    if (userList[i][prop] == value)
      return userList[i];
}

/* ========== API SERVER ========== */

var app = express();
var router = express.Router();

router.use(function(req, res, next){
  next();
});

router.get("/", function(req, res){
  res.send({timestamp: Date.now(), message: "Welcome to the TSBot API"});
});

router.route("/ip/:key/:addr").get(function(req, res){
  if (req.params.key != apiKey){
    res.send({error: {code: 401, msg: "Invalid API key."}});
    return;
  }
  let user = getClientBy("connection_client_ip", req.params.addr);
  res.send(user ? user : {error: {code: 404, msg: "Address not found!", params: req.params}});
});

app.use("/tsapi", router);
app.listen(9980);

/* ========== BOT CONNECTION SETUP ========== */

sendCmd("login", { client_login_name: SERVERQ_USERNAME, client_login_password: SERVERQ_PASSWORD }, function(res){
  sendCmd("use", { sid: 1 }, function(res){
    log("Logged in on the main server successfully.");
    
    // STARTUP
    sendCmd("whoami", function(res){ botCLID = res.client_id; });
    sendCmd("clientupdate", { client_nickname: "ƤlαӵҒϋɳ" });
    sendCmd("servernotifyregister", { event: "textchannel" });
    sendCmd("servernotifyregister", { event: "textprivate" });
    sendCmd("servernotifyregister", { event: "textserver" });
    sendCmd("servernotifyregister", { event: "channel", id: 0 });
    sendCmd("servernotifyregister", { event: "server" });
    
    tsBot.on("textmessage", handleMessage);
    tsBot.on("clientmoved", handleChannelMove);
    //tsBot.on("clientexitview", handleUserExit);
    //tsBot.on("cliententerview", handleUserEnter);
    
    mainCheckupLoop();
    setInterval(mainCheckupLoop, TIME_CHECKUP_TICK);
  });
});

/* ========== MAIN TEAMSPEAK CHECKUPS ========== */

function mainCheckupLoop(){
  userList = [];
  
  sendCmd("clientlist", function(res){
    if (!Array.isArray(res) || res.length < 2) return;
    
    for (let i=0; i<res.length; i++){ // update userList
      if (res[i].client_type == 1) continue;
      sendCmd("clientinfo", { clid: res[i].clid }, function(user){
        user.clid = res[i].clid;
        userList.push(user);
        checkAFK(user);
      });
    }
  });
}

function checkAFK(user){
  const CID_AFK = 22;
  const TIME_AFK_LIMIT = 1*hour;
  let skipCIDs = [CID_AFK, 63, 302, 321];
  
  if (user.client_idle_time > TIME_AFK_LIMIT && skipCIDs.indexOf(user.cid) === -1){
    sendCmd("clientmove", { clid: user.clid, cid: CID_AFK }, function(res){
      log(user.client_nickname + " was moved to AFK...");
      sendPM(user.clid, "You were moved to AFK Room for idling for " + timeString(TIME_AFK_LIMIT));
    });
  }
}

/* ========== TEAMSPEAK EVENT HANDLERS ========== */

function handleMessage(msg){
  if (msg.invokerid == botCLID) return; // ignores own messages
  log("textmessage["+msg.targetmode+"] from " + msg.invokername + "["+msg.invokerid+"]: " + msg.msg);
  
  if (msg.targetmode == 1 || msg.targetmode == 2){  // Private || Channel message
    processRequests(msg, function(output){
      if (output) sendCmd("sendtextmessage", { targetmode: msg.targetmode, target: msg.invokerid, msg: output });
    });
  } else if (msg.targetmode == 3){ // Server message
    handleGlobalMessage(msg);
  }
}

function handleGlobalMessage(msg){
  const TIME_MUTE = 2*min;
  const TIME_REPOST = 6*sec;
  const TIME_DISABLE_CHAT = 15*min;
  const MAX_MESSAGES = 10;
  
  msg.time = Date.now();
  messageList.push(msg);
  
  if (messageList.length < 2) return;
  
  let thisMsg = messageList[messageList.length-1];
  let lastMsg = messageList[messageList.length-2];
  let firstMsg = messageList[0];
  
  // Server Chat user mute (2 msgs under TIME_REPOST)
  if (thisMsg.invokerid === lastMsg.invokerid && thisMsg.time-lastMsg.time < TIME_REPOST){
    log(thisMsg.invokername + " triggered chat spam protection...");
    let user = getClientBy("clid", thisMsg.invokerid);
    sendCmd("servergroupaddclient", { sgid: 18, cldbid: user.client_database_id }, function(res){
      setTimeout(sendCmd, 2*TIME_DISABLE_CHAT, "servergroupdelclient", { sgid: 18, cldbid: user.client_database_id });
      sendPM(thisMsg.invokerid, "Your ability to send server messages has been temporarily revoked. Please don't text so fast next time!");
    });
  }
  
  // Server Chat global mutes
  if (messageList.length >= MAX_MESSAGES && messageList.shift() && thisMsg.time-firstMsg.time < TIME_MUTE){  // Last MAX_MESSAGES messages sent under TIME_MUTE
    log("Major spam detected. Disabling b_client_server_textmessage_send...");
    sendCmd("sendtextmessage", { targetmode: 3, target: 1, msg: "Too much chatting detected! Permissions to text here were temporarily revoked." });
    sendCmd("servergroupaddperm", { sgid: 9, permsid: "b_client_server_textmessage_send", permvalue: 0, permnegated: 0, permskip: 0 });
    setTimeout(sendCmd, TIME_DISABLE_CHAT, "servergroupaddperm", { sgid: 9, permsid: "b_client_server_textmessage_send", permvalue: 1, permnegated: 0, permskip: 0 });
    messageList = [];
  }
}

function handleChannelMove(move){
  const CID_HOME = 9;
  const TIME_CLEAR = 2*min;
  const TIME_MOVESPAM = 6*sec;
  const TIME_DISABLE_MOVE = 10*min;
  const NUM_CONSECUTIVE_MOVES = 4;
  
  if (move.clid == botCLID || move.invokerid == botCLID) return;
  
  move.time = Date.now();
  
  if (movesList.length === 0){
    movesList.push(move);
    return;
  }
  
  
  let lastMove = movesList[movesList.length-1];
  if (lastMove.ctid === move.ctid && lastMove.clid === move.clid) return; // ignore duplicates
  
  movesList.push(move);
  if (movesList.length > 12) movesList.shift();
  let len = movesList.length;
  if (len < NUM_CONSECUTIVE_MOVES) return;
  
  let abuserID = move.clid;
  for (let i=len-2; i>=len-NUM_CONSECUTIVE_MOVES; i--){
    if (abuserID != movesList[i].clid || movesList[i].invokerid !== undefined){
      abuserID = null;
      break;
    }
  }
  
  let timeDiff = move.time - movesList[len-NUM_CONSECUTIVE_MOVES].time;
  if (abuserID &&  timeDiff <= TIME_MOVESPAM){
    log(move.clid + " triggered join spam protection...");
    let user = getClientBy("clid", move.clid);
    sendCmd("servergroupaddclient", { sgid: 24, cldbid: user.client_database_id }, function(res){
      setTimeout(sendCmd, TIME_DISABLE_MOVE, "servergroupdelclient", { sgid: 24, cldbid: user.client_database_id });
      sendPM(move.clid, "Your ability to change channel has been temporarily revoked. Please don't spam channel change next time!");
      sendCmd("clientmove", { clid: move.clid, cid: CID_HOME });
    });
  }
}

function processRequests(message, callback){
  let link, msg = String(message.msg);
  
  if (msg[0] != "!" && msg[0] != ".") return;
  
  let sep = (msg.indexOf(" ") !== -1) ? msg.indexOf(" ") : msg.length;
  let cmd = msg.substring(1, sep);
  let req = msg.substring(sep+1);
  
  if (cmd === "key" && message.targetmode == 1){
    if (ADMINS.indexOf(message.invokeruid) !== -1){ // Generate new API Key
      apiKey = crypto.randomBytes(8).toString('hex');
      callback(apiKey);
    } else{
      callback("Nice try guy, but nope...");
    }
    return;
  }
  
  switch(cmd){
    case "a":
    case "ask":
      callback(apis.askZ(req));
      break;
    case "c":
    case "calc":
      callback(apis.calc(req));
      break;
    case "rt":
    case "redtube":
      link = "http://www.redtube.com/?search=" + req.replace(/ /g, "+");
      callback("[URL="+link+"]"+link+"[/URL]");
      break;
    case "ph":
    case "pornhub":
      link = "http://www.pornhub.com/video/search?search=" + req.replace(/ /g, "+");
      callback("[URL="+link+"]"+link+"[/URL]");
      break;
    case "ge":
    case "price":
      apis.rsGEPrice(req, function(data){ callback(data); });
      break;
    case "all":
    case "stats":
    case "levels":
      apis.rsPlayerStats(req, function(data){ callback(data); });
      break;
  }
  
  if (apis.rsStatIndex(cmd) !== -1) apis.rsPlayerSkill(cmd, req, function(data){ callback(data); });
  
}

/* ============================== */

function log(msg){
  console.log('['+getTime()+'] ' + msg);
}

function getTime(){
  let time = new Date();
  let hour = (time.getUTCHours()>9) ? time.getUTCHours() : '0'+time.getUTCHours();
  let mins = (time.getUTCMinutes()>9) ? time.getUTCMinutes() : '0'+time.getUTCMinutes();
  let secs = (time.getUTCSeconds()>9) ? time.getUTCSeconds() : '0'+time.getUTCSeconds();
  return hour+':'+mins+':'+secs;
}

function timeString(time){
  if (isNaN(time)) return;
  let timeDesc = ["ms", "seconds", "minutes", "hours", "days", "weeks", "years"];
  let timeDiv = [1000, 60, 60, 24, 7, 52.15];
  
  for (var i=0; time>=timeDiv[i]; time /= timeDiv[i++]);
  return time + " " + ((time !== 1) ? timeDesc[i] : timeDesc[i].substring(0, timeDesc[i].length-1));
}
