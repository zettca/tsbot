var tsClient = require('node-teamspeak');
var libz = require('./zettca.js');
var apis = require('./apis.js');

/* ============================== */

const sec = 1000;
const min = 60*sec;
const hour = 60*min;

const TIME_CHECKUP_TICK = 10*sec;
const TIME_SPAM_RESET = 20*min;
const TIME_AFK_LIMIT = 1*hour;

const SERVER_ADDRESS = process.argv[2];
const SERVERQUERY_USERNAME = process.argv[3];
const SERVERQUERY_PASSWORD = process.argv[4];

/* ============================== */

if (process.argv.length != 5){
  libz.log("Correct usage: node bot.js [SERVER-ADDRESS] [SQ-USERNAME] [SQ-PASSWORD]");
  process.exit(1);
}

process.title = "TSBot";
libz.log(new Date().toUTCString());
libz.log("Starting bot service on " + SERVER_ADDRESS + "...");

var botCLID;
var userList = [];
var movesList = [];
var messageList = [];
var tsBot = new tsClient(SERVER_ADDRESS);  // request sender handler

function sendCmd(cmd, params, callback){
  if (!cmd) return;
  var ingoredCmds = ["clientinfo"];
  
  tsBot.send(cmd, params, function(error, response, rawResponse){
    if (error) libz.log("Error running command " + cmd + ". Message: " + error.msg);
    if (typeof callback === "function"){
      if (ingoredCmds.indexOf(cmd) == -1) libz.log("Issuing command " + cmd + " with params: " + JSON.stringify(params).replace(/\n/, ""));
      callback(response);
    } else if (typeof params === "function"){
      libz.log("Issuing command " + cmd);
      params(response);
    }
  });
}

/* ============================== */

sendCmd("login", { client_login_name: SERVERQUERY_USERNAME, client_login_password: SERVERQUERY_PASSWORD }, function(res){
  sendCmd("use", { sid: 1 }, function(res){
    libz.log("Logged in on the main server successfully.");
    
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
    //listenCmd("clientexitview", handleUserExit);
    //listenCmd("cliententerview", handleUserEnter);
    
    setInterval(mainLoop, TIME_CHECKUP_TICK);
  });
});

/* ============================== */

function mainLoop(){
  updateUserlist();
  afkCheckup();
}

function updateUserlist(){
  userList = [];
  
  sendCmd("clientlist", function(res){
    if (!Array.isArray(res) || res.length < 2) return;
    
    for (var i=0; i<res.length; i++){
      if (res[i].client_type == 1) return;
      sendCmd("clientinfo", { clid: res[i].clid }, function(res){
        var user = res;
        user.clid = res[i].clid;
        userList.push(user);
      });
    }
  });
}

function afkCheckup(){
  var afkCID = 22;
  var ignoredCIDs = [afkCID, 63, 302, 321];
  
  for (var i=0; i<userList.length; i++){
    if (userList[i].client_idle_time > TIME_AFK_LIMIT && ignoredCIDs.indexOf(userList[i].cid) === -1){
      sendCmd("clientmove", { clid: userList[i].clid, cid: afkCID }, function(res){
        libz.log(userList[i].client_nickname + " was moved to AFK...");
        sendCmd("sendtextmessage", { targetmode: 1, target: userList[i].clid, msg: "You were moved to AFK Room for idling for " + libz.timeString(TIME_AFK_LIMIT) + "." });
      });
    }
  }
}

/* ============================== */

function handleChannelMove(move){
  const TIME_CLEAR = 2*min;
  const TIME_MOVESPAM = 6*sec;
  const TIME_DISABLE_MOVE = 10*min;
  
  if (move.clid == botCLID || (move.invokerid && move.invokerid == botCLID)) return; // ignores own moves
  
  move.time = new Date().getTime();
  if (movesList.length == 0){
    movesList.push(move);
    return;
  }
  
  var lastMove = movesList[movesList.length-1];
  if (lastMove.ctid == move.ctid && lastMove.clid == move.clid) return;
  
  console.log(move);
  movesList.push(move);
  
  if (movesList.length >= 4){ // Check last 4 moves
    var i, thisMove = move;
    var dudeID = lastMove.clid;
    
    for (i=movesList.length-2; i>=movesList.length-4; i--){
      if (dudeID != movesList[i].clid || movesList[i].invokerid){
        dudeID = 0;
        break;
      }
    }
    
    if (dudeID && thisMove.time - movesList[i+1].time <= TIME_MOVESPAM){
      var homeID = 9;
      libz.log(thisMove.clid + " triggered move spam protection...");
      sendCmd("sendtextmessage", { targetmode: 1, target: thisMove.clid, msg: "Your ability to change channel has been temporairily revoked. Please don't spam channel change next time!" });
      sendCmd("clientinfo", { clid: thisMove.clid }, function(res){
        var user = res;
        sendCmd("servergroupaddclient", { sgid: 24, cldbid: user.client_database_id }, function(res){
          setTimeout(function(){
            sendCmd("servergroupdelclient", { sgid: 24, cldbid: user.client_database_id });
          }, TIME_DISABLE_MOVE);
        });
        sendCmd("clientmove", { clid: thisMove.clid, cid: homeID }, function(res){
          libz.log(user.client_nickname + " was moved to AFK...");
        });
      });
    }
    
  }
  
  if (movesList.length > 12) movesList.shift();
}

