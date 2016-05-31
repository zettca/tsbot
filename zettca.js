var zettca = function(){};

zettca.prototype.log = function(msg){
  console.log('['+this.getTime() + '] ' + msg);
};

zettca.prototype.getTime = function(){
  var time = new Date();
  var hour = (time.getUTCHours()>9) ? time.getUTCHours() : '0'+time.getUTCHours();
  var mins = (time.getUTCMinutes()>9) ? time.getUTCMinutes() : '0'+time.getUTCMinutes();
  var secs = (time.getUTCSeconds()>9) ? time.getUTCSeconds() : '0'+time.getUTCSeconds();
  return hour+':'+mins+':'+secs;
};

zettca.prototype.timeString = function(time){
  var timeDesc = ["ms", "seconds", "minutes", "hours", "days"];
  var timeDivisor = [1000, 60, 60, 24];
  if (isNaN(time)) return;
  
  for (var i=0; time>=timeDivisor[i] && i<timeDivisor.length; time /= timeDivisor[i++]); // phew
  return (time != 1) ? time + " " + timeDesc[i] : time + " " + timeDesc[i].substring(0, timeDesc[i].length-1);
};

zettca.prototype.toShortNum = function(num){
  var powChars = ['', 'k', 'm', 'b', 't', 'q'];
  if (isNaN(num)) return 0;
  
  for (var i=0; num>1000 && i<powChars.length-1; num /= 1000, i++); // phew
  num = (num%1==0) ? num : num.toFixed(2);
  return num + powChars[i];
};

zettca.prototype.toLongNum = function(str){
  var powChars = ['', 'k', 'm', 'b', 't', 'q'];
  var powIndex = powChars.indexOf(str.slice(-1));
  return (powIndex == -1) ? "nullion" : parseFloat(str.substr(0, str.length-1)) * Math.pow(1000, powIndex);
};

module.exports = new zettca();