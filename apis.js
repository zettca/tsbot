const rsStats = ["overall","attack","defence","strength","constitution","ranged","prayer","magic","cooking","woodcutting","fletching","fishing","firemaking","crafting","smithing","mining","herblore","agility","thieving","slayer","farming","runecrafting","hunter","construction","summoning","dungeoneering","divination","invention","bounty_hunter","bounty_hunter_rouges","dominion_tower","crucible","castle_wars","BA_attackers","BA_defenders","BA_collectors","BA_healers","duel_tournaments","mobilising_armies","conquest","fist_of_guthix","GG_resource","GG_athletics","we2","we2","we2","we2","heist_guard","heist_robber","CFP"];
const rsStatsShort = [["overall", "total", "oa"],["attack", "att", "at"],["defence", "def", "de"],["strength", "str", "st"],["constitution", "hp"],["ranged", "range", "ra", "rang"],["prayer", "pray", "pr"],["magic", "mage", "ma"],["cooking", "cook"],["woodcutting", "wood", "wc", "wo"],["fletching", "fletch", "fl"],["fishing", "fish", "fi"],["firemaking", "fire", "fm"],["crafting", "craft", "cr"],["smithing", "smith", "sm"],["mining", "mine", "mi"],["herblore", "herb", "he"],["agility", "agil", "ag"],["thieving", "thiev", "th"],["slayer", "slay", "sl"],["farming", "farm", "fa"],["runecrafting", "rc", "ru"],["hunter", "hunt", "hu"],["construction", "cons", "construct"],["summoning", "summon", "su"],["dungeoneering", "dungeon", "du", "dung"],["divination", "div", "di"],["invention", "invent", "in"],["bounty_hunter", "bh"],["bounty_hunter_rouges", "bhr"],["dominion_tower", "dt", "dominion"],["crucible"],["castle_wars", "cw"],["BA_attackers", "baa"],["BA_defenders", "bad"],["BA_collectors", "bac"],["BA_healers", "bah"],["duel_tournaments", "duel"],["mobilising_armies", "mob"],["conquest"],["fist_of_guthix", "fog"],["GG_resource", "ggr"],["GG_athletics", "gga"],["we2ac"],["we2bc"],["we2ak"],["we2bk"],["heist_guard", "heistg"],["heist_robber", "heistr"],["CFP"]];
const askOpts = ["Yes", "No", "Maybe", "Penis is the answer", "There is no answer to that", "Sex will solve that", "Crying will solve that", "Obviously", "Obviously not", "Never", "Everyday", "Keep dreaming...", "Ask somebody dumb instead", "Ask a human instead", "You shouldn't ask such things", "Google it", "The answer is obvious"];

var fs = require('fs');
var request = require('request');
var API = function(){};

API.prototype.send = function(cmd, req, callback){
  var link, res;
  
  switch(cmd){
    case "a":
    case "ask":
      callback(askZ(req));
      break;
    case "c":
    case "calc":
      callback(calc(req));
      break;
    case "rt":
    case "redtube":
      link = "http://www.pornhub.com/video/search?search=" + req.replace(/ /g, "+");
      callback("[URL="+link+"]"+link+"[/URL]");
      break;
    case "ph":
    case "pornhub":
      link = "http://www.pornhub.com/video/search?search=" + req.replace(/ /g, "+");
      callback("[URL="+link+"]"+link+"[/URL]");
      break;
    case "ge":
    case "price":
      rsGEPrice(req, function(data){ callback(data); });
      break;
    case "all":
    case "stats":
    case "levels":
      rsPlayerStats(req, function(data){ callback(data); });
      break;
  }
  
  if (rsStatIndex(cmd) !== -1){
    rsPlayerSkill(cmd, req, function(data){ callback(data); });
  }
};

/* ============================== */



function rsStatIndex(skill){
  for (var i=0; i<rsStatsShort.length; i++)
    if (rsStatsShort[i].indexOf(skill) != -1) return i;
  return -1;
}

function askZ(req){
    var value = 0;
    for (var i=0; i<req.length; i++) value += req.charCodeAt(i);
    return askOpts[Math.floor(value) % askOpts.length];
}

