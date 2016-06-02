const rsStats = ["overall","attack","defence","strength","constitution","ranged","prayer","magic","cooking","woodcutting","fletching","fishing","firemaking","crafting","smithing","mining","herblore","agility","thieving","slayer","farming","runecrafting","hunter","construction","summoning","dungeoneering","divination","invention","bounty_hunter","bounty_hunter_rouges","dominion_tower","crucible","castle_wars","BA_attackers","BA_defenders","BA_collectors","BA_healers","duel_tournaments","mobilising_armies","conquest","fist_of_guthix","GG_resource","GG_athletics","WE2AC","WE2BC","WE2AK","WE2BK","heist_guard","heist_robber","CFP"];
const askOpts = ["Yes", "No", "Maybe", "Penis is the answer", "There is no answer to that", "Sex will solve that", "Crying will solve that", "Obviously", "Obviously not", "Never", "Everyday", "Keep dreaming...", "Ask somebody dumb instead", "Ask a human instead", "You shouldn't ask such things", "Google it", "The answer is obvious"];

var fs = require('fs');
var request = require('request');

var API = function(){};

API.prototype.send = function(cmd, req, callback){
  var link;
  
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
  const rsStatsShort = [["total", "oa"],["att", "at"],["def", "de"],["str", "st"],["hp"],["range", "ra", "rang"],["pray", "pr"],["mage", "ma"],["cook"],["wood", "wc", "wo"],["fletch", "fl"],["fish", "fi"],["fire", "fm"],["craft", "cr"],["smith", "sm"],["mine", "mi"],["herb", "he"],["agil", "ag"],["thiev", "th"],["slay", "sl"],["farm", "fa"],["rc", "ru"],["hunt", "hu"],["cons", "construct"],["summon", "su"],["dungeon", "du", "dung"],["div", "di"],["invent", "in"],["bh"],["bhr"],["dt", "dominion"],[],["cw"],["baa"],["bad"],["bac"],["bah"],["duel"],["mob"],[],["fog"],["ggr"],["gga"],[],[],[],[],["heistg"],["heistr"],[]];
  for (var i=0; i<rsStats.length; i++)
    if (rsStats[i] == skill.toLowerCase()) return i;
  for (var i=0; i<rsStatsShort.length; i++)
    if (rsStatsShort[i].indexOf(skill) !== -1) return i;
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
    
    while(re.test(input)){ // while there is still calculation for level of precedence
      output = calc_internal(RegExp.$1,RegExp.$2,RegExp.$3);
      if (isNaN(output) || !isFinite(output)) return output; // exit early if not a number
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

  request({ url: URL + req, json: true }, function (error, response, body){
    if (!error && response.statusCode === 200){
      var skills = {};
      body.split('\n').forEach(function(item, index){
        skills[rsStats[index]] = item.split(',');
      });
      if (skills){
        cb("\n"+skills.attack[1]+" Att\t"+skills.constitution[1]+" HP\t"+skills.mining[1]+" Mi\n"+skills.strength[1]+" Str\t"+skills.agility[1]+" Ag\t"+skills.smithing[1]+" Sm\n"+skills.defence[1]+" Def\t"+skills.herblore[1]+" He\t"+skills.fishing[1]+" Fi\n"+skills.ranged[1]+" Ra \t"+skills.thieving[1]+" Th\t"+skills.cooking[1]+" Co\n"+skills.prayer[1]+" Pr \t"+skills.crafting[1]+" Cr\t"+skills.firemaking[1]+" FM\n"+skills.magic[1]+" Ma \t"+skills.fletching[1]+" Fl\t"+skills.woodcutting[1]+" WC\n"+skills.runecrafting[1]+" RC \t"+skills.slayer[1]+" Sl\t"+skills.farming[1]+" Fa\n"+skills.construction[1]+" Co \t"+skills.hunter[1]+" Hu\t"+skills.summoning[1]+" Su\n"+skills.dungeoneering[1]+" Dg\t"+skills.divination[1]+" Di\t"+skills.invention[1]+" In\n"+skills.overall[1]+" Overall | "+toShortNum(skills.overall[2])+" xp");
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
        cb(rsStats[statIndex].capitalize() + " level: "+ res[1] + " | " + res[2] + "xp ("+toShortNum(res[2]) + ")");
      }
    }
  });
}

function GENameToID(itemName){
  if (!isNaN(itemName)) return itemName; // is ID
  
  var itemList = JSON.parse(fs.readFileSync("itemlist.json", "utf8"));
  
  for (var i=0; i<itemList.length; i++) // exact search
    if (itemList[i][1].toLowerCase() == itemName.toLowerCase())
      return itemList[i][0];
  
  for (var i=0; i<itemList.length; i++) // contains search
    if (itemList[i][1].toLowerCase().indexOf(itemName.toLowerCase()) != -1)
      return itemList[i][0];
}

function toShortNum(num){
  var powChars = ['', 'k', 'm', 'b', 't', 'q'];
  if (isNaN(num)) return 0;
  
  for (var i=0; num>1000 && i<powChars.length-1; num /= 1000, i++); // phew
  num = (num%1==0) ? num : num.toFixed(2);
  return num + powChars[i];
}

String.prototype.capitalize = function(){
    return this.charAt(0).toUpperCase() + this.slice(1);
};


module.exports = new API();
