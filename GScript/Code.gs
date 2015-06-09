function getHeader(col) {
  var sheet = SpreadsheetApp.getActiveSheet();
  var key = sheet.getRange(2, col).getValue();
  return key;
}

function run(action, curRow, verbose) {
  var sheet = SpreadsheetApp.getActiveSheet();
  var userProperties = PropertiesService.getUserProperties();
  var res={};
  
  var server_name=userProperties.getProperty("submit_server");
  
  res["valid"]=true;
  res["action"]=action;
  res["name"]=sheet.getName();
  res["server"]=server_name;
  res["key:secret"]=userProperties.getProperty(server_name);
  
  var data = {};
  var lastCol = sheet.getLastColumn();
  var headers = {};
  for (var i=1; i<lastCol; i++) {
    headers[i] = getHeader(i);
  }
  for (var i=1; i<lastCol; i++) {
    var header = headers[i];
    var val = sheet.getRange(curRow, i).getValue();
    if (!header || !val)
      continue;

    if (val=="N/A")
      val="";
    data[header]=val;
  }
    
  res["data"]=data;
  Logger.log(res);

  var json = JSON.stringify(res, null, 4);
  Logger.log(json);
  
  var url = "http://132.239.201.216/encode/";
  var options = { "method":"POST",
    "contentType" : "application/json",
    "headers" : { "Accept":"application/json" },
    "payload" : json
  };

  var response = UrlFetchApp.fetch(url, options);
  Logger.log(response); 
  
  var response_json = JSON.parse(response);
  
  if (verbose) {
    var htmlOutput = HtmlService
      .createHtmlOutput("<pre>"+response+"<pre>");
    SpreadsheetApp.getUi().showModalDialog(htmlOutput, action+" "+sheet.getName()+"@row "+curRow );
    sheet.getRange(curRow, 2).setValue(response_json["status"]);
  }
  
  return response_json;
};

function can_update_table(row, verbose) {
  var sheet = SpreadsheetApp.getActiveSheet();

  var type = sheet.getRange(2, 2).getValue();
  var status = sheet.getRange(row, 2);
  if (!status.isBlank()) {
    if (verbose)
      Browser.msgBox("Row "+row+": "+type+
        "["+status+"] is not empty");
    return false;
  }
  
  type = sheet.getRange(2, 3).getValue();
  var aliases = sheet.getRange(row, 3);
  if (aliases.isBlank()) {
    if (verbose)
      Browser.msgBox("Row "+row+": "+
        type +" is empty");
    return false;
  }
  
  /*
  var regexp = new RegExp("\\s");
  aliases = sheet.getRange(row, 3).getValue();
  if (regexp.exec(aliases)!=null) {
    if (verbose)
      Browser.msgBox("Row "+row+": "+
        type + "[" + aliases + "]" +" include blank character(s)");
    return false;
  }*/

  return true;
}

function doGet() { 
  var sheet = SpreadsheetApp.getActiveSheet();
  var row = SpreadsheetApp.getActiveSheet().getActiveCell().getRow();
  if (!doValidate(row, row)) return;
  if (can_update_table(row, true)) {
    $ret=run("GET", row, true);
    if ($ret["status"] != "error") {
      sheet.getRange(row, 2).setValue($ret["accession"]);
      //+" @ "+$ret["date_created"].split("T")[0].replace(/-/,'/').replace(/-/,'/'));
    }
  }
}
function doPost() {
  var row = SpreadsheetApp.getActiveSheet().getActiveCell().getRow();
  if (!doValidate(row, row)) return;
  if (can_update_table(row, true))
    run("POST", row, true);
}
function doPatch() {
  var row = SpreadsheetApp.getActiveSheet().getActiveCell().getRow();
  if (!doValidate(row, row)) return;
  if (can_update_table(row, true))
    run("PATCH", row, true);
}

function YesNo(title, msg) {
  var ui = SpreadsheetApp.getUi();
  var response = ui.alert(title, msg, ui.ButtonSet.YES_NO);

  if (response == ui.Button.YES) {
    Logger.log("YES");
    return true;
  }
  Logger.log("NO");
  return false;
}

function doValidate(from, to) {
  Logger.log("Begin validate\n");
  var sheet = SpreadsheetApp.getActiveSheet();
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  var headers = {};

  var ui = SpreadsheetApp.getUi();
  for (var i=1; i<lastCol; i++) {
    headers[i] = getHeader(i);
    Logger.log("::"+headers[i]+"\n");
    if (hasSpace(headers[i])) {
      ui.alert("Space found in header:"+i+" ["+headers[i]+"]");
      return false;
    }
  }
  for (var row=from; row<=to; row++) {
    for (var i=1; i<lastCol; i++) {
      var header = headers[i];
      var val = sheet.getRange(row, i).getValue();
      if (!header || !val)
        continue;
      Logger.log("::"+header+"=>"+val+"\n");
      
      var trimmed = trim(val);
      if (trimmed != val) {
        ui.alert("Col: "+i+" Row:"+row+":\n["+val+"] should be ["+trimmed+"]");
        return false;      
      }
      
      if (!allowSpace(header) && hasSpace(val)) {
        ui.alert("Space found in Col:"+i+" Row:"+row+": "+headers[i]+": "+val);
        return false;
      }
    }
  }
  return true;
}

