var tsClient = require('node-teamspeak');
var request = require('request');
var libz = require('./zettca.js');

/* ============================== */

const hour = 60*60*1000;
const min = 60*1000;
const sec = 1000;
const TIME_CHECKUP_TICK = 1 * min;
const TIME_SPAM_RESET = 20 * min;
const TIME_AFK_LIMIT = 1 * hour;

const SERVER_ADDRESS = process.argv[2];
const SERVERQUERY_USERNAME = process.argv[3];
const SERVERQUERY_PASSWORD = process.argv[4];

/* ============================== */

if (process.argv.length != 5){
  libz.log("Wrong argument length!");
  libz.log("Correct usage: node bot.js [SERVER-ADDRESS] [SQ-USERNAME] [SQ-PASSWORD]");
  process.exit(1);
}

process.title = "tsbot";
console.log();
libz.log(new Date().toUTCString());
libz.log("Starting bot service on " + SERVER_ADDRESS + "...");

var botCLID;
var userList = [];
var messageList = [];
var tsBot = new tsClient(SERVER_ADDRESS);  // request sender handler

/* ============================== */

function startUp(){
  tsBot.send("login", { client_login_name: SERVERQUERY_USERNAME, client_login_password: SERVERQUERY_PASSWORD }, function(err, response, rawResponse){
    if (err){ libz.log("Error logging in: " + err.msg); process.exit(1); }
    tsBot.send("use", { sid: 1 }, function(err, response, rawResponse){
      if (err){ libz.log("Error setting default server: " + err.msg); process.exit(1); }
      
      libz.log("Logged in on the main server successfully.");
      
      // STARTUP
      tsBot.send("whoami", function(err, response, rawResponse){ botCLID = response.client_id; });
      tsBot.send("clientupdate", { client_nickname: "ƤlαӵҒϋɳ" });
      tsBot.send("servernotifyregister", { event: "textchannel" });
      tsBot.send("servernotifyregister", { event: "textprivate" });
      tsBot.send("servernotifyregister", { event: "textserver" });
      tsBot.on("textmessage", handleMessage);
      
      checkupMainLoop();
      setInterval(checkupMainLoop, TIME_CHECKUP_TICK);
    });
  });
}

function checkupMainLoop(){
  userList = [];
  
  tsBot.send("clientlist", function(err, response, rawResponse){
    if (err) libz.log("Error retrieving clientlist: " + err.msg);
    if (!Array.isArray(response) || response.length < 2) return;
    
    response.forEach(function(dude, index){
      if (dude.client_type == 1) return;
      tsBot.send("clientinfo", { clid: dude.clid }, function(err, response, rawResponse){
        if (err){ libz.log("Error retrieving clientinfo: " + err.msg); return; }
        var user = response;
        user.clid = dude.clid;
        userList.push(user);
        afkCheckup(user);
      });
    });
  });
}

function afkCheckup(user){
  var afkCID = 22;
  var ignoredCIDs = [afkCID, 63, 302, 321];
  
  if (user.client_idle_time > TIME_AFK_LIMIT && ignoredCIDs.indexOf(user.cid) == -1){
    tsBot.send("clientmove", { clid: user.clid, cid: afkCID }, function(err, response, rawResponse){
      if (err) libz.log("Error moving client to AFK: " + err.msg);
      libz.log(user.client_nickname + " was moved to AFK...");
      tsBot.send("sendtextmessage", { targetmode: 1, target: user.clid, msg: "You were moved to AFK Room for idling for " + libz.timeString(TIME_AFK_LIMIT) + "." });
    });
  }
}

