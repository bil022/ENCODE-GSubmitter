function init() {
  var userProperties=PropertiesService.getUserProperties();
  userProperties.deleteAllProperties();
  userProperties.setProperty("submit_server", "https://test.encodedcc.org");
  userProperties.setProperty("https://www.encodeproject.org", "xxxxxxxx:yyyyyyyyyyyyyyyy");
  userProperties.setProperty("https://test.encodedcc.org",    "xxxxxxxx:yyyyyyyyyyyyyyyy");

  var data = userProperties.getProperties();
  for (var key in data) {
    Logger.log('UserKey: %s, Value: %s', key, data[key]);
  }
}

