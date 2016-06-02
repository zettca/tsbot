const RS_STATS = [["overall","total","oa"],["attack","att","at"],["defence","def","de"],["strength","str","st"],["constitution","hp"],["ranged","range","ra","rang"],["prayer","pray","pr"],["magic","mage","ma"],["cooking","cook"],["woodcutting","wood","wc","wo"],["fletching","fletch","fl"],["fishing","fish","fi"],["firemaking","fire","fm"],["crafting","craft","cr"],["smithing","smith","sm"],["mining","mine","mi"],["herblore","herb","he"],["agility","agil","ag"],["thieving","thiev","th"],["slayer","slay","sl"],["farming","farm","fa"],["runecrafting","rc","ru"],["hunter","hunt","hu"],["construction","cons","construct"],["summoning","summon","su"],["dungeoneering","dungeon","du","dung"],["divination","div","di"],["invention","invent","in"],["bounty_hunter","bh"],["bounty_hunter_rouges","bhr"],["dominion_tower","dt","dominion"],["crucible",],["castle_wars","cw"],["BA_attackers","baa"],["BA_defenders","bad"],["BA_collectors","bac"],["BA_healers","bah"],["duel_tournaments","duel"],["mobilising_armies","mob"],["conquest",],["fist_of_guthix","fog"],["GG_resource","ggr"],["GG_athletics","gga"],["WE2AC",],["WE2BC",],["WE2AK",],["WE2BK",],["heist_guard","heistg"],["heist_robber","heistr"],["CFP",],["WE31"],["WE32"]];
const ASKOPTS = ["Yes", "No", "Maybe", "Penis is the answer", "There is no answer to that", "Sex will solve that", "Crying will solve that", "Obviously", "Obviously not", "Never", "Everyday", "Keep dreaming...", "Ask somebody dumb instead", "Ask a human instead", "You shouldn't ask such things", "Google it", "The answer is obvious"];

var fs = require('fs');
var request = require('request');

var API = {};

API.askZ = function(req){
    var value = 0;
    for (var i=0; i<req.length; i++) value += req.charCodeAt(i);
    return ASKOPTS[Math.floor(value) % ASKOPTS.length];
};

API.rsGEPrice = function(req, callback){
  const URL = "http://services.runescape.com/m=itemdb_rs/api/catalogue/detail.json?item=";
  var id = API.GENameToID(req);
  
  if (!id) return "[u]" + req + "[/u] is not in my database."; 
  
  request({ url: URL + id, json: true }, function (error, response, body){
    if (!error && response.statusCode === 200){
      var name = body.item.name;
      var price = body.item.current.price;
      var link = "([URL=http://services.runescape.com/m=itemdb_rs/viewitem.ws?obj="+id+"]source[/URL])";
      callback(name + ": " + price + " " + link);
    }
  });
};

API.rsPlayerStats = function(req, callback){
  const URL = "http://services.runescape.com/m=hiscore/index_lite.ws?player=";

  request({ url: URL + req, json: true }, function (error, response, body){
    if (!error && response.statusCode === 200){
      var skills = {};
      body.split('\n').forEach(function(item, index){
        if (RS_STATS[index]){
          skills[RS_STATS[index][0]] = item.split(',');
          skills[RS_STATS[index][0]][1] = parseInt(skills[RS_STATS[index][0]][1], 10) || 1;
        }
      });
      if (skills){
        callback("\n"+skills.attack[1]+" Att\t"+skills.constitution[1]+" HP\t"+skills.mining[1]+" Mi\n"+skills.strength[1]+" Str\t"+skills.agility[1]+" Ag\t"+skills.smithing[1]+" Sm\n"+skills.defence[1]+" Def\t"+skills.herblore[1]+" He\t"+skills.fishing[1]+" Fi\n"+skills.ranged[1]+" Ra \t"+skills.thieving[1]+" Th\t"+skills.cooking[1]+" Co\n"+skills.prayer[1]+" Pr \t"+skills.crafting[1]+" Cr\t"+skills.firemaking[1]+" FM\n"+skills.magic[1]+" Ma \t"+skills.fletching[1]+" Fl\t"+skills.woodcutting[1]+" WC\n"+skills.runecrafting[1]+" RC \t"+skills.slayer[1]+" Sl\t"+skills.farming[1]+" Fa\n"+skills.construction[1]+" Co \t"+skills.hunter[1]+" Hu\t"+skills.summoning[1]+" Su\n"+skills.dungeoneering[1]+" Dg\t"+skills.divination[1]+" Di\t"+skills.invention[1]+" In\n"+skills.overall[1]+" Overall | "+toShortNum(skills.overall[2])+" xp");
      } else{
        callback("User not found...");
      }
    }
  });
};

API.rsPlayerSkill = function(cmd, req, callback){
  const URL = "http://services.runescape.com/m=hiscore/index_lite.ws?player=";
  
  if (cmd.indexOf("07") != -1){
    URL = "http://services.runescape.com/m=hiscore_oldschool/index_lite.ws?player=";
    cmd = cmd.substring(2);
  }
  
  request({ url: URL + req, json: true }, function (error, response, body){
    if (!error && response.statusCode === 200){
      var statIndex = API.rsStatIndex(cmd);
      var stat = body.split('\n')[statIndex];
      if (stat){
        var res = stat.split(',');
        callback(RS_STATS[statIndex][0].capitalize() + " level: "+ res[1] + " | " + res[2] + "xp ("+toShortNum(res[2]) + ")");
      }
    }
  });
};

API.rsStatIndex = function(skill){
  for (var i=0; i<RS_STATS.length; i++)
    if (RS_STATS[i].indexOf(skill) !== -1)
      return i;
  return -1;
};

API.GENameToID = function(itemSearch){
  if (!isNaN(itemSearch)) return itemSearch; // isID
  var itemList = JSON.parse(fs.readFileSync("itemlist.json", "utf8"));
  
  for (var prop in itemList)  // exact search
    if (itemList[prop].toLowerCase() === itemSearch.toLowerCase())
      return prop;
  for (var prop in itemList)  // contains search
    if (itemList[prop].toLowerCase().indexOf(itemSearch.toLowerCase()) !== -1)
      return prop;

  return null;
};

API.calc = function(input){
  if (!isNaN(input)) return input;
  var ops = { add : '+', sub : '-', div : '/', mlt : '*', mod : '%', exp : '^'};
  ops.order = [[[ops.mlt], [ops.div], [ops.mod], [ops.exp]], [[ops.add], [ops.sub]]];
  
  input = input.replace(/k/g, '*1000');
  input = input.replace(/m/g, '*1000000');
  input = input.replace(/b/g, '*1000000000');
  input = input.replace(/t/g, '*1000000000000');
  input = input.replace(/q/g, '*1000000000000000');
  input = input.replace(/[^0-9%^*\/()\-+.]/g,'');  // clean up unnecessary characters
  
  var output;
  for(var i=0, n=ops.order.length; i<n; i++){
    var re = new RegExp('(\\d+\\.?\\d*)([\\'+ops.order[i].join('\\')+'])(\\d+\\.?\\d*)');
    re.lastIndex = 0; // reset re start pos
    while(re.test(input)){ // while there is still calculation for level of precedence
      output = calc_internal(RegExp.$1,RegExp.$2,RegExp.$3);
      if (isNaN(output) || !isFinite(output)) return output; // exit if NaN
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
};

/* ========== AUXILIARY ========== */


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

module.exports = API;
