<?PHP
ini_set('display_errors',1);  error_reporting(E_ALL);
header('Content-Type: application/json');

assert_options( ASSERT_CALLBACK, 'assert_callback');

function assert_callback( $script, $line, $message ) {
  $msg='Error in '.$script.': line '.$line.' : '.$message;
  error($msg);
}

function assert_property($obj, $prop) {
  assert(property_exists($obj, $prop), "property ".$prop." not found");
  return $obj->{$prop};
}

function error($msg) {
  if (php_sapi_name() == "cli")
    var_dump(debug_backtrace());
  $err=json_decode('{"status":"error"}');
  $err->{"message"}=$msg;
  print json_encode($err, JSON_PRETTY_PRINT);
  exit;
}

function error_json($obj) {
  print (json_encode($obj, JSON_PRETTY_PRINT));
  exit;
}

function trace($msg, $obj) {
  if (php_sapi_name() != "cli")
    return;
  print "$msg: ";
  print_r($obj);
  print "\n";
}

function trace_json($msg, $obj) {
  trace($msg, json_encode($obj, JSON_PRETTY_PRINT)); 
}

if (php_sapi_name() == "cli") {
  $input = json_decode(file_get_contents('local.json'));
} else {
  $input = json_decode(file_get_contents('php://input')); 
}

if (!$input || $input->{"valid"}!=true) {
  error_json($input);
}

$action=assert_property($input, "action");
$name=assert_property($input, "name");
$HOST=assert_property($input, "server");
$input_data=assert_property($input, "data");

# update array
$updated_data=json_decode('{}');
foreach ($input_data as $key => $value) {
  if (strpos($key, ":") != false) {
    list($key, $type)=explode(":", $key);
    if ($type == "array" || $type=="textarray") { # or boolean                       
      if (empty($value)) {
        $value=array();
      } else {
        $value=explode(";", $value);
      }
    }
  }
  $updated_data->{$key}=$value;
} 
trace_json("Input updated", $updated_data);
$input_data=$updated_data;

$aliases=assert_property($input_data, "aliases");
$schemas = json_decode(file_get_contents("schemas.json"));
#$HOST=assert_property($schemas, "HOST");
#trace("HOST", $HOST);
$schema=assert_property($schemas, $name);
#trace("Schema", $schema);
$URI=assert_property($schema, "URI");
$fields=assert_property($schema, "FIELDS");
#trace("Fields", $fields);
$key_secret="";
if (strlen($key))
  $key_secret="-u ".$input->{"key:secret"};
trace("key_secret", $key_secret);

$doGet=false;
$doPost=false;
$doPatch=false;

if (is_int(strpos($action, "GET"))) $doGet=true;
elseif (is_int(strpos($action, "POST"))) $doPost=true;
elseif (is_int(strpos($action, "PATCH"))) $doPatch=true;
else error("Unknown action: ".$action);