function doGetAll() {
  var sheet = SpreadsheetApp.getActiveSheet();
  var lastRow = sheet.getLastRow();
  if (!doValidate(3, lastRow)) return;
  for (var row=3; row<=lastRow; row++) {
    if (!can_update_table(row, false))
      continue;
    $ret=run("GET", row, false);
    if ($ret["status"] != "error") {
      sheet.getRange(row, 2).setValue($ret["accession"]);
    } else {
      if (YesNo("Error in GET "+sheet.getRange(row, 3), "Continue?")==false)
        break;
    }
  }
}

function doPostAll() {
  var sheet = SpreadsheetApp.getActiveSheet();
  var lastRow = sheet.getLastRow();
  if (!doValidate(3, lastRow)) return;
  for (var row=3; row<=lastRow; row++) {
    if (!can_update_table(row, false))
      continue;
    $ret=run("POST", row, false);
    if ($ret["status"] == "error") {
      if (!YesNo("POST", "Continue?"))
        break;
    } else {
      sheet.getRange(row, 2).setValue($ret["status"]);
    }
  }
}

function doPatchAll() {
  var sheet = SpreadsheetApp.getActiveSheet();
  var lastRow = sheet.getLastRow();
  if (!doValidate(3, lastRow)) return;
  for (var row=3; row<=lastRow; row++) {
    if (!can_update_table(row, false))
      continue;
    $ret=run("PATCH", row, false);
    if ($ret["status"] == "error") {
      if (!YesNo("PATCH", "Continue?"))
        break;
    } else {
      sheet.getRange(row, 2).setValue($ret["status"]);
    }
  }
}

function selTestServer() {
  var server_name = "https://test.encodedcc.org";
  PropertiesService.getUserProperties().setProperty("submit_server", server_name);
  Browser.msgBox("Use: "+server_name);
}

function selEncodeServer() {
  var server_name = "https://www.encodeproject.org";
  PropertiesService.getUserProperties().setProperty("submit_server", server_name);
  Browser.msgBox("Use: "+server_name);
}

function getCurrServer() {
  var server_name = PropertiesService.getUserProperties().getProperty("submit_server");
  Browser.msgBox("Current server: "+server_name);
}

function onOpen() {
  //Browser.msgBox("I'm here");
  var ui = SpreadsheetApp.getUi();
  var menu = ui.createMenu('Encode');

  var server_name=PropertiesService.getUserProperties().getProperty("submit_server");
  if (server_name==null) {
    server_name="https://test.encodedcc.org";
    PropertiesService.getUserProperties().setProperty("submit_server", server_name);
  }
  var userProperties = PropertiesService.getUserProperties();
  Logger.log("submit_server: "+server_name+"=>"+userProperties.getProperty(server_name));
  if (userProperties.getProperty(server_name) != null) {
    menu.addSubMenu(ui.createMenu('Selected')
        .addItem("Get from ENCODE", "doGet")
        .addItem("Post to ENCODE", "doPost")
        .addItem("Patch to ENCODE", "doPatch")
        )
      .addSubMenu(ui.createMenu('ALL')
        .addItem("Get all from ENCODE", "doGetAll")
        .addItem("Post all to ENCODE", "doPostAll")
        .addItem("Patch all to ENCODE", "doPatchAll")
        )
      .addSeparator()
      .addSubMenu(ui.createMenu('Settings')
        .addSubMenu(ui.createMenu('Select servers')
          .addItem("Test server", "selTestServer")
          .addItem("Encode server", "selEncodeServer")
        )
        .addItem("View current server", "getCurrServer")
        .addItem("Validate sheet", "doValidate")
        )
        .addItem("Help", "help")
      .addToUi();
  } else {
    menu.addSubMenu(ui.createMenu('Selected')
        .addItem("Get from ENCODE", "doGet")
        )
      .addSubMenu(ui.createMenu('ALL')
        .addItem("Get all from ENCODE", "doGetAll")
        )
      .addSeparator()
      .addSubMenu(ui.createMenu('Settings')
        .addSubMenu(ui.createMenu('Select servers')
          .addItem("Test server", "selTestServer")
          .addItem("Encode server", "selEncodeServer")
        )
        .addItem("View current server", "getCurrServer")
        .addItem("Validate sheet", "doValidate")
        )
        .addItem("Help", "help")
      .addToUi();
  }
};

function help() {
  var app = UiApp.createApplication().setHeight('60').setWidth('150');
  app.setTitle("Help document:");
  var doc = SpreadsheetApp.getActive();
  doc.show(app);
}

function allowSpace(str) {
  if (typeof(str)!="string")
    return false;
  var match=str.match(/:text/);
  if (match)
    return true;
  return false;
}

function hasSpace(str) {
  if (typeof(str)!="string")
    return false;
  var match=str.match(/\s/);
  if (match)
    return true;
  return false;
}

function trim(str) {
  if (typeof(str)!="string")
    return str;
  var match=str.match(/\S+/g);
  var ret="";
  if (match) {
    ret=match.join(" ");
  }
  return ret;
}