function handleMessage(message){
  if (message.invokerid == botCLID) return; // ignores own messages
  libz.log("textmessage["+message.targetmode+"] from " + message.invokername + "["+message.invokerid+"]: " + message.msg);
  
  if (message.targetmode == 1 || message.targetmode == 2){  // Private || Channel message
    processRequests(message.msg, function(output){
      if (output) tsBot.send("sendtextmessage", { targetmode: message.targetmode, target: message.invokerid, msg: output });
    });
  } else if (message.targetmode == 3){ // Server message
    handleGlobalMessage(message);
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
  
  // User sent 2 msg in a row under TIME_REPOST
  if (thisMsg.invokerid == lastMsg.invokerid && thisMsg.time-lastMsg.time < TIME_REPOST){
    libz.log(thisMsg.invokername + " triggered spam warning...");
    tsBot.send("sendtextmessage", { targetmode: 1, target: thisMsg.invokerid, msg: "Your ability to send server messages was temporairily revoked. Please don't talk so fast next time!" });
    tsBot.send("clientinfo", { clid: thisMsg.invokerid }, function(err, response, rawResponse){
      tsBot.send("servergroupaddclient", { sgid: 18, cldbid: response.client_database_id });
      setTimeout(function(){
        tsBot.send("servergroupdelclient", { sgid: 18, cldbid: response.client_database_id });
      }, 2*TIME_DISABLE_CHAT);
    });
  }
  
  // Handle global warnings
  if (messageList.length >= MAX_MESSAGES && messageList.shift() && thisMsg.time-firstMsg.time < TIME_MUTE){  // Last MAX_MESSAGES messages sent under TIME_MUTE
    libz.log("Major spam detected. Disabling b_client_server_textmessage_send...");
    tsBot.send("sendtextmessage", { targetmode: 3, target: 1, msg: "Plim, plim, plim... Too much chatting detected! Permissions to talk here were temporairily revoked." });
    tsBot.send("servergroupaddperm", { sgid: 9, permsid: "b_client_server_textmessage_send", permvalue: 0, permnegated: 0, permskip: 0 });
    tsBot.send("servergroupaddperm", { sgid: 15, permsid: "b_client_server_textmessage_send", permvalue: 0, permnegated: 0, permskip: 0 });
    setTimeout(function(){
      tsBot.send("servergroupaddperm", { sgid: 9, permsid: "b_client_server_textmessage_send", permvalue: 1, permnegated: 0, permskip: 0 });
      tsBot.send("servergroupaddperm", { sgid: 15, permsid: "b_client_server_textmessage_send", permvalue: 1, permnegated: 0, permskip: 0 });
    }, TIME_DISABLE_CHAT);
    messageList = [];
  }
}

function processRequests(msg, callback){
  var cmd, req, link, URL;
  msg = String(msg);
  
  if (msg.charAt(0) != "!" && msg.charAt(0) != "."){ // Not command or question
    callback(null);
    return;
  }
    
  var separator = msg.indexOf(" ");
  
  cmd = msg.substring(1, separator);
  req = msg.substring(separator+1);
  
  var stats = ["overall","attack","defence","strength","constitution","ranged","prayer","magic","cooking","woodcutting","fletching","fishing","firemaking","crafting","smithing","mining","herblore","agility","thieving","slayer","farming","runecrafting","hunter","construction","summoning","dungeoneering","divination","bounty_hunter","bounty_hunter_rouges","dominion_tower","crucible","castle_wars","BA_attackers","BA_defenders","BA_collectors","BA_healers","duel_tournaments","mobilising_armies","conquest","fist_of_guthix","GG_resource","GG_athletics","we2","we2","we2","we2","heist_guard","heist_robber","CFP"];

  
  if (cmd == "ask" || cmd == "a"){
    var opts = ["Yes", "No", "Maybe", "Penis is the answer", "There is no answer to that", "Sex will solve that", "Crying will solve that", "Obviously", "Obviously not", "Never", "Everyday", "Keep dreaming...", "Ask somebody dumb instead", "Ask a human instead", "You shouldn't ask such things", "Google it", "The answer is obvious"];
    var value = 0;
    for (var i=0; i<msg.length;i++) value += msg.charCodeAt(i);
    
    callback(opts[Math.floor(value) % opts.length]);
    return;
  } else if (cmd == "calc" || cmd == "c"){
    var result = libz.calc(req);
    callback((result < 1000) ? result : result + " ("+libz.toShortNum(result)+")");
    return;
  } else if (cmd == "price" || cmd == "ge"){ // GrandExchange Item Search
    var ID = libz.GENameToID(req);

    if (!ID){ callback("[u]" + req + "[/u] is not in my database."); return; }
    
    request({
      url: ("http://services.runescape.com/m=itemdb_rs/api/catalogue/detail.json?item=" + ID),
      json: true
    }, function (error, response, body){
      if (!error && response.statusCode === 200){
        var name = body.item.name;
        var price = body.item.current.price;
        var link = "([URL=http://services.runescape.com/m=itemdb_rs/viewitem.ws?obj="+ID+"]source[/URL])";
        callback(name + ": " + price + " " + link);
      }
    });
    
  } else if (cmd == "yt" || cmd == "youtube"){  // YouTube Video Search
    req = req.replace(/ /g, "+");
    URL = "https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=1&q="+req+"&key=AIzaSyDh1nE0mDFc9lq6HLqbVV8LzzVMopy9ODY";
    
    request({ url: URL, json: true }, function (error, response, body){
      if (!error && response.statusCode === 200){
        var link = "https://www.youtube.com/watch?v=" + body.items[0].id.videoId;
        callback("[URL="+link+"]"+link+"[/URL]");
      }
    });
  } else if (cmd == "rt" || cmd == "redtube"){  // RedTube Video Search
    link = libz.urlQuery("http://www.redtube.com/?search=", req);
    callback("[URL="+link+"]"+link+"[/URL]");
  } else if (cmd == "ph" || cmd == "pornhub"){  // RedTube Video Search
    req = req.replace(/ /g, "+");
    link = libz.urlQuery("http://www.pornhub.com/video/search?search=", req);
    callback("[URL="+link+"]"+link+"[/URL]");
  } else if (cmd == "stats"){
    URL = "http://services.runescape.com/m=hiscore/index_lite.ws?player=";

    request({ url: URL + req, json: true }, function (error, response, body){
      if (!error && response.statusCode === 200){
        var skills = new Object();
        body.split('\n').forEach(function(item, index){
          skills[stats[index]] = item.split(',');
        });
        if (skills){
          var res = "\n"+skills["attack"][1]+" Att\t"+skills["constitution"][1]+" HP\t"+skills["mining"][1]+" Mi\n"+skills["strength"][1]+" Str\t"+skills["agility"][1]+" Ag\t"+skills["smithing"][1]+" Sm\n"+skills["defence"][1]+" Def\t"+skills["herblore"][1]+" He\t"+skills["fishing"][1]+" Fi\n"+skills["ranged"][1]+" Ra \t"+skills["thieving"][1]+" Th\t"+skills["cooking"][1]+" Co\n"+skills["prayer"][1]+" Pr \t"+skills["crafting"][1]+" Cr\t"+skills["firemaking"][1]+" FM\n"+skills["magic"][1]+" Ma \t"+skills["fletching"][1]+" Fl\t"+skills["woodcutting"][1]+" WC\n"+skills["runecrafting"][1]+" RC \t"+skills["slayer"][1]+" Sl\t"+skills["farming"][1]+" Fa\n"+skills["construction"][1]+" Co \t"+skills["hunter"][1]+" Hu\t"+skills["summoning"][1]+" Su\n"+skills["dungeoneering"][1]+" Dg\t"+skills["divination"][1]+" Di\t"+skills["overall"][1]+" Total";
          callback(res);
        }
      }
    });
  } else if (libz.RSStatToIndex(cmd) != -1){ // RS Skills
    URL = "http://services.runescape.com/m=hiscore/index_lite.ws?player=";
    if (cmd.indexOf("07") != -1){
      URL = "http://services.runescape.com/m=hiscore_oldschool/index_lite.ws?player=";
      cmd = cmd.substring(2);
    }
    
    request({ url: URL + req, json: true }, function (error, response, body){
      if (!error && response.statusCode === 200){
        var statIndex = libz.RSStatToIndex(cmd);
        var stat = body.split('\n')[statIndex];
        if (stat){
          var res = stat.split(',');
          callback(libz.RSIndexToStat(statIndex) + " level: "+ res[1] + " | " + res[2] + "xp ("+libz.toShortNum(res[2]) + ")");
        }
      }
    });
  }
}

startUp();