function calc(req){
  var input = req;
  var ops = { add : '+', sub : '-', div : '/', mlt : '*', mod : '%', exp : '^'};
  ops.order = [[[ops.mlt], [ops.div], [ops.mod], [ops.exp]], [[ops.add], [ops.sub]]];
  
  if (!isNaN(input)) return input;
  
  input = input.replace(/k/g, '*1000');
  input = input.replace(/m/g, '*1000000');
  input = input.replace(/b/g, '*1000000000');
  input = input.replace(/t/g, '*1000000000000');
  input = input.replace(/q/g, '*1000000000000000');
  input = input.replace(/[^0-9%^*\/()\-+.]/g,'');  // clean up unnecessary characters
  
  var output;
  for(var i=0, n=ops.order.length; i<n; i++ ){
    // Regular Expression to look for operators between floating numbers or integers
    var re = new RegExp('(\\d+\\.?\\d*)([\\'+ops.order[i].join('\\')+'])(\\d+\\.?\\d*)');
    re.lastIndex = 0; // be cautious and reset re start pos
    
    // Loop while there is still calculation for level of precedence
    while(re.test(input)){
      output = calc_internal(RegExp.$1,RegExp.$2,RegExp.$3);
      if (isNaN(output) || !isFinite(output)) return output;   // exit early if not a number
      input = input.replace(re,output);
    }
  }
  
  return output;
  
  function calc_internal(a,op,b){
    a=a*1; b=b*1;
    switch(op){
      case ops.add: return a+b;
      case ops.sub: return a-b;
      case ops.div: return a/b;
      case ops.mlt: return a*b;
      case ops.mod: return a%b;
      case ops.exp: return Math.pow(a,b);
      default: null;
    }
  }
}


function rsGEPrice(req, cb){
  const URL = "http://services.runescape.com/m=itemdb_rs/api/catalogue/detail.json?item=";
  var ID = GENameToID(req);
  
  if (!ID) return "[u]" + req + "[/u] is not in my database."; 
  
  request({ url: URL + ID, json: true }, function (error, response, body){
    if (!error && response.statusCode === 200){
      var name = body.item.name;
      var price = body.item.current.price;
      var link = "([URL=http://services.runescape.com/m=itemdb_rs/viewitem.ws?obj="+ID+"]source[/URL])";
      cb(name + ": " + price + " " + link);
    }
  });
}

function rsPlayerStats(req, cb){
  const URL = "http://services.runescape.com/m=hiscore/index_lite.ws?player=";
  console.log("getting stats for dude");
  request({ url: URL + req, json: true }, function (error, response, body){
    if (!error && response.statusCode === 200){
      var skills = {};
      body.split('\n').forEach(function(item, index){
        skills[rsStats[index]] = item.split(',');
      });
      if (skills){
        console.log("got stats for dude");
        cb("\n"+skills["attack"][1]+" Att\t"+skills["constitution"][1]+" HP\t"+skills["mining"][1]+" Mi\n"+skills["strength"][1]+" Str\t"+skills["agility"][1]+" Ag\t"+skills["smithing"][1]+" Sm\n"+skills["defence"][1]+" Def\t"+skills["herblore"][1]+" He\t"+skills["fishing"][1]+" Fi\n"+skills["ranged"][1]+" Ra \t"+skills["thieving"][1]+" Th\t"+skills["cooking"][1]+" Co\n"+skills["prayer"][1]+" Pr \t"+skills["crafting"][1]+" Cr\t"+skills["firemaking"][1]+" FM\n"+skills["magic"][1]+" Ma \t"+skills["fletching"][1]+" Fl\t"+skills["woodcutting"][1]+" WC\n"+skills["runecrafting"][1]+" RC \t"+skills["slayer"][1]+" Sl\t"+skills["farming"][1]+" Fa\n"+skills["construction"][1]+" Co \t"+skills["hunter"][1]+" Hu\t"+skills["summoning"][1]+" Su\n"+skills["dungeoneering"][1]+" Dg\t"+skills["divination"][1]+" Di\t"+skills["overall"][1]+" Total");
      }
    }
  });
}

function rsPlayerSkill(cmd, req, cb){
  const URL = "http://services.runescape.com/m=hiscore/index_lite.ws?player=";
  
  if (cmd.indexOf("07") != -1){
    URL = "http://services.runescape.com/m=hiscore_oldschool/index_lite.ws?player=";
    cmd = cmd.substring(2);
  }
  
  request({ url: URL + req, json: true }, function (error, response, body){
    if (!error && response.statusCode === 200){
      var statIndex = rsStatIndex(cmd);
      var stat = body.split('\n')[statIndex];
      if (stat){
        var res = stat.split(',');
        cb(rsStats[statIndex] + " level: "+ res[1] + " | " + res[2] + "xp ("+libz.toShortNum(res[2]) + ")");
      }
    }
  });
}

function GENameToID(itemName){
  if (!isNaN(itemName)) return itemName;
  
  var itemList = JSON.parse(fs.readFileSync("itemlist.json", "utf8"));
  
  for (var i=0; i<itemList.length;i++) // exact search
    if (itemList[i][1].toLowerCase() == itemName.toLowerCase())
      return itemList[i][0];
  
  for (var i=0; i<itemList.length;i++) // contains search
    if (itemList[i][1].toLowerCase().indexOf(itemName.toLowerCase()) != -1)
      return itemList[i][0];
}

String.prototype.capitalize = function(){
    return this.charAt(0).toUpperCase() + this.slice(1);
};

module.exports = new API();