function handleMessage(msg){
  if (msg.invokerid == botCLID) return; // ignores own messages
  libz.log("textmessage["+msg.targetmode+"] from " + msg.invokername + "["+msg.invokerid+"]: " + msg.msg);
  
  if (msg.targetmode == 1 || msg.targetmode == 2){  // Private || Channel message
    processRequests(msg.msg, function(output){
      if (output) sendCmd("sendtextmessage", { targetmode: msg.targetmode, target: msg.invokerid, msg: output });
    });
  } else if (msg.targetmode == 3){ // Server message
    handleGlobalMessage(msg);
  }
}

function handleGlobalMessage(message){
  const TIME_MUTE = 2*min;
  const TIME_REPOST = 6*sec;
  const TIME_DISABLE_CHAT = 15*min;
  const MAX_MESSAGES = 10;
  
  message.time = new Date().getTime();
  messageList.push(message);
  
  if (messageList.length < 2) return;
  
  var thisMsg = messageList[messageList.length-1];
  var lastMsg = messageList[messageList.length-2];
  var firstMsg = messageList[0];
  
  // Server Chat user mute (2 msgs under TIME_REPOST)
  if (thisMsg.invokerid == lastMsg.invokerid && thisMsg.time-lastMsg.time < TIME_REPOST){
    libz.log(thisMsg.invokername + " triggered chat spam protection...");
    sendCmd("sendtextmessage", { targetmode: 1, target: thisMsg.invokerid, msg: "Your ability to send server messages has been temporairily revoked. Please don't talk so fast next time!" });
    sendCmd("clientinfo", { clid: thisMsg.invokerid }, function(err, response, rawResponse){
      sendCmd("servergroupaddclient", { sgid: 18, cldbid: response.client_database_id });
      setTimeout(function(){
        sendCmd("servergroupdelclient", { sgid: 18, cldbid: response.client_database_id });
      }, 2*TIME_DISABLE_CHAT);
    });
  }
  
  // Server Chat global mutes
  if (messageList.length >= MAX_MESSAGES && messageList.shift() && thisMsg.time-firstMsg.time < TIME_MUTE){  // Last MAX_MESSAGES messages sent under TIME_MUTE
    libz.log("Major spam detected. Disabling b_client_server_textmessage_send...");
    sendCmd("sendtextmessage", { targetmode: 3, target: 1, msg: "Plim, plim, plim... Too much chatting detected! Permissions to talk here were temporairily revoked." });
    sendCmd("servergroupaddperm", { sgid: 9, permsid: "b_client_server_textmessage_send", permvalue: 0, permnegated: 0, permskip: 0 });
    sendCmd("servergroupaddperm", { sgid: 15, permsid: "b_client_server_textmessage_send", permvalue: 0, permnegated: 0, permskip: 0 });
    setTimeout(function(){
      sendCmd("servergroupaddperm", { sgid: 9, permsid: "b_client_server_textmessage_send", permvalue: 1, permnegated: 0, permskip: 0 });
      sendCmd("servergroupaddperm", { sgid: 15, permsid: "b_client_server_textmessage_send", permvalue: 1, permnegated: 0, permskip: 0 });
    }, TIME_DISABLE_CHAT);
    messageList = [];
  }
}

function processRequests(msg, cbOutput){
  msg = String(msg);
  
  if (msg.charAt(0) != "!" && msg.charAt(0) != "."){ // Not command or question
    cbOutput(null);
    return;
  }
    
  var separator = msg.indexOf(" ");
  
  var cmd = msg.substring(1, separator);
  var req = msg.substring(separator+1);
  
  var oute = apis.get(cmd, req);
  cbOutput(oute);
}