if ($doGet) {
  # Permission denied: setsebool -P httpd_can_network_connect 1
  $url=$HOST.'/'.$URI.'/'.rawurlencode($aliases[0]).'?format=json';
  trace("Url", $url);
  $curl_get=curlGet($url);
  $get_json=json_decode($curl_get);
  trace("GET", $get_json);

  if (!$get_json) {
    error($curl_get);
  }
  /*switch ($get_json->{"status"}) {
    case "error":
      if ($get_json->{"code"}!=404) {
        error_json($get_json);
      }
      $doPost=true;
      break;
    default:
  }*/
  print json_encode($get_json, JSON_PRETTY_PRINT);
} elseif ($doPost) { # POST with aliases
  $post_data=json_decode('{}');
  $post_data->{"aliases"}=$aliases;

  if ($URI == "files") {
    //input: aliase replicate fastq_file award lab
    $replicate=assert_property($input_data, "replicate");
    if (!preg_match('/^bing-ren:(\S+)$/', $aliases[0], $matched)) {
      error("^bing-ren:(\S+)$? $aliases[0]");
    }
    $gz="$matched[1].fastq.gz";
    if (!file_exists("files/gz/$gz")) {
      $fastq_file=assert_property($input_data, "fastq_file");
      error("$gz not found, please copy from promoter...$fastq_file to files/gz/$gz");
    }
    $rep_url=$HOST.'/replicates/'.rawurlencode($replicate).'?format=json';
    trace("Rep_url", $rep_url);
    $rep_get=curlGet($rep_url);
    $rep_json=json_decode($rep_get);
    trace("REP", $rep_json);
    if (!$rep_json) {
      error($rep_get);
    } elseif ($rep_json->{"status"}=="error") {
      error_json($rep_json);
    }
    $dataset=$rep_json->{"experiment"};
    if (!preg_match('/^\/experiments\/(\S+)\/$/', $dataset, $matched)) {
      error("^\/experiments\/(\S+)\/$? $dataset");
    }
    $input_data->{"dataset"}=$matched[1];
    $md5sums=file_get_contents('files/gz/md5sum.sh');
    if (!preg_match('/(\d+)\s+(\S+)\s+(\S+)\s+'.$gz.'/', $md5sums, $matched)) {
      error("$gz not found in md5sum.sh: ".$md5sums);
    }
    $input_data->{"file_size"}=(int)$matched[1];
    $input_data->{"md5sum"}=$matched[2];
    $input_data->{"FCID"}=$matched[3];
    $input_data->{"file_format"}="fastq";
    $input_data->{"output_type"}="reads"; 
    $input_data->{"submitted_file_name"}="files/gz/$gz";
    trace("Updated_input_data", $input_data);
    /*
     if not exists files/gz/${aliase##bing-ren:}.fastq.gz
       cp promoter.sdsc.edu:.../$fastq_file files/gz/${aliase##bing-ren:}.fastq.gz
     get dataset: experiment #encsr base on #replicate
     "dataset", "replicate", "file_format", "file_size", "md5sum", "output_type", "submitted_file_name", "award", "lab" 
     file_format/output_type: reads/fastq
     file_size & md5sum: from files/gz/${aliase##bing-ren:}.fastq.gz
     submitted_file_name: files/gz/${aliase##bing-ren:}.fastq.gz
    */ 
  }

  foreach ($input_data as $key => $value) {
    if (is_int(array_search($key, $fields))) {
      $post_data->{$key}=$value;
    }
  }

  trace_json("Post_data", $post_data);
  $url=$HOST.'/'.$URI.'/?format=json';
  $curl_post=curlPost($url, $post_data);
  $post_json=json_decode($curl_post);
 
  if (!$post_json)
    error($curl_post);
  if ($post_json->{"status"}=="error")
    error_json($post_json);
  print json_encode($post_json, JSON_PRETTY_PRINT);
} elseif ($doPatch) {
  $patch_data=json_decode("{}");
  foreach ($input_data as $key => $value) {
    if (is_int(array_search($key, $fields))) {
      $patch_data->{$key}=$value;
    } else {
      trace("Ignored", "$key\n");
    }
  }

  trace_json("Patch_data", $patch_data);
  $url=$HOST.'/'.$URI.'/'.rawurlencode($aliases[0]).'?format=json';
  $curl_patch=curlPatch($url, $patch_data);
  $patch_json=json_decode($curl_patch);

  if (!$patch_json)
    error($curl_path);
  if ($patch_json->{"status"}=="error")
    error_json($patch_json);
  print json_encode($patch_json, JSON_PRETTY_PRINT);
}

exit(0);

function curlGet($url) {
   $option="-L";
   return curl($url, $option, null); 
}

function curlPost($url, $json) {
   $option="--request POST -d @-";
   return curl($url, $option, $json); 
}

function curlPatch($url, $json) {
   $option="--request PATCH -d @-";
   return curl($url, $option, $json); 
}

function curl($url, $option, $json) {
  global $key_secret;
  $descriptorspec = array(
    0 => array("pipe", "r"), // stdin is a pipe that the child will read from
    1 => array("pipe", "w"), // stdout is a pipe that the child will write to
    2 => array("pipe", "a")  // stdout is a pipe that the child will write to
  );
  $curl="curl $option $key_secret --header 'Content-Type:application/json' $url";

  $ret='{"status":"error"}'; 
  $process = proc_open($curl, $descriptorspec, $pipes);
  if (is_resource($process)) {
    if ($json!=null)
      fwrite($pipes[0], json_encode($json));
    fclose($pipes[0]);
    $ret = stream_get_contents($pipes[1]);
    fclose($pipes[1]);
    fclose($pipes[2]);

    $return_value = proc_close($process);
    #echo "command returned $return_value\n";
  }
  return $ret;
}

?>
